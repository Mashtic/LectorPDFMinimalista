const { ipcMain } = require("electron");
const {
  saveCurrentPdf,
  writePdfFile,
} = require("../services/pdf-save-service.js");
const { addPdfComment } = require("../services/pdf-comments-service.js");
const { flushRendererPdf } = require("./unsaved-changes-ipc.js");

function withLatestPdf(save) {
  return async (event, ...args) => {
    await flushRendererPdf(event.sender);
    const saved = await save(event, ...args);
    if (saved && !event.sender.isDestroyed()) {
      event.sender.send("pdf-saved");
    }
    return saved;
  };
}

function registerPDFSaveIpc() {
  ipcMain.handle("dialog:saveFile", withLatestPdf(writePdfFile));
  ipcMain.handle("pdf:saveCurrent", withLatestPdf(saveCurrentPdf));
  ipcMain.handle("pdf:addComment", (_event, comment) => addPdfComment(comment));
}

module.exports = { registerPDFSaveIpc };
