const { readFile } = require("node:fs/promises");
const { dialog } = require("electron");
const { PDFDocument } = require("pdf-lib");
const { getGlobalVar, setGlobalVar } = require("./global-var-service.js");

/*
 * Draws an image of a handwritten signature on a page. This is only a visual
 * mark: it does not sign the document. The digital signature lives in
 * pdf-sign-service.js.
 */

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPG_HEADER = Buffer.from([0xff, 0xd8, 0xff]);

// Default size and margin of the stamp, in PDF points
const DEFAULT_WIDTH = 160;
const DEFAULT_MARGIN = 72;

function createImageError(code) {
  const error = new Error(`Signature image failed: ${code}`);
  error.code = code;
  return error;
}

async function pickSignatureImage() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg"],
      },
    ],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return filePaths[0];
}

async function embedImage(pdf, imageBytes) {
  if (PNG_HEADER.equals(imageBytes.subarray(0, 4))) {
    // embedPng keeps the alpha channel, so transparency is preserved
    return pdf.embedPng(imageBytes);
  }

  if (JPG_HEADER.equals(imageBytes.subarray(0, 3))) {
    return pdf.embedJpg(imageBytes);
  }

  throw createImageError("INVALID_IMAGE");
}

function resolvePlacement(image, page, placement) {
  const { width: pageWidth, height: pageHeight } = page.getSize();

  if (placement?.width) {
    return {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    };
  }

  // Without a placement the stamp goes where a signature line usually is
  const width = Math.min(DEFAULT_WIDTH, pageWidth / 3);
  const scaled = image.scale(width / image.width);

  return {
    x: (pageWidth - scaled.width) / 2,
    y: Math.min(DEFAULT_MARGIN, pageHeight / 4),
    width: scaled.width,
    height: scaled.height,
  };
}

async function insertSignatureImage({ pageNumber, placement } = {}) {
  const source = getGlobalVar("currentPDF");
  if (!source) {
    throw createImageError("NO_DOCUMENT");
  }

  const imagePath = await pickSignatureImage();
  if (!imagePath) {
    return null;
  }

  let imageBytes;

  try {
    imageBytes = await readFile(imagePath);
  } catch {
    throw createImageError("UNREADABLE_FILE");
  }

  const pdf = await PDFDocument.load(source);
  const pageIndex = Number(pageNumber) - 1;
  const page = pdf.getPages()[pageIndex];

  if (!page) {
    throw createImageError("INVALID_PAGE");
  }

  let image;

  try {
    image = await embedImage(pdf, imageBytes);
  } catch (error) {
    throw error.code ? error : createImageError("INVALID_IMAGE");
  }

  page.drawImage(image, resolvePlacement(image, page, placement));

  const updated = Buffer.from(await pdf.save());
  setGlobalVar("currentPDF", updated);

  return { pageNumber: Number(pageNumber) };
}

module.exports = { insertSignatureImage };
