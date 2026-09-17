const { ipcMain} = require("electron");
const { readPdfFile } = require("../services/pdf-open-service");

function registerPDFOpenIpc() {
  ipcMain.handle("dialog:openFile", readPdfFile);
}

module.exports = {registerPDFOpenIpc};
