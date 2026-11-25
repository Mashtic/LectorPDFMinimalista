const { ipcMain, BrowserWindow } = require("electron");
const { readPdfFile } = require("../services/pdf-open-service");
const { askRendererCanLeave } = require("./unsaved-changes-ipc.js");

function registerPDFOpenIpc() {
  async function openFile(event, includeMarkdown) {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!(await askRendererCanLeave(win))) return null;

    return readPdfFile(event, includeMarkdown);
  }

  ipcMain.handle("dialog:openFile", (event) => openFile(event, false));
  ipcMain.handle("dialog:openDocument", (event) => openFile(event, true));
}

module.exports = { registerPDFOpenIpc };
