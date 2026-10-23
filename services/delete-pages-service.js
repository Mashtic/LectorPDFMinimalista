const { PDFDocument } = require("pdf-lib");
const { setGlobalVar, getGlobalVar } = require("./global-var-service.js");

async function deletePages(pages) {
  const pdfDoc = await PDFDocument.load(getGlobalVar("currentPDF"));
  const pageCount = pdfDoc.getPageCount();

  if (
    !Array.isArray(pages) ||
    pages.some(
      (pageNumber) =>
        !Number.isInteger(pageNumber) ||
        pageNumber < 1 ||
        pageNumber > pageCount,
    )
  ) {
    throw new Error("Invalid PDF pages to delete");
  }

  const pagesToDelete = [...new Set(pages)].sort((a, b) => b - a);
  if (pagesToDelete.length >= pageCount) {
    throw new Error("A PDF must contain at least one page");
  }

  for (const pageNumber of pagesToDelete) {
    pdfDoc.removePage(pageNumber - 1);
  }

  const pdfBytesModified = await pdfDoc.save();
  setGlobalVar("currentPDF", pdfBytesModified);
  return true;
}

module.exports = deletePages;
