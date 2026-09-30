const { PDFDocument } = require("pdf-lib");
const { setGlobalVar, getGlobalVar } = require("./global-var-service.js");

async function reorderPages(pageOrder) {
  const pdfDoc = await PDFDocument.load(getGlobalVar("currentPDF"));
  const pageCount = pdfDoc.getPageCount();

  if (
    !Array.isArray(pageOrder) ||
    pageOrder.length !== pageCount ||
    pageOrder.some((page) => !Number.isInteger(page) || page < 1 || page > pageCount) ||
    new Set(pageOrder).size !== pageCount
  ) {
    throw new Error("Invalid PDF page order");
  }

  const pages = pdfDoc.getPages();
  const reorderedPages = pageOrder.map((pageNumber) => pages[pageNumber - 1]);

  for (let index = pageCount - 1; index >= 0; index--) {
    pdfDoc.removePage(index);
  }
  reorderedPages.forEach((page, index) => pdfDoc.insertPage(index, page));

  setGlobalVar("currentPDF", await pdfDoc.save());
  return true;
}

module.exports = reorderPages;
