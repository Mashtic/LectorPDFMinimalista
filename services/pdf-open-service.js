const { dialog } = require("electron");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { convertDviToPdf } = require("./dvi-convert-service.js");
const { convertEpubToPdf } = require("./epub-convert-service.js");

const OPEN_ERROR_MESSAGES = {
  NO_CONVERTER:
    "Opening DVI files requires dvipdfmx. Install TeX Live or MiKTeX and try again.",
  CONVERSION_FAILED:
    "The DVI file could not be converted to PDF. Fonts or images it references may be missing.",
  INVALID_EPUB: "The file is damaged or is not a valid EPUB book.",
  ENCRYPTED_EPUB: "This EPUB book is protected with DRM and cannot be opened.",
};

async function readPdfFile() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Documents", extensions: ["pdf", "dvi", "epub"] },
      { name: "PDF Files", extensions: ["pdf"] },
      { name: "DVI Files", extensions: ["dvi"] },
      { name: "EPUB Books", extensions: ["epub"] },
    ],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  try {
    return await readDocumentFromPath(filePaths[0]);
  } catch (error) {
    showOpenError(error);
    return null;
  }
}

async function readPdfFromPath(filePath) {
  const content = await readFile(filePath);

  return { path: filePath, content };
}

//A converted DVI or EPUB has no PDF on disk yet, so its path stays empty
async function readDocumentFromPath(filePath) {
  if (!isDvi(filePath) && !isEpub(filePath)) {
    return { ...(await readPdfFromPath(filePath)), suggestedSavePath: null };
  }

  const content = isDvi(filePath)
    ? await convertDviToPdf(filePath)
    : await convertEpubToPdf(filePath);
  const parsed = path.parse(filePath);

  return {
    path: null,
    content,
    suggestedSavePath: path.join(parsed.dir, `${parsed.name}.pdf`),
  };
}

function isDvi(filePath) {
  return /\.dvi$/i.test(filePath);
}

function isEpub(filePath) {
  return /\.epub$/i.test(filePath);
}

function showOpenError(error) {
  const message = OPEN_ERROR_MESSAGES[error.code];
  if (!message) {
    console.error("Failed to open document:", error);
    dialog.showErrorBox("Cannot open file", "The file could not be opened.");
    return;
  }

  console.error("Failed to open document:", error.cause || error);
  dialog.showErrorBox("Cannot open file", message);
}

module.exports = {
  readPdfFile,
  readPdfFromPath,
  readDocumentFromPath,
  showOpenError,
};
