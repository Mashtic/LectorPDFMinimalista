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
const DEFAULT_TEXT_BOX_COLOR = [0, 0, 0];
const DEFAULT_TEXT_BOX_FONT_SIZE = 12;

// annotationStorage key for "recolor this highlight that lives in the file"
const recolorStorageKey = (pageNumber, id) =>
  `${ANNOTATION_EDITOR_PREFIX}recolor_${pageNumber}_${id}`;

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
    this.textBoxes = new Map();
    this.textBoxOverrides = new Map();
    this.deletedTextBoxes = new Set();
    this.nextHighlightId = 1;
    this.nextTextBoxId = 1;
    // No reload: the highlight already lives in annotationStorage and is drawn
    // by refreshPage(). The store only has to know the bytes are out of date.
    this.onHighlightsChanged = () => this.store.noteExternalChange();

    this.layers = new Map();

    // "pageNumber:annotationId" -> [r, g, b] for highlights that come from
    // the file / store (session highlights are updated in place instead)
    this.colorOverrides = new Map();
    // "pageNumber:annotationId" for file highlights deleted by the user
    this.deletedFileHighlights = new Set();
    // Set by the UI layer; falls back to host.onHighlightClick
    this.onHighlightClick = null;
  }

  get documentPDF() {
    return this.host.getDocument();
  }

  addTextBox(pageNumber, rect, value = "Text") {
    if (!this.host.getPageEntries().has(pageNumber) || !rect) return null;

    const id = `user_text_box_${this.nextTextBoxId++}`;
    const storageKey = `${ANNOTATION_EDITOR_PREFIX}${id}`;
    const storageValue = {
      annotationType: AnnotationEditorType.FREETEXT,
      id,
      annotationElementId: id,
      color: DEFAULT_TEXT_BOX_COLOR,
      fontSize: DEFAULT_TEXT_BOX_FONT_SIZE,
      value,
      rect: [rect.left, rect.bottom, rect.right, rect.top],
      rotation: 0,
      pageIndex: pageNumber - 1,
      structTreeParentId: null,
    };

    this.documentPDF.annotationStorage.setValue(storageKey, storageValue);
    this.textBoxes.set(id, {
      id,
      pageNumber,
      storageKey,
      data: {
        ...storageValue,
        annotationType: AnnotationType.FREETEXT,
      },
    });
    this.refreshPage(pageNumber);
    this.onHighlightsChanged?.();
    return id;
  }

  updateTextBox(id, pageNumber, value) {
    const textBox = this.textBoxes.get(id);
    const state = this.layers.get(pageNumber);
    const storedOverride = this.textBoxOverrides.get(`${pageNumber}:${id}`);
    const annotation = {
      ...(textBox?.data ??
        state?.textBoxAnnotations?.find((candidate) => candidate.id === id) ??
        {}),
      ...storedOverride,
    };
    if (!annotation.id) return;

    const storageKey =
      textBox?.storageKey ?? `${ANNOTATION_EDITOR_PREFIX}${id}`;
    const storageValue = {
      annotationType: AnnotationEditorType.FREETEXT,
      id,
      annotationElementId: id,
      color: Array.from(annotation.color ?? DEFAULT_TEXT_BOX_COLOR),
      fontSize: annotation.fontSize ?? DEFAULT_TEXT_BOX_FONT_SIZE,
      value,
      rect: Array.from(annotation.rect),
      rotation: annotation.rotation ?? 0,
      pageIndex: pageNumber - 1,
      structTreeParentId: null,
    };

    this.documentPDF.annotationStorage.setValue(storageKey, storageValue);
    if (textBox) {
      textBox.data = {
        ...textBox.data,
        ...storageValue,
        annotationType: AnnotationType.FREETEXT,
      };
    } else {
      this.textBoxOverrides.set(`${pageNumber}:${id}`, storageValue);
      this.deletedTextBoxes.delete(`${pageNumber}:${id}`);
    }
    this.refreshPage(pageNumber);
    this.onHighlightsChanged?.();
  }

  moveTextBox(id, pageNumber, rect, refresh = true) {
    const textBox = this.textBoxes.get(id);
    const state = this.layers.get(pageNumber);
    const annotation = textBox?.data ??
      state?.textBoxAnnotations?.find((candidate) => candidate.id === id);
    if (!annotation || !rect) return;

    const storageKey =
      textBox?.storageKey ?? `${ANNOTATION_EDITOR_PREFIX}${id}`;
    const storageValue = {
      annotationType: AnnotationEditorType.FREETEXT,
      id,
      annotationElementId: id,
      color: Array.from(annotation.color ?? DEFAULT_TEXT_BOX_COLOR),
      fontSize: annotation.fontSize ?? DEFAULT_TEXT_BOX_FONT_SIZE,
      value:
        annotation.value ??
        annotation.contentsObj?.str ??
        annotation.contents ??
        "",
      rect: [rect.left, rect.bottom, rect.right, rect.top],
      rotation: annotation.rotation ?? 0,
      pageIndex: pageNumber - 1,
      structTreeParentId: null,
    };

    this.documentPDF.annotationStorage.setValue(storageKey, storageValue);
    if (textBox) {
      textBox.data = {
        ...textBox.data,
        ...storageValue,
        annotationType: AnnotationType.FREETEXT,
      };
    } else {
      this.textBoxOverrides.set(`${pageNumber}:${id}`, storageValue);
    }
    if (refresh) {
      this.refreshPage(pageNumber);
    } else {
      annotation.rect = storageValue.rect;
    }
    this.onHighlightsChanged?.();
  }

  resizeTextBox(id, pageNumber, rect) {
    this.moveTextBox(id, pageNumber, rect, false);
  }

  setTextBoxFontSize(id, pageNumber, fontSize) {
    const textBox = this.textBoxes.get(id);
    const state = this.layers.get(pageNumber);
    const annotation =
      textBox?.data ??
      state?.textBoxAnnotations?.find((candidate) => candidate.id === id);
    if (!annotation) return;

    const nextFontSize = Math.max(6, Math.min(72, fontSize));
    const storageKey =
      textBox?.storageKey ?? `${ANNOTATION_EDITOR_PREFIX}${id}`;
    const storageValue = {
      annotationType: AnnotationEditorType.FREETEXT,
      id,
      annotationElementId: id,
      color: Array.from(annotation.color ?? DEFAULT_TEXT_BOX_COLOR),
      fontSize: nextFontSize,
      value:
        annotation.value ??
        annotation.contentsObj?.str ??
        annotation.contents ??
        "",
      rect: Array.from(annotation.rect),
      rotation: annotation.rotation ?? 0,
      pageIndex: pageNumber - 1,
      structTreeParentId: null,
    };

    this.documentPDF.annotationStorage.setValue(storageKey, storageValue);
    if (textBox) {
      textBox.data = {
        ...textBox.data,
        ...storageValue,
        annotationType: AnnotationType.FREETEXT,
      };
      const renderedTextBox = this.host
        .getPageEntries()
        .get(pageNumber)
        ?.wrapper.querySelector(
          `.pdf-text-box[data-annotation-id="${CSS.escape(id)}"]`,
        );
      if (renderedTextBox) {
        const viewport = this.host
          .getPageEntries()
          .get(pageNumber)
          ?.page?.getViewport({ scale: this.host.getScale() });
        renderedTextBox.style.fontSize = `${
          nextFontSize * (viewport?.scale ?? 1)
        }px`;
      }
    } else {
      this.textBoxOverrides.set(`${pageNumber}:${id}`, storageValue);
    }
    this.onHighlightsChanged?.();
  }

  deleteTextBox(id, pageNumber) {
    const textBox = this.textBoxes.get(id);
    if (textBox) {
      this.textBoxes.delete(id);
      this.documentPDF.annotationStorage.remove(textBox.storageKey);
    } else {
      this.deletedTextBoxes.add(`${pageNumber}:${id}`);
      this.textBoxOverrides.delete(`${pageNumber}:${id}`);
      this.documentPDF.annotationStorage.setValue(
        `${ANNOTATION_EDITOR_PREFIX}${id}`,
        {
          id,
          deleted: true,
          pageIndex: pageNumber - 1,
          popupRef: "",
        },
      );
    }
    this.refreshPage(pageNumber);
    this.onHighlightsChanged?.();
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

    // Kept on the record so setHighlightColor() can update it later
    const storageValue = {
      annotationType: AnnotationEditorType.HIGHLIGHT,
      color,
      opacity,
      quadPoints,
      outlines,
      rect,
      rotation: 0,
      pageIndex: pageNumber - 1,
      structTreeParentId: null,
    };
    this.documentPDF.annotationStorage.setValue(storageKey, storageValue);

    this.highlights.set(id, {
      id,
      pageNumber,
      storageKey,
      storageValue,
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
    const created = this.highlights.get(id);

    if (created) {
      // Created in this session: it only exists in annotationStorage, so it
      // must be removed from there or it would still be saved into the PDF
      this.highlights.delete(id);
      this.documentPDF.annotationStorage.remove(created.storageKey);
      this.refreshPage(pageNumber);
      this.onHighlightsChanged?.();
      return;
    }

    // Comes from the file
    const key = `${pageNumber}:${id}`;
    this.deletedFileHighlights.add(key);
    this.colorOverrides.delete(key);
    // Drop a pending recolor so it is not saved for a deleted highlight
    this.documentPDF.annotationStorage.remove(
      recolorStorageKey(pageNumber, id),
    );
    // Writes the deletion into the PDF on the next flush
    this.store.deleteHighlight(pageNumber, id);
    this.refreshPage(pageNumber);
    this.onHighlightsChanged?.();
  }

  /** Changes the color of a highlight and redraws its page. */
  setHighlightColor(id, pageNumber, color) {
    const rgb = Array.from(color);
    const highlight = this.highlights.get(id);

    if (highlight) {
      // Created in this session: update the record and annotationStorage
      highlight.color = rgb;
      highlight.data.color = new Uint8ClampedArray(rgb);
      highlight.storageValue = { ...highlight.storageValue, color: rgb };
      this.documentPDF.annotationStorage.setValue(
        highlight.storageKey,
        highlight.storageValue,
      );
    } else {
      // Comes from the file
      const annotation = this.layers
        .get(pageNumber)
        ?.highlightAnnotations?.find((candidate) => candidate.id === id);
      if (!annotation?.quadPoints?.length) return;

      // What is drawn on screen
      this.colorOverrides.set(`${pageNumber}:${id}`, rgb);

      // What is saved: a storage entry carrying the annotation's id makes
      // pdf.js edit that annotation in place when the document is saved.
      // pdf.js quads are [left, top, right, top, left, bottom, right, bottom];
      // outlines are the same rectangles as closed polygons.
      const quadPoints = Array.from(annotation.quadPoints);
      const outlines = [];
      for (let i = 0; i + 7 < quadPoints.length; i += 8) {
        outlines.push([
          quadPoints[i],
          quadPoints[i + 1],
          quadPoints[i + 2],
          quadPoints[i + 3],
          quadPoints[i + 6],
          quadPoints[i + 7],
          quadPoints[i + 4],
          quadPoints[i + 5],
        ]);
      }

      this.documentPDF.annotationStorage.setValue(
        recolorStorageKey(pageNumber, id),
        {
          id,
          annotationType: AnnotationEditorType.HIGHLIGHT,
          color: rgb,
          opacity: annotation.opacity ?? DEFAULT_HIGHLIGHT_OPACITY,
          quadPoints,
          outlines,
          rect: Array.from(annotation.rect),
          rotation: 0,
          pageIndex: pageNumber - 1,
          structTreeParentId: null,
        },
      );
    }

    this.refreshPage(pageNumber);
    this.onHighlightsChanged?.();
  }

  /**
   * Re-renders only the annotation layer of a page. The canvas is rendered
   * with AnnotationMode.DISABLE, so it never needs to be redrawn for this.
   */
  async refreshPage(pageNumber) {
    const entry = this.host.getPageEntries().get(pageNumber);
    if (!entry?.rendered || !entry.page) return;

    this.destroyLayer(pageNumber);
    this.layers.get(pageNumber)?.div.replaceChildren();
    const viewport = entry.page.getViewport({ scale: this.host.getScale() });
    await this.renderAnnotationLayer(pageNumber, entry, entry.page, viewport);
    this.renderTextBoxLayer(pageNumber, entry, viewport);
  }

  /** Forget everything tied to the previous document (call on a full reload). */
  reset() {
    this.highlights.clear();
    this.textBoxes.clear();
    this.textBoxOverrides.clear();
    this.deletedTextBoxes.clear();
    this.nextTextBoxId = 1;
    this.layers.clear();
    this.colorOverrides.clear();
    this.deletedFileHighlights.clear();
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
    const annotations = await page.getAnnotations({ intent: "display" });
    const fromFile = annotations
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

    const isDeleted = (annotation) =>
      this.deletedFileHighlights.has(`${pageNumber}:${annotation.id}`);

    // Applies a color chosen through setHighlightColor() to file highlights
    const withColor = (annotation) => {
      const color = this.colorOverrides.get(`${pageNumber}:${annotation.id}`);
      return color
        ? { ...annotation, color: new Uint8ClampedArray(color) }
        : annotation;
    };

    state.highlightAnnotations = [...fromFile, ...created]
      .filter((annotation) => !commentIds.has(annotation.id))
      .filter((annotation) => !isDeleted(annotation))
      .map(withColor);
    state.overlayAnnotations = state.highlightAnnotations;
    state.highlightRects = state.highlightAnnotations.map((annotation) =>
      getHighlightRectangles(annotation, viewport),
    );
    state.overlayRects = state.overlayAnnotations.map((annotation) =>
      getHighlightRectangles(annotation, viewport),
    );
    state.textBoxAnnotations = annotations
      .filter(
        (annotation) =>
          annotation.annotationType === AnnotationType.FREETEXT &&
          !this.deletedTextBoxes.has(`${pageNumber}:${annotation.id}`),
      )
      .map(
        (annotation) =>
          this.textBoxOverrides.get(`${pageNumber}:${annotation.id}`)
            ? {
                ...annotation,
                ...this.textBoxOverrides.get(
                  `${pageNumber}:${annotation.id}`,
                ),
                contentsObj: {
                  str: this.textBoxOverrides.get(
                    `${pageNumber}:${annotation.id}`,
                  ).value,
                  dir: "ltr",
                },
              }
            : annotation,
      );
    state.textBoxAnnotations.push(
      ...[...this.textBoxes.values()]
        .filter((textBox) => textBox.pageNumber === pageNumber)
        .map((textBox) => textBox.data),
    );
    state.highlightOverlays = [];

    // pdf.js builds its own hover popup for any highlight that carries comment
    // text. The app shows comments through its own comment button, so the text
    // is stripped before the annotation is handed to pdf.js.
    const withoutPopup = (annotation) => ({
      ...annotation,
      contents: "",
      contentsObj: { str: "", dir: annotation.contentsObj?.dir ?? "ltr" },
      titleObj: { str: "", dir: annotation.titleObj?.dir ?? "ltr" },
      richText: null,
    });

    // Only comment highlights go through the pdf.js layer; everything else
    // is drawn by the overlays below
    await layer.render({
      annotations: [...fromFile, ...created]
        .filter((annotation) => commentIds.has(annotation.id))
        .map(withoutPopup),
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
        (this.onHighlightClick ?? this.host.onHighlightClick)?.({
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

  renderTextBoxLayer(pageNumber, entry, viewport) {
    const layer = entry.wrapper?.textBoxLayer;
    const state = this.layers.get(pageNumber);
    if (!layer || !state?.textBoxAnnotations) return;

    layer.replaceChildren();
    layer.style.width = `${viewport.width}px`;
    layer.style.height = `${viewport.height}px`;
    layer.style.pointerEvents = "none";

    for (const annotation of state.textBoxAnnotations) {
      const rectangles = getHighlightRectangles(annotation, viewport);
      const rectangle = rectangles[0];
      if (!rectangle) continue;

      const textBox = document.createElement("div");
      textBox.className = "pdf-text-box";
      textBox.dataset.annotationId = annotation.id;
      textBox.textContent =
        annotation.value ??
        annotation.contentsObj?.str ??
        annotation.contents ??
        "";
      textBox.style.left = `${rectangle.left}px`;
      textBox.style.top = `${rectangle.top}px`;
      textBox.style.width = `${Math.max(rectangle.width, 40)}px`;
      textBox.style.height = `${Math.max(rectangle.height, 24)}px`;
      const color =
        annotation.color ??
        annotation.defaultAppearanceData?.fontColor ??
        DEFAULT_TEXT_BOX_COLOR;
      textBox.style.color = `rgb(${Array.from(color).join(",")})`;
      const fontSize =
        annotation.fontSize ??
        annotation.defaultAppearanceData?.fontSize ??
        DEFAULT_TEXT_BOX_FONT_SIZE;
      textBox.style.fontSize = `${fontSize * viewport.scale}px`;
      textBox.style.pointerEvents = "auto";
      textBox.contentEditable = "false";
      const textTools = document.createElement("span");
      textTools.className = "pdf-text-box-tools";
      textTools.hidden = true;
      textTools.contentEditable = "false";
      const positionTextTools = () => {
        const bounds = textBox.getBoundingClientRect();
        textTools.style.left = `${bounds.right - textTools.offsetWidth}px`;
        textTools.style.top = `${bounds.top - textTools.offsetHeight - 4}px`;
      };
      const createTextTool = (label, icon, onPress) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pdf-text-box-tool";
        button.title = label;
        button.setAttribute("aria-label", label);
        button.innerHTML = icon;
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          onPress();
        });
        return button;
      };
      const decreaseTextButton = createTextTool(
        "Disminuir texto",
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10"/></svg>',
        () => {
          const nextFontSize = Math.max(
            6,
            Number.parseFloat(textBox.style.fontSize) / viewport.scale - 1,
          );
          textBox.style.fontSize = `${nextFontSize * viewport.scale}px`;
          positionTextTools();
          this.setTextBoxFontSize(annotation.id, pageNumber, nextFontSize);
        },
      );
      const increaseTextButton = createTextTool(
        "Aumentar texto",
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M8 3v10"/></svg>',
        () => {
          const nextFontSize = Math.min(
            72,
            Number.parseFloat(textBox.style.fontSize) / viewport.scale + 1,
          );
          textBox.style.fontSize = `${nextFontSize * viewport.scale}px`;
          positionTextTools();
          this.setTextBoxFontSize(annotation.id, pageNumber, nextFontSize);
        },
      );
      const deleteTextButton = createTextTool(
        "Borrar caja de texto",
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6 4.5V3h4v1.5M5 6.5v5.5h6V6.5M7 7.5v3M9 7.5v3"/></svg>',
        () => {
          this.deleteTextBox(annotation.id, pageNumber);
        },
      );
      textTools.append(
        decreaseTextButton,
        increaseTextButton,
        deleteTextButton,
      );
      let dragStart = null;
      let hasDragged = false;
      let resizeStart = null;
      const scrollContainer = entry.wrapper.closest("#pdf-viewer-container");
      const handleDragScroll = () => {
        if (dragStart) {
          updateDragPosition(dragStart.clientX, dragStart.clientY);
        }
      };
      const updateDragPosition = (clientX, clientY) => {
        if (!dragStart) return;

        const wrapperBounds = entry.wrapper.getBoundingClientRect();
        const left = Math.max(
          0,
          Math.min(
            viewport.width - dragStart.width,
            clientX - wrapperBounds.left - dragStart.grabOffsetX,
          ),
        );
        const top = Math.max(
          0,
          Math.min(
            viewport.height - dragStart.height,
            clientY - wrapperBounds.top - dragStart.grabOffsetY,
          ),
        );
        textBox.style.left = `${left}px`;
        textBox.style.top = `${top}px`;
      };
      const resizeHandle = document.createElement("span");
      resizeHandle.className = "pdf-text-box-resize-handle";
      resizeHandle.setAttribute("aria-label", "Resize text box");
      resizeHandle.contentEditable = "false";

      resizeHandle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || textBox.contentEditable !== "true") return;

        event.stopPropagation();
        resizeStart = {
          clientX: event.clientX,
          clientY: event.clientY,
          left: rectangle.left,
          top: rectangle.top,
        };
        resizeHandle.setPointerCapture?.(event.pointerId);
      });
      resizeHandle.addEventListener("pointermove", (event) => {
        if (!resizeStart) return;

        const top = resizeStart.top;
        const pointerRight =
          event.clientX - entry.wrapper.getBoundingClientRect().left;
        const pointerBottom =
          event.clientY - entry.wrapper.getBoundingClientRect().top;
        const nextWidth = Math.max(1, pointerRight - resizeStart.left);
        const nextHeight = Math.max(1, pointerBottom - top);
        Object.assign(textBox.style, {
          left: `${resizeStart.left}px`,
          top: `${top}px`,
          width: `${nextWidth}px`,
          height: `${nextHeight}px`,
        });
      });
      resizeHandle.addEventListener("pointerup", (event) => {
        if (!resizeStart) return;

        const pageBounds = entry.wrapper.getBoundingClientRect();
        const left = resizeStart.left;
        const top = resizeStart.top;
        const pointerRight = Math.min(
          viewport.width,
          Math.max(left + 1, event.clientX - pageBounds.left),
        );
        const pointerBottom = Math.min(
          viewport.height,
          Math.max(top + 1, event.clientY - pageBounds.top),
        );
        const nextWidth = pointerRight - left;
        const nextHeight = pointerBottom - top;
        const right = left + nextWidth;
        const bottom = top + nextHeight;
        const [leftX, topY] = viewport.convertToPdfPoint(left, top);
        const [rightX, bottomY] = viewport.convertToPdfPoint(
          right,
          bottom,
        );
        this.resizeTextBox(annotation.id, pageNumber, {
          left: Math.min(leftX, rightX),
          right: Math.max(leftX, rightX),
          top: Math.max(topY, bottomY),
          bottom: Math.min(topY, bottomY),
        });
        positionTextTools();
        resizeStart = null;
      });
      textBox.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || textBox.contentEditable === "true") return;

        const textBoxBounds = textBox.getBoundingClientRect();
        dragStart = {
          clientX: event.clientX,
          clientY: event.clientY,
          width: textBoxBounds.width,
          height: textBoxBounds.height,
          grabOffsetX: event.clientX - textBoxBounds.left,
          grabOffsetY: event.clientY - textBoxBounds.top,
        };
        hasDragged = false;
        scrollContainer?.addEventListener("scroll", handleDragScroll);
        textBox.setPointerCapture?.(event.pointerId);
      });
      textBox.addEventListener("pointermove", (event) => {
        if (!dragStart) return;

        const offsetX = event.clientX - dragStart.clientX;
        const offsetY = event.clientY - dragStart.clientY;
        if (Math.hypot(offsetX, offsetY) < 3) return;

        hasDragged = true;
        updateDragPosition(event.clientX, event.clientY);
      });
      textBox.addEventListener("pointerup", (event) => {
        if (!dragStart) return;
        if (!hasDragged) {
          scrollContainer?.removeEventListener("scroll", handleDragScroll);
          dragStart = null;
          return;
        }

        updateDragPosition(event.clientX, event.clientY);
        const wrapperBounds = entry.wrapper.getBoundingClientRect();
        const boxBounds = textBox.getBoundingClientRect();
        const left = boxBounds.left - wrapperBounds.left;
        const top = boxBounds.top - wrapperBounds.top;
        const [leftX, topY] = viewport.convertToPdfPoint(left, top);
        const [rightX, bottomY] = viewport.convertToPdfPoint(
          left + dragStart.width,
          top + dragStart.height,
        );
        this.moveTextBox(annotation.id, pageNumber, {
          left: Math.min(leftX, rightX),
          right: Math.max(leftX, rightX),
          top: Math.max(topY, bottomY),
          bottom: Math.min(topY, bottomY),
        }, false);
        scrollContainer?.removeEventListener("scroll", handleDragScroll);
        dragStart = null;
        hasDragged = false;
      });
      textBox.addEventListener("pointercancel", () => {
        scrollContainer?.removeEventListener("scroll", handleDragScroll);
        dragStart = null;
        hasDragged = false;
      });
      const placeCaretAtEnd = () => {
        const selection = window.getSelection();
        const range = document.createRange();
        const walker = document.createTreeWalker(textBox, NodeFilter.SHOW_TEXT);
        let lastTextNode = null;
        let textNode;
        while ((textNode = walker.nextNode())) {
          lastTextNode = textNode;
        }
        if (!lastTextNode) return;
        range.setStart(lastTextNode, lastTextNode.textContent.length);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
      };
      const getTextValue = () => {
        const content = textBox.cloneNode(true);
        content.querySelector(".pdf-text-box-tools")?.remove();
        content.querySelector(".pdf-text-box-resize-handle")?.remove();
        return content.textContent ?? "";
      };
      textBox.addEventListener("dblclick", () => {
        const wasEditing = textBox.contentEditable === "true";
        textBox.contentEditable = "true";
        textTools.hidden = false;
        positionTextTools();
        textBox.focus();
        if (!wasEditing) {
          placeCaretAtEnd();
        }
      });
      textBox.addEventListener("blur", () => {
        textBox.contentEditable = "false";
        textTools.hidden = true;
        this.updateTextBox(annotation.id, pageNumber, getTextValue());
      });
      textBox.append(textTools, resizeHandle);
      layer.appendChild(textBox);
    }
  }
}
