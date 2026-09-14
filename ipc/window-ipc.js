const { BrowserWindow, ipcMain } = require("electron");

function registerWindowIpc() {
  ipcMain.on("toggle-fullscreen", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    if (!win) {
      return;
    }

    win.setFullScreen(!win.isFullScreen());
  });

  ipcMain.on("set-floating-mode", (event, isFloating) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    if (!win) {
      return;
    }

    win.setAlwaysOnTop(isFloating);
  });
}

module.exports = {
  registerWindowIpc,
};
