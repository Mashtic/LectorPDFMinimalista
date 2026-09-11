const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('./src/pdf/OpenFile.js');
const deletePages = require('./src/pdf/delete-pages/DeletePages.js');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      plugins: true,
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile('index.html');

  ipcMain.on('toggle-fullscreen', () => {
      win.setFullScreen(!win.isFullScreen());
  });

  ipcMain.on('set-floating-mode', (event, isFloating) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.setAlwaysOnTop(isFloating);
    }
  });

  ipcMain.handle('pdfMod:deletePages', async (event, pdfBytes, pages) => {
    return deletePages(pdfBytes, pages);
  });
}

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

  win.loadFile('./src/pdf/presentation/PdfPresentationScreen.html');
}

app.whenReady().then(() => {
  createWindow();
  createPresentationWindow()
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
