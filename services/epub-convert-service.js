const { DOMParser, XMLSerializer } = require("@xmldom/xmldom");
const JSZip = require("jszip");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { printPageToPdf } = require("../windows/epub-render-window.js");

const IMAGE_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const BOOK_STYLE = `
body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.5; }
img { max-width: 100%; height: auto; }
.chapter + .chapter { break-before: page; }
`;

function createEpubError(code, cause) {
  const error = new Error(`EPUB conversion failed: ${code}`);
  error.code = code;
  error.cause = cause;
  return error;
}

function parseXml(text) {
  return new DOMParser({ onError: () => {} }).parseFromString(
    text,
    "application/xhtml+xml",
  );
}

function resolvePath(fromFile, href) {
  return path.posix.join(
    path.posix.dirname(fromFile),
    decodeURIComponent(href.split("#")[0]),
  );
}

async function readText(archive, filePath) {
  const file = archive.file(filePath);
  if (!file) {
    throw createEpubError("INVALID_EPUB");
  }

  return file.async("string");
}

async function listChapterPaths(archive) {
  const container = parseXml(await readText(archive, "META-INF/container.xml"));
  const rootFile = container.getElementsByTagNameNS("*", "rootfile")[0];
  const packagePath = rootFile ? rootFile.getAttribute("full-path") : "";
  const packageFile = parseXml(await readText(archive, packagePath));

  const hrefs = {};
  for (const item of packageFile.getElementsByTagNameNS("*", "item")) {
    hrefs[item.getAttribute("id")] = item.getAttribute("href");
  }

  const spine = packageFile.getElementsByTagNameNS("*", "itemref");
  return Array.from(spine)
    .map((itemRef) => hrefs[itemRef.getAttribute("idref")])
    .filter(Boolean)
    .map((href) => resolvePath(packagePath, href));
}

const IMAGE_SOURCES = [
  ["img", "src"],
  ["image", "xlink:href"],
  ["image", "href"],
];

async function embedImages(archive, chapter, chapterPath) {
  for (const [tagName, attribute] of IMAGE_SOURCES) {
    const images = chapter.getElementsByTagNameNS("*", tagName);

    for (const image of Array.from(images)) {
      if (!image.hasAttribute(attribute)) {
        continue;
      }

      const imagePath = resolvePath(chapterPath, image.getAttribute(attribute));
      const file = archive.file(imagePath);
      const type = IMAGE_TYPES[path.posix.extname(imagePath).toLowerCase()];

      if (file && type) {
        image.setAttribute(
          attribute,
          `data:${type};base64,${await file.async("base64")}`,
        );
      } else {
        image.parentNode.removeChild(image);
      }
    }
  }
}

async function readStyles(archive, chapter, chapterPath, readPaths) {
  let styles = "";

  for (const link of Array.from(chapter.getElementsByTagNameNS("*", "link"))) {
    const stylePath = resolvePath(chapterPath, link.getAttribute("href") || "");
    const file = archive.file(stylePath);

    if (
      link.getAttribute("rel") === "stylesheet" &&
      file &&
      !readPaths.has(stylePath)
    ) {
      readPaths.add(stylePath);
      styles += await file.async("string");
    }
  }

  return styles;
}

async function createBookPage(archive) {
  const book = parseXml(
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><style></style></head><body></body></html>',
  );
  const bookBody = book.getElementsByTagNameNS("*", "body")[0];
  const readPaths = new Set();
  let styles = BOOK_STYLE;

  for (const chapterPath of await listChapterPaths(archive)) {
    const chapter = parseXml(await readText(archive, chapterPath));
    const chapterBody = chapter.getElementsByTagNameNS("*", "body")[0];
    if (!chapterBody) {
      continue;
    }

    for (const script of Array.from(
      chapter.getElementsByTagNameNS("*", "script"),
    )) {
      script.parentNode.removeChild(script);
    }

    await embedImages(archive, chapter, chapterPath);
    styles += await readStyles(archive, chapter, chapterPath, readPaths);

    const section = book.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "section",
    );
    section.setAttribute("class", "chapter");
    for (const node of Array.from(chapterBody.childNodes)) {
      section.appendChild(book.importNode(node, true));
    }
    bookBody.appendChild(section);
  }

  if (!bookBody.firstChild) {
    throw createEpubError("INVALID_EPUB");
  }

  book.getElementsByTagNameNS("*", "style")[0].textContent = styles;
  return new XMLSerializer().serializeToString(book);
}

async function convertEpubToPdf(epubPath) {
  let page;
  try {
    const archive = await JSZip.loadAsync(await readFile(epubPath));
    if (archive.file("META-INF/encryption.xml")) {
      throw createEpubError("ENCRYPTED_EPUB");
    }

    page = await createBookPage(archive);
  } catch (error) {
    throw error.code ? error : createEpubError("INVALID_EPUB", error);
  }

  const outputFolder = await mkdtemp(path.join(os.tmpdir(), "folio-epub-"));
  const pagePath = path.join(outputFolder, "book.xhtml");

  try {
    await writeFile(pagePath, page, "utf8");
    return Buffer.from(await printPageToPdf(pagePath));
  } finally {
    await rm(outputFolder, { recursive: true, force: true });
  }
}

module.exports = { convertEpubToPdf };
