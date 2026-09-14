const { BrowserWindow } = require("electron");
const path = require("path");

function createPresentationWindow() {
  const win = new BrowserWindow({
    fullscreen: true,
    frame: false,
    webPreferences: {
      plugins: true,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(
    path.join(__dirname, "../renderer/presentation/PdfPresentationScreen.html"),
  );

  return win;
}

module.exports = {
  createPresentationWindow,
};
