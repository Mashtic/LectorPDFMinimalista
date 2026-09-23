const { ipcMain} = require("electron");
const {
  saveCurrentPdf,
  writePdfFile,
} = require("../services/pdf-save-service.js");

function registerPDFSaveIpc() {
  ipcMain.handle("dialog:saveFile", writePdfFile);
  ipcMain.handle("pdf:saveCurrent", saveCurrentPdf);
}

module.exports = {registerPDFSaveIpc};
