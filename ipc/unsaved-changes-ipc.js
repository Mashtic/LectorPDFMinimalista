const { app, BrowserWindow, ipcMain } = require("electron");

let nextRequestId = 0;
const approvedToClose = new WeakSet();

function askRendererCanLeave(win) {
  return new Promise((resolve) => {
    if (
      !win ||
      win.isDestroyed() ||
      win.webContents.isDestroyed() ||
      win.webContents.isCrashed()
    ) {
      resolve(true);
      return;
    }

    const requestId = ++nextRequestId;

    const onResponse = (_event, responseId, canContinue) => {
      if (responseId !== requestId) return;
      ipcMain.removeListener("unsaved-changes-response", onResponse);
      resolve(Boolean(canContinue));
    };

    ipcMain.on("unsaved-changes-response", onResponse);
    win.webContents.send("check-unsaved-changes", requestId);
  });
}

function flushRendererPdf(webContents, timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!webContents || webContents.isDestroyed()) {
      resolve();
      return;
    }

    const requestId = ++nextRequestId;
    let timer;

    const onResponse = (_event, responseId) => {
      if (responseId !== requestId) return;
      clearTimeout(timer);
      ipcMain.removeListener("flush-pdf-response", onResponse);
      resolve();
    };

    timer = setTimeout(() => {
      ipcMain.removeListener("flush-pdf-response", onResponse);
      resolve();
    }, timeoutMs);

    ipcMain.on("flush-pdf-response", onResponse);
    webContents.send("flush-pdf", requestId);
  });
}

function registerUnsavedChangesIpc() {
  app.on("browser-window-created", (_event, win) => {
    win.on("close", async (event) => {
      if (approvedToClose.has(win)) return;

      event.preventDefault();
      if (await askRendererCanLeave(win)) {
        approvedToClose.add(win);
        win.close();
      }
    });
  });
}

module.exports = {
  registerUnsavedChangesIpc,
  askRendererCanLeave,
  flushRendererPdf,
};
