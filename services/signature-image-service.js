const { readFile } = require("node:fs/promises");
const { dialog } = require("electron");
const { PDFDocument } = require("pdf-lib");
const { getGlobalVar, setGlobalVar } = require("./global-var-service.js");

/*
 * Draws an image of a handwritten signature on a page. This is only a visual
 * mark: it does not sign the document. The digital signature lives in
 * pdf-sign-service.js.
 *
 * The placement arrives as fractions of the page (0 to 1) measured from the
 * top left corner, because the viewer does not know the page size in points.
 * This service turns them into PDF points, whose origin is the bottom left.
 */

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPG_HEADER = Buffer.from([0xff, 0xd8, 0xff]);

// Image chosen in the picker, waiting for the person to place it
let pendingImage = null;

function createImageError(code) {
  const error = new Error(`Signature image failed: ${code}`);
  error.code = code;
  return error;
}

function getMediaType(imageBytes) {
  if (PNG_HEADER.equals(imageBytes.subarray(0, 4))) {
    return "image/png";
  }

  if (JPG_HEADER.equals(imageBytes.subarray(0, 3))) {
    return "image/jpeg";
  }

  throw createImageError("INVALID_IMAGE");
}

async function pickSignatureImage() {
  if (!getGlobalVar("currentPDF")) {
    throw createImageError("NO_DOCUMENT");
  }

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

  let imageBytes;

  try {
    imageBytes = await readFile(filePaths[0]);
  } catch {
    throw createImageError("UNREADABLE_FILE");
  }

  const mediaType = getMediaType(imageBytes);
  pendingImage = { bytes: imageBytes, mediaType };

  // The preview is sent as a data URL so the viewer can show it before it is
  // written into the document
  return {
    dataUrl: `data:${mediaType};base64,${imageBytes.toString("base64")}`,
  };
}

function cancelSignatureImage() {
  pendingImage = null;
}

async function embedImage(pdf, image) {
  if (image.mediaType === "image/png") {
    // embedPng keeps the alpha channel, so transparency is preserved
    return pdf.embedPng(image.bytes);
  }

  return pdf.embedJpg(image.bytes);
}

function toPdfRectangle(placement, page) {
  const { width: pageWidth, height: pageHeight } = page.getSize();

  const width = placement.width * pageWidth;
  const height = placement.height * pageHeight;

  return {
    x: placement.x * pageWidth,
    // The viewer measures from the top, PDF measures from the bottom
    y: pageHeight - placement.y * pageHeight - height,
    width,
    height,
  };
}

async function insertSignatureImage({ pageNumber, placement } = {}) {
  const source = getGlobalVar("currentPDF");
  if (!source) {
    throw createImageError("NO_DOCUMENT");
  }

  if (!pendingImage) {
    throw createImageError("NO_IMAGE");
  }

  if (!placement) {
    throw createImageError("NO_PLACEMENT");
  }

  const pdf = await PDFDocument.load(source);
  const page = pdf.getPages()[Number(pageNumber) - 1];

  if (!page) {
    throw createImageError("INVALID_PAGE");
  }

  let image;

  try {
    image = await embedImage(pdf, pendingImage);
  } catch (error) {
    throw error.code ? error : createImageError("INVALID_IMAGE");
  }

  page.drawImage(image, toPdfRectangle(placement, page));

  setGlobalVar("currentPDF", Buffer.from(await pdf.save()));
  pendingImage = null;

  return { pageNumber: Number(pageNumber) };
}

module.exports = {
  pickSignatureImage,
  insertSignatureImage,
  cancelSignatureImage,
};