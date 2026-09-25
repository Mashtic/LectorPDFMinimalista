const fs = require("fs/promises");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

const previewFiles = new Map();

function suggestedName(firstFile, secondFile) {
  const first = path.basename(firstFile, path.extname(firstFile));
  const second = path.basename(secondFile, path.extname(secondFile));

  return `${first} + ${second}.pdf`;
}

async function combinePdfFiles(firstFile, secondFile) {
  return combinePdfBytes(
    await fs.readFile(firstFile),
    await fs.readFile(secondFile),
  );
}

async function combinePdfBytes(firstPdf, secondPdf) {
  const combined = await PDFDocument.create();

  for (const pdfBytes of [firstPdf, secondPdf]) {
    const source = await PDFDocument.load(pdfBytes);

    const pages = await combined.copyPages(source, source.getPageIndices());

    pages.forEach((page) => combined.addPage(page));
  }

  return combined.save();
}

async function createPreview(senderId, firstFile, secondFile, tempDirectory) {
  const previewPath = path.join(
    tempDirectory,
    `lector-pdf-vista-previa-${Date.now()}-${senderId}.pdf`,
  );

  await fs.writeFile(previewPath, await combinePdfFiles(firstFile, secondFile));

  previewFiles.set(senderId, previewPath);

  return {
    previewPath,
    fileName: suggestedName(firstFile, secondFile),
  };
}

async function removePreview(senderId) {
  const previewPath = previewFiles.get(senderId);

  previewFiles.delete(senderId);

  if (previewPath) {
    await fs.rm(previewPath, { force: true });
  }
}

function getPreview(senderId) {
  return previewFiles.get(senderId);
}

async function savePreview(previewPath, destinationPath) {
  await fs.copyFile(previewPath, destinationPath);
}

async function cleanupPreviews() {
  await Promise.all([...previewFiles.keys()].map(removePreview));
}

module.exports = {
  combinePdfFiles,
  combinePdfBytes,
  createPreview,
  removePreview,
  getPreview,
  savePreview,
  cleanupPreviews,
};
