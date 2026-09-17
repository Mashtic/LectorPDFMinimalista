const { ipcMain} = require("electron");
const { writePdfFile } = require("../services/pdf-save-service.js");

function registerPDFSaveIpc() {
  ipcMain.handle("dialog:saveFile", writePdfFile);
}

module.exports = {registerPDFSaveIpc};
