const { dialog, BrowserWindow } = require('electron');
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

async function readDocumentFile(event) {
  const owner = event?.sender ? BrowserWindow.fromWebContents(event.sender) : undefined;
  const options = {
    properties: ['openFile'],
    filters: [{ name: 'Documents', extensions: ['pdf', 'md', 'markdown', 'mdown'] }],
  };
  const { canceled, filePaths } = owner
    ? await dialog.showOpenDialog(owner, options)
    : await dialog.showOpenDialog(options);
  if (canceled || filePaths.length === 0) return null;
  const filePath = filePaths[0];
  const isMarkdown = /\.(md|markdown|mdown)$/i.test(filePath);
  return {
    path: filePath,
    type: isMarkdown ? 'markdown' : 'pdf',
    content: isMarkdown ? await readFile(filePath, 'utf8') : await readFile(filePath),
  };
}


async function readPdfFromPath(filePath) {
  const content = await readFile(filePath);

  return { path: filePath, content};
}

module.exports = { readPdfFile, readDocumentFile, readPdfFromPath };
