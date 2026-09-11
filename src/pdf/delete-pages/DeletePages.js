const {PDFDocument} = require('pdf-lib');

async function deletePages(pdfBytes, pages) {
  const pdfDoc = await PDFDocument.load(pdfBytes);

  pages.forEach(element => {
    pdfDoc.removePage(element); 
  });

  const pdfBytesModified = await pdfDoc.save();
  return pdfBytesModified;
}

