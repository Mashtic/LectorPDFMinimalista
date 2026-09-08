const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { cleanupPreviews, registerPdfMergeHandler } = require('./pdf-merge-service');

function createWindow () {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      plugins: true, 
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

// INICIO BLOQUE: registro de la función aislada de combinación de PDFs.
registerPdfMergeHandler({ ipcMain, dialog, BrowserWindow, app });
// FIN BLOQUE: registro de la función aislada de combinación de PDFs.

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => { cleanupPreviews(); });
