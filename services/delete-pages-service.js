const { PDFDocument } = require("pdf-lib");
const { setGlobalVar, getGlobalVar } = require("./global-var-service.js");

async function deletePages(pages) {
  const pdfDoc = await PDFDocument.load(getGlobalVar("currentPDF"));
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
  setGlobalVar("currentPDF", pdfBytesModified);
  return true;
}

module.exports = deletePages;
