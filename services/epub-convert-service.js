const { BrowserWindow, session } = require("electron");
const { DOMParser, XMLSerializer } = require("@xmldom/xmldom");
const JSZip = require("jszip");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

const CONVERSION_TIMEOUT_MS = 60000;
const RENDER_PARTITION = "folio-epub-render";
const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

const FONT_OBFUSCATION_ALGORITHMS = [
  "http://www.idpf.org/2008/embedding",
  "http://ns.adobe.com/pdf/enc#RC",
];

const MEDIA_TYPES_BY_EXTENSION = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".css": "text/css",
};

const BASE_STYLE = `
body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 12pt;
  line-height: 1.5;
  color: #000;
  background: #fff;
}
img, svg, video {
  max-width: 100%;
  height: auto;
}
pre {
  white-space: pre-wrap;
}
.folio-chapter + .folio-chapter {
  break-before: page;
}
`;

function createEpubError(code, cause) {
  const error = new Error(`EPUB conversion failed: ${code}`);
  error.code = code;
  error.cause = cause;
  return error;
}

function parseXml(text, mimeType) {
  try {
    return new DOMParser({ onError: () => {} }).parseFromString(text, mimeType);
  } catch (error) {
    throw createEpubError("INVALID_EPUB", error);
  }
}

async function loadArchive(epubBytes) {
  try {
    return await JSZip.loadAsync(epubBytes);
  } catch (error) {
    throw createEpubError("INVALID_EPUB", error);
  }
}

async function readArchiveText(archive, entryPath) {
  const entry = archive.file(entryPath);
  if (!entry) {
    throw createEpubError("INVALID_EPUB");
  }

  return entry.async("string");
}

// EPUB hrefs are URL encoded and relative to the file that contains them
function resolveArchivePath(fromFile, href) {
  const cleanHref = decodeURIComponent(href.split("#")[0]);
  return path.posix.normalize(
    path.posix.join(path.posix.dirname(fromFile), cleanHref),
  );
}

function isExternalReference(href) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

async function assertNotEncrypted(archive) {
  const encryptionEntry = archive.file("META-INF/encryption.xml");
  if (!encryptionEntry) {
    return;
  }

  const encryption = parseXml(
    await encryptionEntry.async("string"),
    "application/xml",
  );
  const algorithms = [
    ...encryption.getElementsByTagNameNS("*", "EncryptionMethod"),
  ].map((method) => method.getAttribute("Algorithm"));

  if (algorithms.some((name) => !FONT_OBFUSCATION_ALGORITHMS.includes(name))) {
    throw createEpubError("ENCRYPTED_EPUB");
  }
}

async function readPackage(archive) {
  const container = parseXml(
    await readArchiveText(archive, "META-INF/container.xml"),
    "application/xml",
  );
  const rootFile = container.getElementsByTagNameNS("*", "rootfile")[0];
  const packagePath = rootFile && rootFile.getAttribute("full-path");
  if (!packagePath) {
    throw createEpubError("INVALID_EPUB");
  }

  const packageDocument = parseXml(
    await readArchiveText(archive, packagePath),
    "application/xml",
  );

  const manifest = new Map();
  for (const item of packageDocument.getElementsByTagNameNS("*", "item")) {
    manifest.set(item.getAttribute("id"), {
      path: resolveArchivePath(packagePath, item.getAttribute("href")),
      mediaType: item.getAttribute("media-type"),
    });
  }

  // Chapters marked linear="no" are extras such as footnote pop-ups
  const chapterPaths = [
    ...packageDocument.getElementsByTagNameNS("*", "itemref"),
  ]
    .filter((itemRef) => itemRef.getAttribute("linear") !== "no")
    .map((itemRef) => manifest.get(itemRef.getAttribute("idref")))
    .filter((item) => item && /html/.test(item.mediaType || ""))
    .map((item) => item.path);

  if (chapterPaths.length === 0) {
    throw createEpubError("INVALID_EPUB");
  }

  const titleElement = packageDocument.getElementsByTagNameNS("*", "title")[0];
  const title = titleElement ? titleElement.textContent.trim() : "";

  const mediaTypes = new Map(
    [...manifest.values()].map((item) => [item.path, item.mediaType]),
  );

  return { chapterPaths, mediaTypes, title };
}

