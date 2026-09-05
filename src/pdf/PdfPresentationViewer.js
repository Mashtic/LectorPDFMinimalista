import * as pdfjsLib from '../../node_modules/pdfjs-dist/build/pdf.mjs';

// This should maybe be handled somewhere else
pdfjsLib.GlobalWorkerOptions.workerSrc = './node_modules/pdfjs-dist/build/pdf.worker.mjs';

export class PdfPresentationViewer {
    constructor(url, currentPage = 1) {
        this.url = url;
        this.pdfDoc = null;
        this.currentPage = currentPage;
    }

    async load() {
        pdfjsLib.getDocument({ url: this.url }).promise.then(pdfDoc => {
            this.pdfDoc = pdfDoc;
            console.log(this.pdfDoc);
        });
    }

    nextPage() {
        if (this.currentPage >= this.pdfDoc.numPages) {
            return;
        }

        this.currentPage++;
    }

    prevPage() {
        if (this.currentPage <= 1) {
            return;
        }

        this.currentPage--;
    }
}
