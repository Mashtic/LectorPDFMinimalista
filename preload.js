const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  deletePages: (pages) => ipcRenderer.invoke('pdfMod:deletePages', pages),
  setGlobalVar: (key, value) =>
    ipcRenderer.invoke('global-var:set', key, value),
  getGlobalVar: (key) => ipcRenderer.invoke('global-var:get', key),
});