async function toDataUrl(archive, entryPath, mediaTypes) {
  const entry = archive.file(entryPath);
  if (!entry) {
    return null;
  }

  const mediaType =
    mediaTypes.get(entryPath) ||
    MEDIA_TYPES_BY_EXTENSION[path.posix.extname(entryPath).toLowerCase()] ||
    "application/octet-stream";

  return `data:${mediaType};base64,${await entry.async("base64")}`;
}

// Fonts and background images inside the book CSS are inlined too
async function inlineStyleUrls(archive, cssText, cssPath, mediaTypes) {
  const urlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  const references = [
    ...new Set([...cssText.matchAll(urlPattern)].map((match) => match[2])),
  ];

  let inlinedCss = cssText;
  for (const reference of references) {
    if (isExternalReference(reference)) {
      continue;
    }

    const dataUrl = await toDataUrl(
      archive,
      resolveArchivePath(cssPath, reference),
      mediaTypes,
    );
    if (dataUrl) {
      inlinedCss = inlinedCss.split(reference).join(dataUrl);
    }
  }

  return inlinedCss;
}

// Every chapter gets its own id prefix so links between chapters keep working
function createChapterIds(chapterPaths) {
  return new Map(
    chapterPaths.map((chapterPath, index) => [
      chapterPath,
      `folio-chapter-${index}`,
    ]),
  );
}

function rewriteLink(link, chapterPath, chapterIds) {
  const href = link.getAttribute("href");
  if (!href || isExternalReference(href)) {
    return;
  }

  const [filePart, fragment] = href.split("#");
  const targetPath = filePart
    ? resolveArchivePath(chapterPath, filePart)
    : chapterPath;
  const targetChapterId = chapterIds.get(targetPath);

  if (!targetChapterId) {
    link.removeAttribute("href");
    return;
  }

  link.setAttribute(
    "href",
    fragment ? `#${targetChapterId}-${fragment}` : `#${targetChapterId}`,
  );
}

async function rewriteChapterBody(
  archive,
  body,
  chapterPath,
  chapterIds,
  mediaTypes,
) {
  const chapterId = chapterIds.get(chapterPath);

  for (const script of [...body.getElementsByTagNameNS("*", "script")]) {
    script.parentNode.removeChild(script);
  }

  for (const element of [...body.getElementsByTagNameNS("*", "*")]) {
    const id = element.getAttribute("id");
    if (id) {
      element.setAttribute("id", `${chapterId}-${id}`);
    }

    if (element.localName === "a") {
      rewriteLink(element, chapterPath, chapterIds);
    }

    if (element.localName === "img" && element.getAttribute("src")) {
      const source = element.getAttribute("src");
      if (!isExternalReference(source)) {
        const dataUrl = await toDataUrl(
          archive,
          resolveArchivePath(chapterPath, source),
          mediaTypes,
        );
        element.setAttribute("src", dataUrl || "");
      }
    }

    // SVG covers use <image xlink:href="...">
    if (element.localName === "image") {
      const source =
        element.getAttributeNS(XLINK_NAMESPACE, "href") ||
        element.getAttribute("href");
      if (source && !isExternalReference(source)) {
        const dataUrl = await toDataUrl(
          archive,
          resolveArchivePath(chapterPath, source),
          mediaTypes,
        );
        element.setAttributeNS(XLINK_NAMESPACE, "xlink:href", dataUrl || "");
      }
    }
  }
}

async function collectChapterStyles(
  archive,
  chapterDocument,
  chapterPath,
  mediaTypes,
  loadedStyles,
) {
  const styles = [];

  for (const link of chapterDocument.getElementsByTagNameNS("*", "link")) {
    const href = link.getAttribute("href");
    if (
      !/stylesheet/i.test(link.getAttribute("rel") || "") ||
      !href ||
      isExternalReference(href)
    ) {
      continue;
    }

    const cssPath = resolveArchivePath(chapterPath, href);
    const entry = archive.file(cssPath);
    if (!entry || loadedStyles.has(cssPath)) {
      continue;
    }

    loadedStyles.add(cssPath);
    styles.push(
      await inlineStyleUrls(
        archive,
        await entry.async("string"),
        cssPath,
        mediaTypes,
      ),
    );
  }

  for (const style of chapterDocument.getElementsByTagNameNS("*", "style")) {
    styles.push(
      await inlineStyleUrls(
        archive,
        style.textContent,
        chapterPath,
        mediaTypes,
      ),
    );
  }

  return styles;
}

