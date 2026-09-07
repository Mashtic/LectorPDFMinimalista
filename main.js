const { app, BrowserWindow, ipcMain } = require('electron');

function createWindow() {
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

    // ipcMain.on('toggle-fullscreen', () => {
    //     win.setFullScreen(!win.isFullScreen());
    // });

    ipcMain.on('set-floating-mode', (event, isFloating) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
            window.setAlwaysOnTop(isFloating);
        }
    });
}

function createPresentationWindow() {
    const win = new BrowserWindow({
        fullscreen: true,
        frame: false,
        webPreferences: {
            plugins: true,
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    win.loadFile('./src/pdf/presentation/PdfPresentationScreen.html')
}

app.whenReady().then(() => {
    createWindow()
    createPresentationWindow()
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
