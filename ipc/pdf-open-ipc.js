const { ipcMain, BrowserWindow } = require("electron");
const { readPdfFile } = require("../services/pdf-open-service");
const { askRendererCanLeave } = require("./unsaved-changes-ipc.js");

function registerPDFOpenIpc() {
  ipcMain.handle("dialog:openFile", async (event, ...args) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!(await askRendererCanLeave(win))) return null;

    return readPdfFile(event, ...args);
  });
}

module.exports = { registerPDFOpenIpc };
