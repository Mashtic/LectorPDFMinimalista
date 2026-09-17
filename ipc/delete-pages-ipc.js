const { ipcMain } = require('electron');
const deletePages = require('../services/delete-pages-service');

function registerDeletePageIpc() {
  ipcMain.handle('pdfMod:deletePages', async (event, pages) => {
    return deletePages(pages);
  });
}

module.exports = {
  registerDeletePageIpc,
};
