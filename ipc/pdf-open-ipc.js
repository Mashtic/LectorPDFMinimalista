const { ipcMain, dialog } = require("electron");

const { readPdfFile } = require("../services/pdf-open-service");

function registerPDFOpenIpc() {
  ipcMain.handle("dialog:openFile", async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "PDF Files",
          extensions: ["pdf"],
        },
      ],
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    return readPdfFile(filePaths[0]);
  });
}

module.exports = {
  registerPDFOpenIpc,
};
