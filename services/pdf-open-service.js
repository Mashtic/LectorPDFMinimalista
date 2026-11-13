const { dialog } = require("electron");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { convertDviToPdf } = require("./dvi-convert-service.js");
const { convertEpubToPdf } = require("./epub-convert-service.js");

const OPEN_ERRORS = {
  NO_CONVERTER: {
    title: "Cannot open DVI file",
    message:
      "Opening DVI files requires dvipdfmx. Install TeX Live or MiKTeX and try again.",
  },
  CONVERSION_FAILED: {
    title: "Cannot open DVI file",
    message:
      "The DVI file could not be converted to PDF. Fonts or images it references may be missing.",
  },
  INVALID_EPUB: {
    title: "Cannot open EPUB file",
    message: "The file is damaged or is not a valid EPUB book.",
  },
  ENCRYPTED_EPUB: {
    title: "Cannot open EPUB file",
    message: "This EPUB book is protected with DRM and cannot be opened.",
  },
  EPUB_RENDER_FAILED: {
    title: "Cannot open EPUB file",
    message: "The EPUB book could not be displayed.",
  },
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
  const convertToPdf = getConverter(filePath);
  if (!convertToPdf) {
    return { ...(await readPdfFromPath(filePath)), suggestedSavePath: null };
  }

  const content = await convertToPdf(filePath);
  const parsed = path.parse(filePath);

  return {
    path: null,
    content,
    suggestedSavePath: path.join(parsed.dir, `${parsed.name}.pdf`),
  };
}

function getConverter(filePath) {
  if (/\.dvi$/i.test(filePath)) {
    return convertDviToPdf;
  }

  if (/\.epub$/i.test(filePath)) {
    return convertEpubToPdf;
  }

  return null;
}

function showOpenError(error) {
  const openError = OPEN_ERRORS[error.code];
  if (!openError) {
    console.error("Failed to open document:", error);
    dialog.showErrorBox("Cannot open file", "The file could not be opened.");
    return;
  }

  console.error(`${openError.title}:`, error.cause || error);
  dialog.showErrorBox(openError.title, openError.message);
}

module.exports = {
  readPdfFile,
  readPdfFromPath,
  readDocumentFromPath,
  showOpenError,
};
