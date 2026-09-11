import { GlobalWorkerOptions, getDocument } from '../../../node_modules/pdfjs-dist/build/pdf.mjs';

// This should maybe be handled somewhere else
GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';

export class PdfViewer {
    constructor(pdfData, currentPage = 1) {
        this.url = null
        this.pdfData = pdfData
        this.pdfDoc = null
        this.currentPage = currentPage
        this.scale = 1
        this.pages = new Map()
    }

    async load() {
        this.pdfDoc = await getDocument({ data: this.pdfData }).promise
        await this.renderPages()
        this.setupObservers()
    }

    renderPage(num, canvas) {
        this.pdfDoc.getPage(num).then(page => {
            const entry = this.pages.get(num) || {}
            entry.page = page
            const canvasCtx = canvas.getContext('2d')

            const viewport = page.getViewport({
                scale: this.scale
            })

            canvas.width = viewport.width
            canvas.height = viewport.height

            const renderCtx = {
                canvasContext: canvasCtx,
                viewport
            }

            const renderTask = page.render(renderCtx)
            entry.renderTask = renderTask
            entry.rendered = true

            this.pages.set(num, entry)

            entry.renderTask.promise
        })
    }

    unloadPage(num, canvas) {
        const entry = this.pages.get(num)

        if (!entry || !entry.rendered) {
            return
        }

        if (entry.renderTask) {
            entry.renderTask.cancel()
        }

        canvas.width = 0
        canvas.height = 0

        if (entry.page) {
            entry.page.cleanup()
        }

        entry.rendered = false
        entry.renderTask = null
    }

    setupObservers() {
        const wrappers = document.querySelectorAll('#pdf-viewer-list .pdf-page')
        console.log(wrappers)

        const loadObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) {
                    return
                }

                const wrapper = entry.target
                const canvas = wrapper.querySelector('canvas')
                const pageNumber = Number(canvas.dataset.pageNumber)

                this.renderPage(pageNumber, canvas)

                loadObserver.unobserve(wrapper)
                unloadObserver.observe(wrapper)
            })
        }, {
            root: null,
            rootMargin: '500px 0px',
            threshold: 0
        })

        const unloadObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const wrapper = entry.target
                const canvas = wrapper.querySelector('canvas')
                const pageNumber = Number(canvas.dataset.pageNumber)

                if (!entry.isIntersecting) {
                    this.unloadPage(pageNumber, canvas)
                    loadObserver.observe(wrapper)
                    unloadObserver.unobserve(wrapper)
                }
            })
        }, {
            root: null,
            rootMargin: '2000px 0px',
            threshold: 0
        })

        wrappers.forEach(wrapper => {
            loadObserver.observe(wrapper)
        })
    }

    async renderPages() {
        const canvasDiv = document.querySelector('#pdf-viewer-list')

        const pageNums = Array.from({ length: this.pdfDoc.numPages }, (_, i) => i + 1)
        const pages = await Promise.all(
            pageNums.map(async num => {
                const page = await this.pdfDoc.getPage(num)
                return { num, page, viewport: page.getViewport({ scale: this.scale }) }
            })
        )

        for (const { num, page, viewport } of pages) {
            const wrapper = document.createElement('div')
            wrapper.className = 'pdf-page'

            wrapper.style.width = `${viewport.width}px`
            wrapper.style.height = `${viewport.height}px`
            wrapper.style.position = 'relative'

            const canvas = document.createElement('canvas')
            canvas.dataset.pageNumber = num

            wrapper.appendChild(canvas)
            canvasDiv.appendChild(wrapper)

            this.pages.set({
                wrapper,
                canvas,
                page,
                rendered: false,
                width: viewport.width,
                height: viewport.height
            })
        }
    }

    // This does not lazy load pages and instead waits for all pages to load
    // in other words, this is BAD

    // async renderPages() {
    //     const canvasDiv = document.querySelector('#pdf-viewer-list')
    //
    //     const renderPromises = []
    //
    //     for (let i = 1; i <= this.pdfDoc.numPages; i++) {
    //         var canvas = document.createElement('canvas')
    //         canvasDiv.appendChild(canvas)
    //
    //         renderPromises.push(
    //             this.pdfDoc.getPage(i).then(page => {
    //                 const canvasCtx = canvas.getContext('2d')
    //
    //                 const viewport = page.getViewport({
    //                     scale: this.scale
    //                 })
    //
    //                 canvas.height = viewport.height
    //                 canvas.width = viewport.width
    //
    //
    //                 const renderCtx = {
    //                     canvasContext: canvasCtx,
    //                     viewport
    //                 }
    //
    //                 return page.render(renderCtx).promise
    //             })
    //         )
    //     }
    //
    //     await Promise.all(renderPromises)
    // }
}
