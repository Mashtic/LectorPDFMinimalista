const { BrowserWindow, ipcMain, screen } = require("electron");

const WINDOW_TOP_BAR_HEIGHT = 32;
const WINDOW_MARGIN = 20;
const FLOATING_WIDTH_RATIO = 0.5;

function isValidDocumentSize(documentSize) {
  return (
    documentSize &&
    Number.isFinite(documentSize.width) &&
    Number.isFinite(documentSize.height) &&
    documentSize.width > 0 &&
    documentSize.height > 0
  );
}

function getFloatingWindowSize(win, documentSize) {
  const { workAreaSize } = screen.getDisplayMatching(win.getBounds());
  const maxWidth = Math.floor(workAreaSize.width * FLOATING_WIDTH_RATIO);
  const maxHeight = Math.floor(workAreaSize.height * 0.9);
  const documentWidth = Math.ceil(documentSize.width);
  const width = Math.min(documentWidth + WINDOW_MARGIN, maxWidth);
  const scale = Math.min(1, (width - WINDOW_MARGIN) / documentWidth);
  const documentHeight = Math.ceil(documentSize.height * scale);
  const height = Math.min(
    documentHeight + WINDOW_TOP_BAR_HEIGHT + WINDOW_MARGIN,
    maxHeight,
  );
  return [width, height];
}

function getWorkAreaPosition(win) {
  const { workArea } = screen.getDisplayMatching(win.getBounds());
  return [workArea.x, workArea.y];
}

function registerWindowIpc() {
  ipcMain.on("toggle-fullscreen", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return;
    }
    win.setFullScreen(!win.isFullScreen());
  });

  ipcMain.on("set-floating-mode", (event, isFloating, documentSize) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || typeof isFloating !== "boolean") {
      return;
    }
    if (isFloating && !win.isAlwaysOnTop()) {
      win.normalWindowSize = win.getSize();
      win.normalWindowPosition = win.getPosition();
    }
    win.setAlwaysOnTop(isFloating);
    if (isFloating && isValidDocumentSize(documentSize)) {
      win.setSize(...getFloatingWindowSize(win, documentSize));
      win.setPosition(...getWorkAreaPosition(win));
      event.sender.send("floating-window-sized");
    } else if (!isFloating && win.normalWindowSize) {
      win.setSize(...win.normalWindowSize);
      win.setPosition(...win.normalWindowPosition);
      delete win.normalWindowSize;
      delete win.normalWindowPosition;
    }
  });
}

module.exports = {
  registerWindowIpc,
};
