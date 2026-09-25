const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  openPdfDialog: (callback) => {
    ipcRenderer.on("dialog:openPdfDialog", callback);
  },

  saveFile: () => ipcRenderer.invoke("dialog:saveFile"),
  saveCurrentPdf: () => ipcRenderer.invoke("pdf:saveCurrent"),
  openSaveFileDialog: (callback) => {
    ipcRenderer.on("dialog:openSaveFileDialog", callback);
  },
  openSaveCurrentPdfDialog: (callback) => {
    ipcRenderer.on("dialog:openSaveCurrentPdfDialog", callback);
  },

  setFloatingMode: (isFloating, documentSize) =>
    ipcRenderer.send("set-floating-mode", isFloating, documentSize),
  onFloatingWindowSized: (callback) => {
    ipcRenderer.on("floating-window-sized", callback);
  },

  deletePages: (pages) => ipcRenderer.invoke("pdfMod:deletePages", pages),
  openDeletePagesModal: (callback) => {
    ipcRenderer.on("pdfMod:openDeletePagesModal", callback);
  },

  appendPdf: () => ipcRenderer.invoke("dialog:appendPdf"),
  appendPdfContent: (content) =>
    ipcRenderer.invoke("pdf:append-content", content),
  openAppendDialog: (callback) => {
    ipcRenderer.on("dialog:openAppendDialog", callback);
  },

  setGlobalVar: (key, value) =>
    ipcRenderer.invoke("global-var:set", key, value),
  getGlobalVar: (key) => ipcRenderer.invoke("global-var:get", key),
});
