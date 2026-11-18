const { BrowserWindow } = require("electron");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

// The book page is untrusted, so it runs no scripts and loads nothing else
function createEpubRenderWindow(pagePath) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      javascript: false,
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      partition: "folio-epub-render",
    },
  });

  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const isPage =
      details.url.startsWith("file:") &&
      path.resolve(fileURLToPath(details.url)) === path.resolve(pagePath);
    callback({ cancel: !isPage && !details.url.startsWith("data:") });
  });

  return win;
}

async function printPageToPdf(pagePath) {
  const win = createEpubRenderWindow(pagePath);

  try {
    await win.loadFile(pagePath);

    // Chromium only builds the outline from the headings of a tagged PDF
    return await win.webContents.printToPDF({
      pageSize: "A5",
      printBackground: true,
      generateTaggedPDF: true,
      generateDocumentOutline: true,
    });
  } finally {
    win.destroy();
  }
}

module.exports = {
  printPageToPdf,
};
