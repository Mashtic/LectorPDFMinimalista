const {ipcMain, dialog } = require('electron')
const fs = require('fs/promises')

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  })
  if (canceled || filePaths.length === 0) return null

  const content = await fs.readFile(filePaths[0], 'utf-8')
  return { path: filePaths[0], content }
})
