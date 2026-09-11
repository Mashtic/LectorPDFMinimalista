import { PdfViewer } from './PdfViewer.js';

const pdf_json = sessionStorage.getItem('currentPDF');
if (pdf_json) {
  const currentPDF = pdf_json ? new Uint8Array(JSON.parse(pdf_json)) : null;
  console.log(currentPDF)
  if (currentPDF) {
    const viewer = new PdfViewer(currentPDF);
    viewer.load();
  }
}
