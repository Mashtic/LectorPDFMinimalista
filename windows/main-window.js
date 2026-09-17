const { BrowserWindow } = require("electron");
const path = require("path");

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
  });

  win.loadFile(path.join(__dirname, "../renderer/index.html"));

  return win;
}

module.exports = {
  createMainWindow,
};
