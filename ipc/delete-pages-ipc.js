const { ipcMain } = require("electron");
const deletePages = require("../services/delete-pages-service");

function registerDeletePageIpc() {
  ipcMain.handle("pdfMod:deletePages", async (event, pdfBytes, pages) => {
    return deletePages(pdfBytes, pages);
  });
}

module.exports = {
  registerDeletePageIpc,
};
