import {
  AnnotationLayer,
  AnnotationType,
  AnnotationEditorType,
} from "../../node_modules/pdfjs-dist/build/pdf.mjs";
import { getHighlightRectangles } from "../comments/highlight-comments.js";

// pdf.js treats annotationStorage keys with this prefix as new annotations
const ANNOTATION_EDITOR_PREFIX = "pdfjs_internal_editor_";

const DEFAULT_HIGHLIGHT_COLOR = [144, 238, 144]; // RGB, 0-255
const DEFAULT_HIGHLIGHT_OPACITY = 0.4;

/**
 * Turns arbitrary rects (PDF user space, `top > bottom`) into non-overlapping
 * line rects. (rects on the same line are unioned, and neighbouring lines are
 * trimmed so they do not overlap) */
function normalizeHighlightRects(rects) {
  const lines = [];

  for (const rect of [...rects].sort((a, b) => b.top - a.top)) {
    const line = lines.find((candidate) => {
      const overlap =
        Math.min(candidate.top, rect.top) -
        Math.max(candidate.bottom, rect.bottom);
      const smallest = Math.min(
        candidate.top - candidate.bottom,
        rect.top - rect.bottom,
      );
      return overlap > smallest / 2;
    });

    if (line) {
      line.top = Math.max(line.top, rect.top);
      line.bottom = Math.min(line.bottom, rect.bottom);
      line.rects.push(rect);
    } else {
      lines.push({ top: rect.top, bottom: rect.bottom, rects: [rect] });
    }
  }

  lines.sort((a, b) => b.top - a.top);
  for (let i = 0; i < lines.length - 1; i++) {
    const upper = lines[i];
    const lower = lines[i + 1];
    if (upper.bottom < lower.top) {
      const middle = (upper.bottom + lower.top) / 2;
      upper.bottom = middle;
      lower.top = middle;
    }
  }

  const result = [];
  for (const { top, bottom, rects: lineRects } of lines) {
    const spans = lineRects
      .map(({ left, right }) => [left, right])
      .sort((a, b) => a[0] - b[0]);

    let [left, right] = spans[0];
    for (const [nextLeft, nextRight] of spans.slice(1)) {
      if (nextLeft <= right + 1) {
        right = Math.max(right, nextRight);
      } else {
        result.push({ left, right, top, bottom });
        [left, right] = [nextLeft, nextRight];
      }
    }
    result.push({ left, right, top, bottom });
  }

  return result;
}

/**
 * Manages highlight annotations for a PdfViewer, rendering them with the
 * pdf.js AnnotationLayer.
 *
 * Owned by the viewer (`viewer.annotationManager`). The viewer calls
 * `renderAnnotationLayer()` after rendering a page and `destroyLayer()` when a
 * page is unloaded. */
export class AnnotationManager {
  constructor(host) {
    // The AnnotationHost object is an interface to the viewer.
    // getDocument
    //   The loaded document (null until the viewer has loaded it).
    // getScale
    //   Current zoom scale used to render pages.
    // getPageEntries
    //   Page number -> page entry ({ wrapper, canvas, page, rendered, textDivs, ... }).
    // rerenderPage
    //   Re-renders a page (canvas + layers).
    // store
    //   The AnnotationStore (overlay of user changes on the loaded document).
    this.host = host;
    this.store = host.store;

    this.highlights = new Map();
    this.nextHighlightId = 1;
    // No reload: the highlight already lives in annotationStorage and is drawn
    // by refreshPage(). The store only has to know the bytes are out of date.
    this.onHighlightsChanged = () => this.store.noteExternalChange();

    this.layers = new Map();
  }

  get documentPDF() {
    return this.host.getDocument();
  }

