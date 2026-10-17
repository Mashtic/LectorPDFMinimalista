import {
  AnnotationMode,
  GlobalWorkerOptions,
  getDocument,
  TextLayer,
  AnnotationLayer,
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
    this.annotationStore.deleteHighlight(pageNumber, annotationId);
  }

  getCurrentPDF() {
    return this.annotationStore.getBytes();
  }

  async refreshPageLayers(pageNumber) {
    const entry = this.pages.get(pageNumber);
    if (!entry?.rendered || !entry.page) return;

    const viewport = entry.page.getViewport({ scale: this.scale });
    await this.annotationManager.refreshPage(pageNumber);
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
    zoomIn(this.zoomState);
    this.rerenderVisiblePages();
  }

  zoomOutPages() {
    zoomOut(this.zoomState);
    this.rerenderVisiblePages();
  }

  resetZoom() {
    setZoom(this.zoomState, 1);
    this.rerenderVisiblePages();
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

  async renderAnnotationLayer(page, viewport, entry) {
    const annotationLayer = entry.wrapper.annotationLayer;

    if (!annotationLayer) return;

    const annotations = await page.getAnnotations({ intent: "display" });

    annotationLayer.replaceChildren();

    const annotationViewport = viewport.clone({ dontFlip: true });

    const layer = new AnnotationLayer({
      div: annotationLayer,
      page,
      viewport: annotationViewport,
      accessibilityManager: null,
      annotationCanvasMap: null,
    });

    await layer.render({
      annotations,
      page,
      viewport: annotationViewport,
      renderForms: true,
      annotationStorage: this.documentPDF.annotationStorage,
      linkService: this.linkService,
    });

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
          this.annotationManager.renderAnnotationLayer(
            pageNumber,
            entry,
            page,
            viewport,
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
