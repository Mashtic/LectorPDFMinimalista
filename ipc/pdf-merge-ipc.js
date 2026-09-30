const { ipcMain, dialog, BrowserWindow, app } = require("electron");

const {
  combinePdfBytes,
  createPreview,
  removePreview,
  getPreview,
  savePreview,
} = require("../services/pdf-merge-service");
const { getGlobalVar, setGlobalVar } = require('../services/global-var-service.js');

async function appendPdfToCurrent(pdfBytes) {
  const currentPDF = getGlobalVar('currentPDF');
  if (!currentPDF) {
    throw new Error('Abre un PDF antes de añadir otro.');
  }

  setGlobalVar('currentPDF', await combinePdfBytes(currentPDF, pdfBytes));
  setGlobalVar('pdfPath', null);
  return true;
}

function registerPDFMergeIpc() {
  ipcMain.handle('dialog:appendPdf', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (canceled || filePaths.length === 0) return false;

    const pdfBytes = await require('node:fs/promises').readFile(filePaths[0]);
    return appendPdfToCurrent(pdfBytes);
  });

  ipcMain.handle('pdf:append-content', (_event, pdfBytes) =>
    appendPdfToCurrent(pdfBytes),
  );

  ipcMain.handle("pdf:prepare-merge", async (event, firstFile, secondFile) => {
    if (
      ![firstFile, secondFile].every(
        (file) =>
          typeof file === "string" && file.toLowerCase().endsWith(".pdf"),
      )
    ) {
      throw new Error("Selecciona dos archivos PDF válidos para combinarlos.");
    }

    await removePreview(event.sender.id);

    return createPreview(
      event.sender.id,
      firstFile,
      secondFile,
      app.getPath("temp"),
    );
  });

  ipcMain.handle("pdf:save-preview", async (event, previewPath, fileName) => {
    if (getPreview(event.sender.id) !== previewPath) {
      throw new Error(
        "La vista previa ya no está disponible. Vuelve a combinar los documentos.",
      );
    }

    const { canceled, filePath } = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Guardar PDF combinado",
        defaultPath: fileName,
        filters: [
          {
            name: "Documento PDF",
            extensions: ["pdf"],
          },
        ],
      },
    );

    if (canceled || !filePath) {
      return { canceled: true };
    }

    await savePreview(previewPath, filePath);

    return {
      canceled: false,
      filePath,
    };
  });

  ipcMain.handle("pdf:discard-preview", (event) =>
    removePreview(event.sender.id),
  );
}

module.exports = {
  registerPDFMergeIpc,
};
