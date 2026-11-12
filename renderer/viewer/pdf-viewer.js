import {
  AnnotationMode,
  GlobalWorkerOptions,
  getDocument,
  TextLayer,
  AnnotationLayer,
  AnnotationType,
} from "../../node_modules/pdfjs-dist/build/pdf.mjs";
import { SimpleLinkService } from "../../node_modules/pdfjs-dist/web/pdf_viewer.mjs";
import { createZoomState, setZoom, zoomIn, zoomOut } from "../zoom/zoom.js";
import {
  getAnnotationText,
  getHighlightRectangles,
  isCommentable,
  showCommentPopup,
  closeCommentPopup,
  showCommentTooltip,
  hideCommentTooltip,
  isCommentPopupOpen,
} from "../comments/highlight-comments.js";
import { AnnotationManager } from "./annotation-manager.js";
import { annotationStore } from "../comments/annotation-store.js";

GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

const ANNOTATION_EDITOR_PREFIX = "pdfjs_internal_editor_";

// Space kept above an outline target so it is not hidden by the page counter
const JUMP_TOP_MARGIN = 56;

export class PdfViewer {
  constructor(pdfData, currentPage = 1) {
    this.dataPDF = pdfData;
    this.documentPDF = null;
    this.currentPage = currentPage;
    this.previousPage = 0;
    this.zoomState = createZoomState({ scale: 1 });
    this.pages = new Map();
    this.onTextLayerRendered = null;
    this.onTextLayerUnloaded = null;
    this.onCurrentPageChanged = null;

    this.observers = [];
    this.linkService = new SimpleLinkService();

    // This is here if we want to perform and action when a PDF is modified
    // but not saved, like showing a message asking the user if they want to
    // save before closing and such.
    this.onDocumentModified = null;

    this.annotationStore = annotationStore;
    this.annotationStore.addEventListener("change", (event) => {
      const { pageNumber } = event.detail;
      if (pageNumber) this.refreshPageLayers(pageNumber);
      if (this.annotationStore.isDirty) this.onDocumentModified?.();
    });

    this.annotationManager = new AnnotationManager({
      store: this.annotationStore,
      getDocument: () => this.documentPDF,
      getScale: () => this.scale,
      getPageEntries: () => this.pages,
      rerenderPage: (pageNumber) => {
        const entry = this.pages.get(pageNumber);
        if (entry) this.renderPage(pageNumber, entry.canvas);
      },
      onHighlightClick: (details) => this.showHighlightPopup(details),
    });
  }

  get scale() {
    return this.zoomState.scale;
  }

  async load() {
    this.dataPDF =
      this.dataPDF instanceof Uint8Array
        ? this.dataPDF
        : new Uint8Array(this.dataPDF);
    this.loadingTask = getDocument({ data: this.dataPDF.slice() });
    this.documentPDF = await this.loadingTask.promise;
    this.linkService.setDocument(this.documentPDF);
    this.annotationStore.attach(this.documentPDF, this.dataPDF);
    await this.renderPages();
    this.setupObservers();
    this.updateCurrentPage();
  }

  updateCurrentPage() {
    const elements = document.elementsFromPoint(
      document.body.offsetWidth / 2,
      document.body.offsetHeight / 2,
    );

    const canvas = elements.find((element) => element.tagName === "CANVAS");

    if (!canvas) return;

    this.currentPage = Number(canvas.dataset.pageNumber);

    if (this.currentPage == this.previousPage) return;

    const counter = document.getElementById("pdf-page-count");
    counter.value = `${this.currentPage}`;

    const totalPages = document.getElementById("pdf-total-pages");
    totalPages.innerHTML = ` / ${this.documentPDF.numPages}`;

    this.previousPage = this.currentPage;
    window.electronAPI.setGlobalVar("currentPage", this.currentPage);
    this.onCurrentPageChanged?.(this.currentPage);
  }

  skipUp() {
    if (this.currentPage <= 1) return;

    this.currentPage--;
    this.jumpToPage(this.currentPage);
  }

  skipDown() {
    if (this.currentPage >= this.documentPDF.numPages) return;

    this.currentPage++;
    this.jumpToPage(this.currentPage);
  }

