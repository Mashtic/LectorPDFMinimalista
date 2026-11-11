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
const { registerSignatureInfoIpc } = require("./ipc/signature-info-ipc.js");
const {
  registerSignatureAppearanceIpc,
} = require("./ipc/signature-appearance-ipc.js");
const { registerUnsavedChangesIpc } = require("./ipc/unsaved-changes-ipc.js");
const path = require("node:path");
const { existsSync } = require("node:fs");
const {
  readDocumentFromPath,
  showOpenError,
} = require("./services/pdf-open-service.js");
const { setGlobalVar } = require("./services/global-var-service.js");

// const {
//   createPresentationWindow,
// } = require("./windows/presentation-window.js");

function findLaunchDocumentPath(argv) {
  return argv
    .filter((argument) => /\.(pdf|dvi)$/i.test(argument))
    .map((argument) => path.resolve(argument))
    .find((documentPath) => existsSync(documentPath));
}

async function loadLaunchDocument() {
  const documentPath = findLaunchDocumentPath(process.argv);
  if (!documentPath) {
    return;
  }

  try {
    const file = await readDocumentFromPath(documentPath);
    setGlobalVar("pdfPath", file.path);
    setGlobalVar("suggestedSavePath", file.suggestedSavePath);
    setGlobalVar("currentPDF", file.content);
  } catch (error) {
    showOpenError(error);
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
  registerSignatureInfoIpc();
  registerSignatureAppearanceIpc();
  registerUnsavedChangesIpc();

  Menu.setApplicationMenu(null);
  await loadLaunchDocument();
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