  /**
   * Creates a highlight annotation from the current text selection.
   * A selection spanning several pages creates one annotation per page.
   * Returns the ids of the created highlights (empty if nothing is selected).
   */
  addHighlightFromSelection({ clearSelection = true, ...options } = {}) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return [];
    }

    const range = selection.getRangeAt(0);
    const ids = [];

    for (const [pageNumber, entry] of this.host.getPageEntries()) {
      if (!entry.rendered || !entry.textDivs || !entry.page) continue;
      if (!range.intersectsNode(entry.wrapper)) continue;

      const wrapperRect = entry.wrapper.getBoundingClientRect();
      const viewport = entry.page.getViewport({ scale: this.host.getScale() });
      // Maps CSS pixels to viewport units (handles CSS transforms / browser zoom)
      const sx = viewport.width / wrapperRect.width;
      const sy = viewport.height / wrapperRect.height;

      const rects = [];

      for (const div of entry.textDivs) {
        const textNode = div.firstChild;
        if (textNode?.nodeType !== Node.TEXT_NODE) continue;
        if (!range.intersectsNode(div)) continue;

        // Clip the selection to this text node so rects hug the selected text
        const part = document.createRange();
        part.selectNodeContents(textNode);
        if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) {
          part.setStart(range.startContainer, range.startOffset);
        }
        if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) {
          part.setEnd(range.endContainer, range.endOffset);
        }

        for (const box of part.getClientRects()) {
          if (box.width <= 0 || box.height <= 0) continue;

          const [x1, y1] = viewport.convertToPdfPoint(
            (box.left - wrapperRect.left) * sx,
            (box.top - wrapperRect.top) * sy,
          );
          const [x2, y2] = viewport.convertToPdfPoint(
            (box.right - wrapperRect.left) * sx,
            (box.bottom - wrapperRect.top) * sy,
          );

          rects.push({
            left: Math.min(x1, x2),
            right: Math.max(x1, x2),
            bottom: Math.min(y1, y2),
            top: Math.max(y1, y2),
          });
        }
      }

      if (rects.length === 0) continue;

      const id = this.addHighlight(pageNumber, rects, options);
      if (id) ids.push(id);
    }

    if (ids.length > 0 && clearSelection) {
      selection.removeAllRanges();
    }

    return ids;
  }

  /**
   * Adds a highlight annotation to a page.
   * `rects` are in PDF user space: [{ left, right, top, bottom }] with top > bottom.
   * Returns the highlight id, or null if nothing could be added.
   */
  addHighlight(
    pageNumber,
    rects,
    {
      color = DEFAULT_HIGHLIGHT_COLOR,
      opacity = DEFAULT_HIGHLIGHT_OPACITY,
    } = {},
  ) {
    if (!this.host.getPageEntries().has(pageNumber) || !rects?.length)
      return null;

    const lineRects = normalizeHighlightRects(rects);

    // QuadPoints order used by pdf.js: top-left, top-right, bottom-left, bottom-right
    const quadPoints = [];
    // Outlines are the same rectangles as closed polygons, used for the canvas drawing
    const outlines = [];
    let left = Infinity;
    let bottom = Infinity;
    let right = -Infinity;
    let top = -Infinity;

    for (const rect of lineRects) {
      quadPoints.push(
        rect.left,
        rect.top,
        rect.right,
        rect.top,
        rect.left,
        rect.bottom,
        rect.right,
        rect.bottom,
      );
      outlines.push([
        rect.left,
        rect.top,
        rect.right,
        rect.top,
        rect.right,
        rect.bottom,
        rect.left,
        rect.bottom,
      ]);
      left = Math.min(left, rect.left);
      bottom = Math.min(bottom, rect.bottom);
      right = Math.max(right, rect.right);
      top = Math.max(top, rect.top);
    }

    const id = `user_highlight_${this.nextHighlightId++}`;
    const storageKey = `${ANNOTATION_EDITOR_PREFIX}${id}`;
    const rect = [left, bottom, right, top];

    this.documentPDF.annotationStorage.setValue(storageKey, {
      annotationType: AnnotationEditorType.HIGHLIGHT,
      color,
      opacity,
      quadPoints,
      outlines,
      rect,
      rotation: 0,
      pageIndex: pageNumber - 1,
      structTreeParentId: null,
    });

    this.highlights.set(id, {
      id,
      pageNumber,
      storageKey,
      color,
      opacity,
      rects: lineRects,
      // Same shape as the objects returned by page.getAnnotations(),
      // which is what AnnotationLayer.render() consumes
      data: {
        annotationType: AnnotationType.HIGHLIGHT,
        id,
        rect,
        quadPoints: new Float32Array(quadPoints),
        rotation: 0,
        color: new Uint8ClampedArray(color),
        opacity,
        hasAppearance: true,
        noHTML: false,
      },
    });

    this.refreshPage(pageNumber);
    this.onHighlightsChanged?.();

    return id;
  }

  deleteHighlight(id, pageNumber) {
    if (!this.highlights.delete(id)) return;
    this.refreshPage(pageNumber);
    this.onHighlightsChanged?.();
  }

  /**
   * Re-renders only the annotation layer of a page. The canvas is rendered
   * with AnnotationMode.DISABLE, so it never needs to be redrawn for this.
   */
  refreshPage(pageNumber) {
    const entry = this.host.getPageEntries().get(pageNumber);
    if (!entry?.rendered || !entry.page) return;

    this.destroyLayer(pageNumber);
    this.layers.get(pageNumber)?.div.replaceChildren();
    const viewport = entry.page.getViewport({ scale: this.host.getScale() });
    return this.renderAnnotationLayer(pageNumber, entry, entry.page, viewport);
  }

  /** Forget everything tied to the previous document (call on a full reload). */
  reset() {
    this.highlights.clear();
    this.layers.clear();
  }

  destroyLayer(pageNumber) {
    const state = this.layers.get(pageNumber);
    if (!state) return;

    state.token++;
    state.layer?.destroy();
    state.layer = null;
  }

  /**
   * Renders the pdf.js AnnotationLayer for a page: the highlight annotations
   * stored in the PDF plus the ones created through addHighlight().
   */
  async renderAnnotationLayer(pageNumber, entry, page, viewport) {
    let state = this.layers.get(pageNumber);

    if (!state) {
      const div = document.createElement("div");
      div.className = "annotationLayer";
      div.id = `annotation-layer-${pageNumber}`;
      div.style.zIndex = "3"; // above the text layer (2)
      entry.wrapper.appendChild(div);

      state = { div, layer: null, token: 0 };
      this.layers.set(pageNumber, state);
    }

    const { div } = state;

    div.style.setProperty("--scale-factor", viewport.scale);
    div.style.setProperty("--user-unit", page.userUnit);
    div.style.setProperty(
      "--total-scale-factor",
      viewport.scale * page.userUnit,
    );
    div.style.setProperty("--scale-round-x", "1px");
    div.style.setProperty("--scale-round-y", "1px");

    if (state.layer) {
      state.layer.update({ viewport });
      if (!state.highlightAnnotations) return;
      state.highlightRects = state.highlightAnnotations.map((annotation) =>
        getHighlightRectangles(annotation, viewport),
      );
      state.overlayRects = state.overlayAnnotations.map((annotation) =>
        getHighlightRectangles(annotation, viewport),
      );
      let overlayIndex = 0;
      for (const rectangles of state.overlayRects) {
        for (const rectangle of rectangles) {
          const overlay = state.highlightOverlays[overlayIndex++];
          overlay.style.left = `${rectangle.left}px`;
          overlay.style.top = `${rectangle.top}px`;
          overlay.style.width = `${rectangle.width}px`;
          overlay.style.height = `${rectangle.height}px`;
        }
      }
      return;
    }

    const token = ++state.token;

    const layer = new AnnotationLayer({
      div,
      page,
      viewport,
      annotationStorage: this.documentPDF.annotationStorage,
    });
    state.layer = layer;

    // File highlights with the user's edits applied (deleted ones dropped)
    const fromFile = (await page.getAnnotations({ intent: "display" }))
      .filter(
        (annotation) => annotation.annotationType === AnnotationType.HIGHLIGHT,
      )
      .map((annotation) => this.store.applyOverrides(pageNumber, annotation))
      .filter(Boolean);
    const created = [
      ...[...this.highlights.values()]
        .filter((highlight) => highlight.pageNumber === pageNumber)
        .map((highlight) => highlight.data),
      // Comments created in this session that are not in the loaded file
      ...this.store.getLocalHighlights(pageNumber),
    ];
    const commentIds = new Set(
      (await this.store.getPageComments(pageNumber)).map(
        (comment) => comment.id,
      ),
    );

    // The page was unloaded or refreshed while we were waiting
    if (token !== state.token) return;

    state.highlightAnnotations = [...fromFile, ...created]
      .filter((annotation) => !commentIds.has(annotation.id));
    state.overlayAnnotations = state.highlightAnnotations;
    state.highlightRects = state.highlightAnnotations.map((annotation) =>
      getHighlightRectangles(annotation, viewport),
    );
    state.overlayRects = state.overlayAnnotations.map((annotation) =>
      getHighlightRectangles(annotation, viewport),
    );
    state.highlightOverlays = [];

    await layer.render({
      annotations: [...fromFile, ...created].filter(
        (annotation) => !state.overlayAnnotations.includes(annotation),
      ),
    });

    if (state.highlightClickHandler) {
      entry.wrapper.removeEventListener("click", state.highlightClickHandler);
    }
    state.highlightClickHandler = (event) => {
      if (window.getSelection()?.isCollapsed === false) return;

      const wrapperRect = entry.wrapper.getBoundingClientRect();
      const x = event.clientX - wrapperRect.left;
      const y = event.clientY - wrapperRect.top;
      const selectedIndex = state.highlightRects.findIndex((rectangles) =>
        rectangles.some(
          (rectangle) =>
            x >= rectangle.left &&
            x <= rectangle.left + rectangle.width &&
            y >= rectangle.top &&
            y <= rectangle.top + rectangle.height,
        ),
      );

      if (selectedIndex !== -1) {
        event.stopPropagation();
        this.host.onHighlightClick?.({
          pageNumber,
          annotation: state.highlightAnnotations[selectedIndex],
          event,
        });
      }
    };
    entry.wrapper.addEventListener("click", state.highlightClickHandler);

    state.overlayAnnotations.forEach((annotation, annotationIndex) => {
      const rectangles = state.overlayRects[annotationIndex];
      for (const rectangle of rectangles) {
        const highlight = document.createElement("div");
        highlight.className = "pdf-highlight-overlay";
        const color = annotation.color || [144, 238, 144];
        highlight.style.backgroundColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.4)`;
        highlight.style.left = `${rectangle.left}px`;
        highlight.style.top = `${rectangle.top}px`;
        highlight.style.width = `${rectangle.width}px`;
        highlight.style.height = `${rectangle.height}px`;
        div.appendChild(highlight);
        state.highlightOverlays.push(highlight);
      }
    });

    // Highlights without a popup must not swallow clicks / text selection
    for (const section of div.querySelectorAll("section.highlightAnnotation")) {
      if (!section.classList.contains("popupTriggerArea")) {
        section.style.pointerEvents = "none";
      }
    }
  }
}
