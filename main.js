const { app, BrowserWindow } = require('electron');

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

function createZoomWindow () {
  const zoomWin = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      plugins: true, 
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  zoomWin.loadFile('src/Zoom/zoomScreen.html');

}


app.whenReady().then(createWindow);
app.whenReady().then(createZoomWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});