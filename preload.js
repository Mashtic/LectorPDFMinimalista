const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    deletePages: (pdfBytes, pages) => ipcRenderer.invoke('pdfMod:deletePages', pdfBytes, pages),
})
