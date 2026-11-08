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

module.exports = { registerUnsavedChangesIpc, askRendererCanLeave };
