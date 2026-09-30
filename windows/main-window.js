const { BrowserWindow, globalShortcut } = require("electron");
const path = require("path");
const { showContextMenu } = require("./context-menu.js");

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      plugins: true,
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload.js"),
    },
    icon: path.join(__dirname, '../build/icon.png'),
  });

  win.loadFile(path.join(__dirname, "../renderer/index.html"));

  win.webContents.on("context-menu", () => {
    showContextMenu(win);
  });

  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "m") {
      showContextMenu(win);
    }
  });

  return win;
}

module.exports = {
  createMainWindow,
};
