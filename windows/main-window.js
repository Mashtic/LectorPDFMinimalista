const { BrowserWindow, globalShortcut, ipcMain } = require("electron");
const path = require("path");
const { showContextMenu } = require("./context-menu.js");

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      plugins: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload.js"),
    },
    icon: path.join(__dirname, "../build/icon.png"),
  });

  let textInputFocused = false;
  const onTextInputFocus = (event, focused) => {
    if (event.sender === win.webContents) textInputFocused = Boolean(focused);
  };
  ipcMain.on("text-input-focus", onTextInputFocus);
  win.on("closed", () =>
    ipcMain.removeListener("text-input-focus", onTextInputFocus),
  );

  win.loadFile(path.join(__dirname, "../renderer/index.html"));

  win.webContents.on("context-menu", (_event, params) => {
    showContextMenu(win, params.selectionText);
  });

  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.control && input.shift && input.key.toLowerCase() == "i") {
      win.webContents.openDevTools(); 
    }
  });

  return win;
}

module.exports = {
  createMainWindow,
};