async function buildBook(archive) {
  const { chapterPaths, mediaTypes, title } = await readPackage(archive);
  const chapterIds = createChapterIds(chapterPaths);
  const serializer = new XMLSerializer();
  const loadedStyles = new Set();
  const styles = [];
  const sections = [];

  for (const chapterPath of chapterPaths) {
    const chapterDocument = parseXml(
      await readArchiveText(archive, chapterPath),
      "application/xhtml+xml",
    );
    const body = chapterDocument.getElementsByTagNameNS("*", "body")[0];
    if (!body) {
      continue;
    }

    styles.push(
      ...(await collectChapterStyles(
        archive,
        chapterDocument,
        chapterPath,
        mediaTypes,
        loadedStyles,
      )),
    );
    await rewriteChapterBody(
      archive,
      body,
      chapterPath,
      chapterIds,
      mediaTypes,
    );

    const content = [...body.childNodes]
      .map((node) => serializer.serializeToString(node))
      .join("");
    sections.push(
      `<section class="folio-chapter" id="${chapterIds.get(chapterPath)}">${content}</section>`,
    );
  }

  if (sections.length === 0) {
    throw createEpubError("INVALID_EPUB");
  }

  return { title, css: [BASE_STYLE, ...styles].join("\n"), sections };
}

// The page is written as XHTML, so the chapters do not need to be valid HTML
function createBookPage(book) {
  const title = book.title.replace(/&/g, "&amp;").replace(/</g, "&lt;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="${XHTML_NAMESPACE}">
<head>
<meta charset="UTF-8"/>
<title>${title}</title>
<link rel="stylesheet" href="book.css"/>
</head>
<body>
${book.sections.join("\n")}
</body>
</html>`;
}

function isInsideFolder(url, folder) {
  if (!url.startsWith("file:")) {
    return false;
  }

  const relativePath = path.relative(folder, fileURLToPath(url));
  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

// Book content is untrusted: no scripts and no requests outside its own files
function createRenderWindow(allowedFolder) {
  const renderSession = session.fromPartition(RENDER_PARTITION);
  renderSession.webRequest.onBeforeRequest((details, callback) => {
    const isAllowed =
      details.url.startsWith("data:") ||
      isInsideFolder(details.url, allowedFolder);
    callback({ cancel: !isAllowed });
  });

  return new BrowserWindow({
    show: false,
    webPreferences: {
      javascript: false,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      partition: RENDER_PARTITION,
    },
  });
}

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("Timed out")),
      CONVERSION_TIMEOUT_MS,
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function renderPageToPdf(pagePath) {
  const renderWindow = createRenderWindow(path.dirname(pagePath));

  try {
    await withTimeout(renderWindow.loadFile(pagePath));
    return await withTimeout(
      renderWindow.webContents.printToPDF({
        pageSize: "A5",
        printBackground: true,
        // Chromium only builds the outline from the headings of a tagged PDF
        generateTaggedPDF: true,
        generateDocumentOutline: true,
      }),
    );
  } finally {
    renderWindow.destroy();
  }
}

async function convertEpubToPdf(epubPath) {
  const archive = await loadArchive(await readFile(epubPath));
  await assertNotEncrypted(archive);
  const book = await buildBook(archive);

  const outputFolder = await mkdtemp(path.join(os.tmpdir(), "folio-epub-"));
  const pagePath = path.join(outputFolder, "book.xhtml");
  const stylePath = path.join(outputFolder, "book.css");

  try {
    await writeFile(pagePath, createBookPage(book), "utf8");
    await writeFile(stylePath, book.css, "utf8");
    return Buffer.from(await renderPageToPdf(pagePath));
  } catch (error) {
    throw createEpubError("EPUB_RENDER_FAILED", error);
  } finally {
    await rm(outputFolder, { recursive: true, force: true });
  }
}

module.exports = { convertEpubToPdf };
