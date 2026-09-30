import {
  GlobalWorkerOptions,
  getDocument,
} from "../../node_modules/pdfjs-dist/build/pdf.mjs";

GlobalWorkerOptions.workerSrc = "./pdf.worker.mjs";

export class PdfPresentationViewer {
  constructor(pdfData, currentPage = 1) {
    this.pdfData = pdfData;
    this.documentPDF = null;
    this.currentPage = currentPage;
    this.pageIsRendering = false;
    this.pageNumberIsPending = null;
    this.scale = 1.5;
    this.canvas = document.querySelector("#pdf-render");
    this.context = this.canvas.getContext("2d");

    window.addEventListener("resize", () => {
      if (this.documentPDF) {
        this.queueRenderPage(this.currentPage);
      }
    });
  }

  async load() {
    this.documentPDF = await getDocument({ data: this.pdfData }).promise;
    this.renderPage(this.currentPage);
  }

  nextPage() {
    if (this.currentPage >= this.documentPDF.numPages) {
      return;
    }

    this.currentPage++;
    this.queueRenderPage(this.currentPage);
  }

  prevPage() {
    if (this.currentPage <= 1) {
      return;
    }

    this.currentPage--;
    this.queueRenderPage(this.currentPage);
  }

  renderPage(pageNumber) {
    this.pageIsRendering = true;

    this.documentPDF.getPage(pageNumber).then((page) => {
      const unscaledViewport = page.getViewport({ scale: 1 });

      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      const scaleX = windowWidth / unscaledViewport.width;
      const scaleY = windowHeight / unscaledViewport.height;

      this.scale = Math.min(scaleX, scaleY);

      const viewport = page.getViewport({
        scale: this.scale,
      });
      this.canvas.height = viewport.height;
      this.canvas.width = viewport.width;

      const renderContext = {
        canvasContext: this.context,
        viewport,
      };

      page.render(renderContext).promise.then(() => {
        this.pageIsRendering = false;

        if (this.pageNumberIsPending !== null) {
          this.renderPage(this.pageNumberIsPending);
          this.pageNumberIsPending = null;
        }
      });
    });
  }

  queueRenderPage(num) {
    if (this.pageIsRendering) {
      this.pageNumberIsPending = num;
    } else {
      this.renderPage(num);
    }
  }
}
