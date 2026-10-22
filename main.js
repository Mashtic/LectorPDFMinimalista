const { app, Menu } = require("electron");
const { createMainWindow } = require("./windows/main-window.js");
const { registerWindowIpc } = require("./ipc/window-ipc.js");
const { registerDeletePageIpc } = require("./ipc/delete-pages-ipc.js");
const { registerPDFOpenIpc } = require("./ipc/pdf-open-ipc.js");
const { registerPDFMergeIpc } = require("./ipc/pdf-merge-ipc.js");
const { cleanupPreviews } = require("./services/pdf-merge-service.js");
const { registerGlobalVarIpc } = require("./ipc/global-var-ipc.js");
const { registerPDFSaveIpc } = require("./ipc/pdf-save-ipc.js");
const { registerCommentsIpc } = require("./ipc/comments-ipc.js");
const { registerSignDocumentIpc } = require("./ipc/sign-document-ipc.js");
const path = require("node:path");
const { existsSync } = require("node:fs");
const { readPdfFromPath } = require("./services/pdf-open-service.js");
const { setGlobalVar } = require("./services/global-var-service.js");

// const {
//   createPresentationWindow,
// } = require("./windows/presentation-window.js");

function findLaunchPdfPath(argv) {
  return argv
    .filter((argument) => /\.pdf$/i.test(argument))
    .map((argument) => path.resolve(argument))
    .find((pdfPath) => existsSync(pdfPath));
}

async function loadLaunchPdf() {
  const pdfPath = findLaunchPdfPath(process.argv);
  if (!pdfPath) {
    return;
  }

  try {
    const file = await readPdfFromPath(pdfPath);
    setGlobalVar("pdfPath", file.path);
    setGlobalVar("currentPDF", file.content);
  } catch (error) {
    console.error("Failed to open launch PDF:", error);
  }

}

app.whenReady().then(async () => {
  registerWindowIpc();
  registerDeletePageIpc();
  registerPDFOpenIpc();
  registerPDFMergeIpc();
  registerGlobalVarIpc();
  registerPDFSaveIpc();
  registerCommentsIpc();
  registerSignDocumentIpc();
  registerCommentsIpc();

  Menu.setApplicationMenu(null);
  await loadLaunchPdf();
  createMainWindow();
  // createPresentationWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  cleanupPreviews();
});
