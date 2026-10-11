const { ipcMain} = require("electron");
const {
  saveCurrentPdf,
  writePdfFile,
} = require("../services/pdf-save-service.js");
const { addPdfComment } = require("../services/pdf-comments-service.js");

function registerPDFSaveIpc() {
  ipcMain.handle("dialog:saveFile", writePdfFile);
  ipcMain.handle("pdf:saveCurrent", saveCurrentPdf);
  ipcMain.handle("pdf:addComment", (_event, comment) => addPdfComment(comment));
}

module.exports = {registerPDFSaveIpc};
