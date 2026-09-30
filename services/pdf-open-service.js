const { dialog } = require('electron');
const { readFile } = require('node:fs/promises');

async function readPdfFile() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      {
        name: 'PDF Files',
        extensions: ['pdf'],
      },
    ],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const fileContent = await readFile(filePaths[0]);

  return {path: filePaths[0], content: fileContent};
}

module.exports = { readPdfFile };
