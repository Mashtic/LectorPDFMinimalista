import { GlobalWorkerOptions, getDocument } from '../../../node_modules/pdfjs-dist/build/pdf.mjs';

// This should maybe be handled somewhere else
GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';

export class PdfPresentationViewer {
    // Take PDFDoc as parameter instead of URL once PDF opening
    // functionality is implemented
    constructor(url, currentPage = 1) {
        this.url = url;
        this.pdfDoc = null;
        this.currentPage = currentPage;
        this.pageIsRendering = false
        this.pageNumIsPending = null
        this.scale = 1.5
        this.canvas = document.querySelector('#pdf-render')
        this.ctx = this.canvas.getContext('2d')

        window.addEventListener('resize', () => {
            if (this.pdfDoc) {
                this.queueRenderPage(this.currentPage)
            }
        })
    }

    // Remove once PDFDoc is taken as a parameter
    async load() {
        getDocument({ url: this.url }).promise.then(pdfDoc => {
            this.pdfDoc = pdfDoc;
            this.renderPage(this.currentPage)
        });
    }

    nextPage() {
        if (this.currentPage >= this.pdfDoc.numPages) {
            return;
        }

        this.currentPage++;
        this.queueRenderPage(this.currentPage)
    }

    prevPage() {
        if (this.currentPage <= 1) {
            return;
        }

        this.currentPage--;
        this.queueRenderPage(this.currentPage)
    }

    renderPage(num) {
        this.pageIsRendering = true

        this.pdfDoc.getPage(num).then(page => {
            const unscaledViewport = page.getViewport({ scale: 1 })

            const windowWidth = window.innerWidth
            const windowHeight = window.innerHeight

            const scaleX = windowWidth / unscaledViewport.width
            const scaleY = windowHeight / unscaledViewport.height

            this.scale = Math.min(scaleX, scaleY)

            const viewport = page.getViewport({
                scale: this.scale
            })
            this.canvas.height = viewport.height
            this.canvas.width = viewport.width

            const renderCtx = {
                canvasContext: this.ctx,
                viewport
            }

            page.render(renderCtx).promise.then(() => {
                this.pageIsRendering = false

                if (this.pageNumIsPending !== null) {
                    this.renderPage(this.pageNumIsPending)
                    this.pageNumIsPending = null
                }
            })
        })
    }

    queueRenderPage(num) {
        if (this.pageIsRendering) {
            this.pageNumIsPending = num
        } else {
            this.renderPage(num)
        }
    }
}
