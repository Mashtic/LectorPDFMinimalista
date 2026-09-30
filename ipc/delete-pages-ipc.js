const { ipcMain } = require('electron');
const deletePages = require('../services/delete-pages-service');
const reorderPages = require('../services/reorder-pages-service');

function registerDeletePageIpc() {
  ipcMain.handle('pdfMod:deletePages', async (event, pages) => {
    return deletePages(pages);
  });
  ipcMain.handle('pdfMod:reorderPages', async (event, pages) => {
    return reorderPages(pages);
  });
}

module.exports = {
  registerDeletePageIpc,
};