  jumpToPage(pageNumber) {
    if (pageNumber <= 0 || pageNumber > this.documentPDF.numPages) return;

    const targetDiv = this.pages.get(pageNumber).wrapper;
    if (!targetDiv) return;

    targetDiv.scrollIntoView();

    this.updateCurrentPage();
  }

  jumpToPagePosition(pageNumber, pdfTop) {
    const entry = this.pages.get(pageNumber);

    if (pdfTop === null || pdfTop === undefined || !entry?.page) {
      this.jumpToPage(pageNumber);
      return;
    }

    const viewport = entry.page.getViewport({ scale: this.scale });
    const [, offsetInPage] = viewport.convertToViewportPoint(0, pdfTop);

    const container = document.getElementById("pdf-viewer-container");
    const pageOffset =
      entry.wrapper.getBoundingClientRect().top -
      container.getBoundingClientRect().top;

    container.scrollTop += pageOffset + offsetInPage - JUMP_TOP_MARGIN;

    this.updateCurrentPage();
  }

  async getHighlightComments() {
    const comments = [];

    for (let number = 1; number <= this.documentPDF.numPages; number++) {
      for (const comment of await this.annotationStore.getPageComments(
        number,
      )) {
        comments.push({
          pageNumber: number,
          id: comment.id,
          text: comment.text,
          author: comment.author,
          created: comment.created,
          modified: comment.modified,
        });
      }
    }

    return comments;
  }

  async editHighlightComment(pageNumber, annotationId, text) {
    this.annotationStore.setCommentText(pageNumber, annotationId, text);
  }

  async deleteHighlightComment(pageNumber, annotationId) {
    if (annotationId.startsWith("user_highlight_")) {
      this.annotationManager.deleteHighlight(annotationId, pageNumber);
    }
    this.annotationStore.deleteHighlight(pageNumber, annotationId);
  }

  async showHighlightPopup({ pageNumber, annotation, event }) {
    const comment = (
      await this.annotationStore.getPageComments(pageNumber)
    ).find((entry) => entry.id === annotation.id);

    showCommentPopup({
      x: event.clientX,
      y: event.clientY,
      text: comment?.text || "",
      author: comment?.author || "",
      created: comment?.created || "",
      modified: comment?.modified || "",
      allowEdit: Boolean(comment?.text),
      onSave: (newText) =>
        this.editHighlightComment(pageNumber, annotation.id, newText),
      onDelete: () => this.deleteHighlightComment(pageNumber, annotation.id),
    });
  }

  async getCurrentPDF() {
    const bytes = await this.annotationStore.getBytes();
    return this.applyFormValues(bytes);
  }

  getFormValues() {
    const map = this.documentPDF?.annotationStorage.serializable.map;
    if (!map) return [];
    return [...map]
      .filter(([key]) => !key.startsWith(ANNOTATION_EDITOR_PREFIX))
      .map(([key, value]) => [key, { ...value }]);
  }

  async applyFormValues(bytes) {
    const entries = this.getFormValues();
    if (entries.length === 0) return bytes;

    const base = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const task = getDocument({ data: base.slice() });
    try {
      const doc = await task.promise;
      for (const [key, value] of entries) {
        doc.annotationStorage.setValue(key, value);
      }
      return await doc.saveDocument();
    } finally {
      task.destroy();
    }
  }

  async refreshPageLayers(pageNumber) {
    const entry = this.pages.get(pageNumber);
    if (!entry?.rendered || !entry.page) return;

    const viewport = entry.page.getViewport({ scale: this.scale });
    await this.annotationManager.refreshPage(pageNumber);
    this.annotationManager.renderTextBoxLayer(pageNumber, entry, viewport);
    await this.renderHighlightCommentLayer(
      entry.page,
      viewport,
      entry,
      pageNumber,
    );
  }

  async commitPDFChange(updatedDataPDF) {
    const container = document.getElementById("pdf-viewer-container");
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;

    closeCommentPopup();
    const formValues = this.getFormValues();
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];

    for (const entry of this.pages.values()) {
      entry.renderTask?.cancel();
    }

    const previousLoadingTask = this.loadingTask;

    this.dataPDF = new Uint8Array(updatedDataPDF);
    this.loadingTask = getDocument({ data: this.dataPDF.slice() });
    this.documentPDF = await this.loadingTask.promise;
    this.linkService.setDocument(this.documentPDF);
    this.annotationManager.reset();
    this.annotationStore.attach(this.documentPDF, this.dataPDF);
    for (const [key, value] of formValues) {
      this.documentPDF.annotationStorage.setValue(key, value);
    }

