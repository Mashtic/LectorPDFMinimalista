import {
  GlobalWorkerOptions,
  getDocument,
  TextLayer,
} from "../../node_modules/pdfjs-dist/build/pdf.mjs";

// This should maybe be handled somewhere else
GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

export class PdfViewer {
  constructor(pdfData, currentPage = 1) {
    this.URL = null;
    this.dataPDF = pdfData;
    this.documentPDF = null;
    this.currentPage = currentPage;
    this.scale = 1;
    this.pages = new Map();
  }

  async load() {
    this.documentPDF = await getDocument({ data: this.dataPDF }).promise;
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

    const counter = document.getElementById("pdf-page-counter");
    counter.innerHTML = `${this.currentPage} / ${this.documentPDF.numPages}`;
  }

  renderPage(pageNumber, canvas) {
    this.documentPDF.getPage(pageNumber).then((page) => {
      const entry = this.pages.get(pageNumber) || {};
      entry.page = page;
      const canvasContext = canvas.getContext("2d");

      const viewport = page.getViewport({
        scale: this.scale,
      });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const renderContext = {
        canvasContext: canvasContext,
        viewport,
      };

      const renderTask = page.render(renderContext);
      entry.renderTask = renderTask;
      entry.rendered = true;

      this.pages.set(pageNumber, entry);

      entry.renderTask.promise
        .then(() => {
          return page.getTextContent();
        })
        .then((textContent) => {
          const textId = `text-layer-${pageNumber}`;
          const textLayer = document.getElementById(textId);

          textLayer.innerHTML = "";
          textLayer.style.setProperty("--scale-factor", viewport.scale);
          textLayer.style.width = `${viewport.width}px`;
          textLayer.style.height = `${viewport.height}px`;

          const layer = new TextLayer({
            textContentSource: textContent,
            viewport: viewport,
            container: textLayer,
          });

          entry.textLayer = textLayer;

          return layer.render();
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

    if (entry.page) {
      entry.page.cleanup();
    }

    entry.rendered = false;
    entry.renderTask = null;
  }

  setupObservers() {
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

      textLayer.style.position = "absolute";
      textLayer.style.left = "0";
      textLayer.style.top = "0";
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      textLayer.style.zIndex = "2";

      wrapper.appendChild(canvas);
      wrapper.appendChild(textLayer);
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
