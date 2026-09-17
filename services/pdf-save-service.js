const { dialog } = require('electron');
const { writeFile } = require('node:fs/promises');
const {getGlobalVar} = require('./global-var-service.js')

async function writePdfFile() {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: getGlobalVar("pdfPath"),
    filters: [
      {
        name: 'PDF Files',
        extensions: ['pdf'],
      },
    ],
  });

  if (canceled || filePath == "") {
    return false;
  }

  await writeFile(filePath, getGlobalVar("currentPDF"));
  return true;
}

module.exports = { writePdfFile};
