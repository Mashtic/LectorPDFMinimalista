const { ipcMain} = require("electron");
const { readPdfFile, readDocumentFile } = require("../services/pdf-open-service");

function registerPDFOpenIpc() {
  ipcMain.handle("dialog:openFile", readPdfFile);
  ipcMain.handle("dialog:openDocument", readDocumentFile);
}

module.exports = {registerPDFOpenIpc};
