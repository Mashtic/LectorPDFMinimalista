// INICIO BLOQUE: servicio aislado para combinar documentos PDF.
// Este archivo solo se ocupa de leer, unir y guardar PDFs; no modifica el visor.
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const previewFiles = new Map();

function suggestedName(firstFile, secondFile) {
  const first = path.basename(firstFile, path.extname(firstFile));
  const second = path.basename(secondFile, path.extname(secondFile));
  return `${first} + ${second}.pdf`;
}

async function combinePdfFiles(firstFile, secondFile) {
  const combined = await PDFDocument.create();

  for (const filePath of [firstFile, secondFile]) {
    const source = await PDFDocument.load(await fs.readFile(filePath));
    const pages = await combined.copyPages(source, source.getPageIndices());
    pages.forEach((page) => combined.addPage(page));
  }

  return combined.save();
}

async function removePreview(senderId) {
  const previewPath = previewFiles.get(senderId);
  previewFiles.delete(senderId);
  if (previewPath) await fs.rm(previewPath, { force: true });
}

function registerPdfMergeHandler({ ipcMain, dialog, BrowserWindow, app }) {
  // Prepara una copia temporal para que el usuario pueda revisarla antes de guardar.
  ipcMain.handle('pdf:prepare-merge', async (event, firstFile, secondFile) => {
    if (![firstFile, secondFile].every((file) => typeof file === 'string' && file.toLowerCase().endsWith('.pdf'))) {
      throw new Error('Selecciona dos archivos PDF válidos para combinarlos.');
    }

    await removePreview(event.sender.id);
    const previewPath = path.join(app.getPath('temp'), `lector-pdf-vista-previa-${Date.now()}-${event.sender.id}.pdf`);
    await fs.writeFile(previewPath, await combinePdfFiles(firstFile, secondFile));
    previewFiles.set(event.sender.id, previewPath);
    return { previewPath, fileName: suggestedName(firstFile, secondFile) };
  });

  // Solo guarda el archivo temporal que se mostró previamente en el visor.
  ipcMain.handle('pdf:save-preview', async (event, previewPath, fileName) => {
    if (previewFiles.get(event.sender.id) !== previewPath) throw new Error('La vista previa ya no está disponible. Vuelve a combinar los documentos.');
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
      title: 'Guardar PDF combinado',
      defaultPath: fileName,
      filters: [{ name: 'Documento PDF', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { canceled: true };
    await fs.copyFile(previewPath, filePath);
    return { canceled: false, filePath };
  });

  ipcMain.handle('pdf:discard-preview', (event) => removePreview(event.sender.id));
}

async function cleanupPreviews() {
  await Promise.all([...previewFiles.keys()].map(removePreview));
}

module.exports = { cleanupPreviews, combinePdfFiles, registerPdfMergeHandler };
// FIN BLOQUE: servicio aislado para combinar documentos PDF.
