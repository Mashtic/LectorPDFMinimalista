const { app } = require('electron');
const { createMainWindow } = require('./windows/main-window.js');
const { registerWindowIpc } = require('./ipc/window-ipc.js');
const { registerDeletePageIpc } = require('./ipc/delete-pages-ipc.js');
const { registerPDFOpenIpc } = require('./ipc/pdf-open-ipc.js');
const { registerPDFMergeIpc } = require('./ipc/pdf-merge-ipc.js');
const { cleanupPreviews } = require('./services/pdf-merge-service.js');
const { registerGlobalVarIpc } = require('./ipc/global-var-ipc.js');
const {registerPDFSaveIpc } = require('./ipc/pdf-save-ipc.js')

// const {
//   createPresentationWindow,
// } = require("./windows/presentation-window.js");

app.whenReady().then(() => {
  registerWindowIpc();
  registerDeletePageIpc();
  registerPDFOpenIpc();
  registerPDFMergeIpc();
  registerGlobalVarIpc();
  registerPDFSaveIpc();

  createMainWindow();
  // createPresentationWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  cleanupPreviews();
});