    document.querySelector("#pdf-viewer-list").replaceChildren();
    this.pages.clear();
    this.previousPage = 0;

    await this.renderPages();
    this.setupObservers();

    container.scrollTop = scrollTop;
    container.scrollLeft = scrollLeft;
    this.updateCurrentPage();

    try {
      await window.electronAPI.setGlobalVar("currentPDF", this.dataPDF);
    } catch (error) {
      console.error("Failed to update currentPDF:", error);
    }

    this.onDocumentModified?.(this.dataPDF);

    try {
      await previousLoadingTask?.destroy();
    } catch (error) {
      console.warn("Failed to destroy previous PDF loading task:", error);
    }
  }

  async renderHighlightCommentLayer(page, viewport, entry, pageNumber) {
    const layer = entry.wrapper?.highlightCommentLayer;

    if (!layer) {
      return;
    }

    const comments = await this.annotationStore.getPageComments(pageNumber);

    layer.replaceChildren();
    layer.style.width = `${viewport.width}px`;
    layer.style.height = `${viewport.height}px`;

    for (const comment of comments) {
      const { text, author, annotation } = comment;
      const rectangles = getHighlightRectangles(annotation, viewport);

      if (!rectangles.length) {
        continue;
      }

      const top = Math.min(...rectangles.map((rectangle) => rectangle.top));
      const right = Math.max(
        ...rectangles.map((rectangle) => rectangle.left + rectangle.width),
      );
      const size = 20;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "highlight-comment-button";
      button.setAttribute("aria-label", "Comment");
      button.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>';

      button.style.position = "absolute";
      button.style.pointerEvents = "auto";
      button.style.width = `${size}px`;
      button.style.height = `${size}px`;
      button.style.left = `${Math.max(0, Math.min(right + 4, viewport.width - size))}px`;
      button.style.top = `${Math.max(0, top - size / 2)}px`;

      button.addEventListener("mouseenter", () => {
        if (isCommentPopupOpen()) {
          return;
        }

        const box = button.getBoundingClientRect();
        showCommentTooltip({ x: box.left, y: box.bottom + 6, text, author });
      });

      button.addEventListener("mouseleave", hideCommentTooltip);

      button.addEventListener("click", (event) => {
        event.stopPropagation();
        hideCommentTooltip();

        const box = button.getBoundingClientRect();

        showCommentPopup({
          x: box.left,
          y: box.bottom + 6,
          text,
          author,
          created: comment.created,
          modified: comment.modified,
          onSave: (newText) =>
            this.editHighlightComment(pageNumber, comment.id, newText),
          onDelete: () => this.editHighlightComment(pageNumber, comment.id, ""),
        });
      });

      layer.appendChild(button);
    }
  }

  zoomInPages() {
    this.zoomKeepingCenter(() => zoomIn(this.zoomState));
  }

  zoomOutPages() {
    this.zoomKeepingCenter(() => zoomOut(this.zoomState));
  }

  resetZoom() {
    this.zoomKeepingCenter(() => setZoom(this.zoomState, 1));
  }

  zoomKeepingCenter(applyZoom) {
    const container = document.getElementById("pdf-viewer-container");
    const centerX =
      (container.scrollLeft + container.clientWidth / 2) /
      container.scrollWidth;
    const centerY =
      (container.scrollTop + container.clientHeight / 2) /
      container.scrollHeight;

    applyZoom();
    this.rerenderVisiblePages();

    container.scrollLeft =
      centerX * container.scrollWidth - container.clientWidth / 2;
    container.scrollTop =
      centerY * container.scrollHeight - container.clientHeight / 2;
  }

  fitWidth(maxWidth) {
    const firstPage = this.pages.get(1);
    if (!firstPage || firstPage.wrapper.offsetWidth <= maxWidth) {
      return;
    }
    const scale = (this.scale * maxWidth) / firstPage.wrapper.offsetWidth;
    setZoom(this.zoomState, scale);
    this.rerenderVisiblePages();
  }

  zoomAtPoint(clientX, clientY, direction) {
    const wrapper = document
      .elementFromPoint(clientX, clientY)
      ?.closest(".pdf-page");
    if (!wrapper) {
      if (direction === "in") this.zoomInPages();
      else this.zoomOutPages();
      return;
    }

    const rectBefore = wrapper.getBoundingClientRect();
    const fracX = (clientX - rectBefore.left) / rectBefore.width;
    const fracY = (clientY - rectBefore.top) / rectBefore.height;

    if (direction === "in") {
      this.zoomInPages();
    } else {
      this.zoomOutPages();
    }

    const container = document.getElementById("pdf-viewer-container");
    const rectAfter = wrapper.getBoundingClientRect();
    const targetClientX = rectAfter.left + fracX * rectAfter.width;
    const targetClientY = rectAfter.top + fracY * rectAfter.height;

    container.scrollLeft += targetClientX - clientX;
    container.scrollTop += targetClientY - clientY;
  }

  resizePageLayout(pageNumber, entry) {
    if (!entry.page) {
      return;
    }

    const viewport = entry.page.getViewport({ scale: this.scale });

    if (entry.wrapper) {
      entry.wrapper.style.width = `${viewport.width}px`;
      entry.wrapper.style.height = `${viewport.height}px`;
    }

    this.setFormLayerScale(entry, viewport);
  }

  rerenderVisiblePages() {
    for (const [pageNumber, entry] of this.pages) {
      if (entry.rendered) {
        this.resizePageLayout(pageNumber, entry);
        this.renderPage(pageNumber, entry.canvas);
      }
    }
  }

  async renderTextLayer(page, viewport, entry, pageNumber) {
    if (entry.textLayerInstance) {
      entry.textLayer.style.setProperty("--scale-factor", viewport.scale);
      entry.textLayer.style.width = `${viewport.width}px`;
      entry.textLayer.style.height = `${viewport.height}px`;

      entry.textLayerInstance.update({ viewport });
      this.onTextLayerRendered?.(pageNumber);
      return;
    }

    const textContent = await page.getTextContent();
    const textLayer =
      entry.textLayer || document.getElementById(`text-layer-${pageNumber}`);

    textLayer.replaceChildren();
    textLayer.style.setProperty("--scale-factor", viewport.scale);
    textLayer.style.width = `${viewport.width}px`;
    textLayer.style.height = `${viewport.height}px`;

    const layer = new TextLayer({
      textContentSource: textContent,
      viewport,
      container: textLayer,
    });

    entry.textLayer = textLayer;
    entry.textDivs = layer.textDivs;
    entry.textLayerInstance = layer;

    await layer.render();

    this.onTextLayerRendered?.(pageNumber);
  }

  async renderFormAppearances(page, viewport) {
    const annotationCanvasMap = new Map();
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    try {
      await page.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
        annotationMode: AnnotationMode.ENABLE_FORMS,
        annotationCanvasMap,
      }).promise;
      return annotationCanvasMap;
    } catch (error) {
      // The CSS fallback marks are used instead
      console.warn("Could not render form field appearances:", error);
      return null;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  /*
   * The page canvas is drawn without annotations, because highlights and form
   * fields live in their own layers. A visible signature is an annotation too,
   * but pdf.js only ever paints it on a canvas, so it would never show. The
   * page is drawn once more off screen with annotations on, and only the
   * rectangles of the signatures are copied over the page.
   */
  async paintSignatureAppearances(page, viewport, canvas, entry) {
    if (!entry.signatureWidgets) {
      entry.signatureWidgets = (
        await page.getAnnotations({ intent: "display" })
      ).filter(
        (annotation) =>
          annotation.annotationType === AnnotationType.WIDGET &&
          annotation.fieldType === "Sig" &&
          annotation.hasAppearance &&
          annotation.rect[0] !== annotation.rect[2] &&
          annotation.rect[1] !== annotation.rect[3],
      );
    }

    if (entry.signatureWidgets.length === 0) return;

    const offscreen = document.createElement("canvas");
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;

    try {
      await page.render({
        canvasContext: offscreen.getContext("2d"),
        viewport,
        annotationMode: AnnotationMode.ENABLE_FORMS,
      }).promise;

      // A newer render of this page may have resized the canvas meanwhile
      if (offscreen.width !== canvas.width) return;

      const context = canvas.getContext("2d");

      for (const { rect } of entry.signatureWidgets) {
        const [x1, y1] = viewport.convertToViewportPoint(rect[0], rect[1]);
        const [x2, y2] = viewport.convertToViewportPoint(rect[2], rect[3]);
        const left = Math.max(Math.floor(Math.min(x1, x2)), 0);
        const top = Math.max(Math.floor(Math.min(y1, y2)), 0);
        const width = Math.min(Math.ceil(Math.abs(x2 - x1)) + 1, canvas.width - left);
        const height = Math.min(Math.ceil(Math.abs(y2 - y1)) + 1, canvas.height - top);

        if (width <= 0 || height <= 0) continue;

        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.drawImage(
          offscreen,
          left,
          top,
          width,
          height,
          left,
          top,
          width,
          height,
        );
        context.restore();
      }
    } finally {
      offscreen.width = 0;
      offscreen.height = 0;
    }
  }

  setFormLayerScale(entry, viewport) {
    const layer = entry.wrapper?.annotationLayer;
    if (!layer || !entry.page) return;

    layer.style.setProperty("--scale-factor", viewport.scale);
    layer.style.setProperty("--user-unit", entry.page.userUnit);
    layer.style.setProperty(
      "--total-scale-factor",
      viewport.scale * entry.page.userUnit,
    );
    layer.style.setProperty("--scale-round-x", "1px");
    layer.style.setProperty("--scale-round-y", "1px");
  }

  swapFormAppearances(layerDiv, annotationCanvasMap) {
    for (const [id, value] of annotationCanvasMap) {
      const element = layerDiv.querySelector(`[data-annotation-id="${id}"]`);
      if (!element) continue;

      for (const canvas of Array.isArray(value) ? value : [value]) {
        canvas.className = "annotationContent";
        canvas.ariaHidden = true;
        const name = canvas.getAttribute("data-canvas-name");
        const previous = name
          ? element.querySelector(`canvas[data-canvas-name="${name}"]`)
          : element.querySelector("canvas.annotationContent");
        previous?.replaceWith(canvas);
      }
    }
  }

  renderAnnotationLayer(page, viewport, entry) {
    if (!entry.wrapper?.annotationLayer) return Promise.resolve();

    const token = (entry.formLayerToken ?? 0) + 1;
    entry.formLayerToken = token;

    const job = (entry.formLayerJob ?? Promise.resolve())
      .catch(() => {})
      .then(() => this.#renderFormLayer(page, viewport, entry, token));
    entry.formLayerJob = job;
    return job;
  }

  async #renderFormLayer(page, viewport, entry, token) {
    const annotationLayer = entry.wrapper.annotationLayer;
    const isStale = () => token !== entry.formLayerToken;

    if (isStale() || entry.noFormFields) return;

    if (entry.annotationLayerInstance) {
      this.setFormLayerScale(entry, viewport);

      if (entry.hasFormAppearances) {
        const annotationCanvasMap = await this.renderFormAppearances(
          page,
          viewport,
        );
        if (annotationCanvasMap && !isStale()) {
          this.swapFormAppearances(annotationLayer, annotationCanvasMap);
        }
      }
      return;
    }

    const annotations = (
      await page.getAnnotations({ intent: "display" })
    ).filter(
      (annotation) => annotation.annotationType === AnnotationType.WIDGET,
    );

    if (isStale()) return;

    if (annotations.length === 0) {
      entry.noFormFields = true;
      return;
    }

    entry.hasFormAppearances = annotations.some(
      (annotation) => annotation.checkBox || annotation.radioButton,
    );
    const annotationCanvasMap = entry.hasFormAppearances
      ? await this.renderFormAppearances(page, viewport)
      : null;

    if (isStale()) return;

    annotationLayer.replaceChildren();

    annotationLayer.style.zIndex = "4";
    this.setFormLayerScale(entry, viewport);

    if (!annotationLayer.dataset.formListeners) {
      annotationLayer.dataset.formListeners = "true";
      const markModified = () => this.onDocumentModified?.();
      annotationLayer.addEventListener("input", markModified);
      annotationLayer.addEventListener("change", markModified);
    }

    const annotationViewport = viewport.clone({ dontFlip: true });

    const layer = new AnnotationLayer({
      div: annotationLayer,
      page,
      viewport: annotationViewport,
      accessibilityManager: null,
      annotationCanvasMap,
      linkService: this.linkService,
      annotationStorage: this.documentPDF.annotationStorage,
    });

    await layer.render({
      annotations,
      viewport: annotationViewport,
      renderForms: true,
      annotationStorage: this.documentPDF.annotationStorage,
      linkService: this.linkService,
    });

    if (isStale()) {
      layer.destroy?.();
      return;
    }

    for (const section of annotationLayer.querySelectorAll("section")) {
      section.style.pointerEvents = "auto";
    }

    entry.annotationLayerInstance = layer;
  }

  renderPage(pageNumber, canvas) {
    const entry = this.pages.get(pageNumber) || {};

    if (entry.isRendering) {
      entry.renderPending = true;
      return;
    }

    entry.isRendering = true;
    entry.renderPending = false;
    this.pages.set(pageNumber, entry);

    this.documentPDF.getPage(pageNumber).then((page) => {
      entry.page = page;
      const canvasContext = canvas.getContext("2d");

      const viewport = page.getViewport({
        scale: this.scale,
      });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      if (entry.wrapper) {
        entry.wrapper.style.width = `${viewport.width}px`;
        entry.wrapper.style.height = `${viewport.height}px`;
      }

      const renderContext = {
        canvasContext: canvasContext,
        viewport,
        annotationMode: AnnotationMode.DISABLE,
      };

      const renderTask = page.render(renderContext);
      entry.renderTask = renderTask;
      entry.rendered = true;

      this.pages.set(pageNumber, entry);

      entry.renderTask.promise
        .then(async () => {
          await this.paintSignatureAppearances(
            page,
            viewport,
            canvas,
            entry,
          ).catch((error) =>
            console.error(
              `Failed to draw the signatures of page ${pageNumber}:`,
              error,
            ),
          );
          this.annotationManager.renderAnnotationLayer(
            pageNumber,
            entry,
            page,
            viewport,
          ).then(() =>
            this.annotationManager.renderTextBoxLayer(
              pageNumber,
              entry,
              viewport,
            ),
          );
          this.renderAnnotationLayer(page, viewport, entry).catch((error) =>
            console.error(
              `Failed to render form fields of page ${pageNumber}:`,
              error,
            ),
          );
          await this.renderTextLayer(page, viewport, entry, pageNumber);
          await this.renderHighlightCommentLayer(
            page,
            viewport,
            entry,
            pageNumber,
          );
        })
        .catch((error) => {
          console.error(`Failed to render page ${pageNumber}:`, error);
        })
        .finally(() => {
          entry.isRendering = false;
          this.pages.set(pageNumber, entry);

          if (entry.renderPending) {
            entry.renderPending = false;
            this.renderPage(pageNumber, canvas);
          }
        });
    });
  }

  unloadPage(pageNumber, canvas) {
    const entry = this.pages.get(pageNumber);

    if (!entry || !entry.rendered) {
      return;
    }

    if (entry.renderTask) {
      entry.renderTask.cancel();
    }

    canvas.width = 0;
    canvas.height = 0;

    const textLayer = document.getElementById(`text-layer-${pageNumber}`);

    if (textLayer) {
      textLayer.innerHTML = "";
    }

    entry.wrapper?.highlightCommentLayer?.replaceChildren();
    entry.formLayerToken = (entry.formLayerToken ?? 0) + 1;
    entry.wrapper?.annotationLayer?.replaceChildren();
    entry.annotationLayerInstance = null;
    entry.noFormFields = false;

    entry.textDivs = null;
    entry.textLayerInstance = null;
    this.onTextLayerUnloaded?.(pageNumber);
    this.annotationManager.destroyLayer(pageNumber);

    if (entry.page) {
      entry.page.cleanup();
    }

    entry.rendered = false;
    entry.renderTask = null;
  }

  setupObservers() {
    this.observers.forEach((observer) => observer.disconnect());

    const wrappers = document.querySelectorAll("#pdf-viewer-list .pdf-page");

    const loadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const wrapper = entry.target;
          const canvas = wrapper.querySelector("canvas");
          const pageNumber = Number(canvas.dataset.pageNumber);

          this.renderPage(pageNumber, canvas);

          loadObserver.unobserve(wrapper);
          unloadObserver.observe(wrapper);
        });
      },
      {
        root: null,
        rootMargin: "750px 0px",
        threshold: 0,
      },
    );

    const unloadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const wrapper = entry.target;
          const canvas = wrapper.querySelector("canvas");
          const pageNumber = Number(canvas.dataset.pageNumber);

          if (!entry.isIntersecting) {
            this.unloadPage(pageNumber, canvas);
            loadObserver.observe(wrapper);
            unloadObserver.unobserve(wrapper);
          }
        });
      },
      {
        root: null,
        rootMargin: "2000px 0px",
        threshold: 0,
      },
    );

    this.observers = [loadObserver, unloadObserver];

    wrappers.forEach((wrapper) => {
      loadObserver.observe(wrapper);
    });
  }

  async renderPages() {
    const canvasDiv = document.querySelector("#pdf-viewer-list");

    const pageNumbers = Array.from(
      { length: this.documentPDF.numPages },
      (_, i) => i + 1,
    );
    const pages = await Promise.all(
      pageNumbers.map(async (number) => {
        const page = await this.documentPDF.getPage(number);
        return {
          number,
          page,
          viewport: page.getViewport({ scale: this.scale }),
        };
      }),
    );

    for (const { number, page, viewport } of pages) {
      const wrapper = document.createElement("div");
      wrapper.className = "pdf-page";
      wrapper.dataset.pageNumber = number;

      wrapper.style.width = `${viewport.width}px`;
      wrapper.style.height = `${viewport.height}px`;
      wrapper.style.position = "relative";

      const canvas = document.createElement("canvas");
      canvas.dataset.pageNumber = number;

      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.style.zIndex = "1";

      const textLayer = document.createElement("div");
      textLayer.className = "textLayer";
      textLayer.id = `text-layer-${number}`;

      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      textLayer.style.zIndex = "2";

      const annotationLayer = document.createElement("div");
      annotationLayer.className = "annotationLayer";
      annotationLayer.id = `annotation-layer-${number}`;

      annotationLayer.style.width = `${viewport.width}px`;
      annotationLayer.style.height = `${viewport.height}px`;
      annotationLayer.style.zIndex = "3";
      annotationLayer.style.pointerEvents = "none";

      const annotationEditorLayer = document.createElement("div");
      annotationEditorLayer.className = "annotationEditorLayer";
      annotationEditorLayer.id = `annotation-editor-layer-${number}`;

      annotationEditorLayer.style.width = `${viewport.width}px`;
      annotationEditorLayer.style.height = `${viewport.height}px`;
      annotationEditorLayer.style.zIndex = "4";
      annotationEditorLayer.style.pointerEvents = "none";

      wrapper.appendChild(canvas);
      wrapper.appendChild(textLayer);
      wrapper.appendChild(annotationLayer);
      wrapper.appendChild(annotationEditorLayer);

      const textBoxLayer = document.createElement("div");
      textBoxLayer.className = "text-box-layer";
      textBoxLayer.id = `text-box-layer-${number}`;
      textBoxLayer.style.width = `${viewport.width}px`;
      textBoxLayer.style.height = `${viewport.height}px`;
      textBoxLayer.style.zIndex = "6";
      textBoxLayer.style.pointerEvents = "none";
      wrapper.appendChild(textBoxLayer);

      const highlightCommentLayer = document.createElement("div");
      highlightCommentLayer.className = "highlight-comment-layer";
      highlightCommentLayer.id = `highlight-comment-layer-${number}`;
      highlightCommentLayer.style.position = "absolute";
      highlightCommentLayer.style.left = "0";
      highlightCommentLayer.style.top = "0";
      highlightCommentLayer.style.zIndex = "5";
      highlightCommentLayer.style.pointerEvents = "none";
      highlightCommentLayer.style.width = `${viewport.width}px`;
      highlightCommentLayer.style.height = `${viewport.height}px`;

      wrapper.appendChild(highlightCommentLayer);

      wrapper.annotationLayer = annotationLayer;
      wrapper.annotationEditorLayer = annotationEditorLayer;
      wrapper.textBoxLayer = textBoxLayer;
      wrapper.highlightCommentLayer = highlightCommentLayer;

      canvasDiv.appendChild(wrapper);

      this.pages.set(number, {
        wrapper,
        canvas,
        page,
        rendered: false,
        width: viewport.width,
        height: viewport.height,
      });
    }
  }
}
