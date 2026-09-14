import { PdfViewer } from './PdfViewer.js';

const pdf_json = sessionStorage.getItem('currentPDF');
if (pdf_json) {
    const currentPDF = pdf_json ? new Uint8Array(JSON.parse(pdf_json)) : null;
    if (currentPDF) {
        const viewer = new PdfViewer(currentPDF);
        viewer.load();
    }
}

document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'c') {
        const selection = window.getSelection()
        const text = selection?.toString()

        if (!text) return

        navigator.clipboard.writeText(text)
    }
})
