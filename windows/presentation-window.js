const { BrowserWindow } = require("electron");
const path = require("path");

function createPresentationWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    frame: false,
    webPreferences: {
      plugins: true,
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload.js"),
    },
    icon: path.join(__dirname, '../build/icon.png'),
  });

  win.loadFile(
    path.join(
      __dirname,
      "../renderer/presentation/pdf-presentation-screen.html",
    ),
  );

  return win;
}

module.exports = {
  createPresentationWindow,
};
