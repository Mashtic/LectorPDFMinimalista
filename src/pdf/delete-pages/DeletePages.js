const { PDFDocument } = require('pdf-lib');

async function deletePages(pdfBytes, pages) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pages.sort((a, b) => a - b); 

  let offset = 0;
  for (let i = 0; i < pages.length; i++) {
    if (0 <= pages[i] && pages[i] < pdfDoc.getPageCount()) {
      let k = pages[i] - offset;
      pdfDoc.removePage(k);
      offset++;
    }
  }

  const pdfBytesModified = await pdfDoc.save();
  return pdfBytesModified;
}

module.exports = deletePages;
