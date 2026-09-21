const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  openPdfDialog: (callback) => {
    ipcRenderer.on("dialog:openPdfDialog", callback);
  },
  saveFile: () => ipcRenderer.invoke("dialog:saveFile"),
  openSaveFileDialog: (callback) => {
    ipcRenderer.on("dialog:openSaveFileDialog", callback);
  },
  deletePages: (pages) => ipcRenderer.invoke("pdfMod:deletePages", pages),
  openDeletePagesModal: (callback) => {
    ipcRenderer.on("pdfMod:openDeletePagesModal", callback);
  },
  setGlobalVar: (key, value) =>
    ipcRenderer.invoke("global-var:set", key, value),
  getGlobalVar: (key) => ipcRenderer.invoke("global-var:get", key),
});
