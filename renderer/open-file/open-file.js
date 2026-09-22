export async function openFile() {
  const file = await window.electronAPI.openFile();
  if (file) {
    // Conserva el flujo de apertura original; ahora también puede reemplazar
    // un documento que ya esté cargado.
    window.electronAPI.setGlobalVar('pdfPath', file.path);
    window.electronAPI.setGlobalVar('currentPDF', file.content);
    window.location.reload();
  }
}

export async function appendPdf() {
  if (await window.electronAPI.appendPdf()) {
    window.location.reload();
  }
}

export async function openPdfFromFile(file) {
  if (!file || !isPdf(file)) return false;

  const content = new Uint8Array(await file.arrayBuffer());
  const currentPDF = await window.electronAPI.getGlobalVar('currentPDF');

  if (currentPDF) {
    await window.electronAPI.appendPdfContent(content);
    window.location.reload();
    return true;
  }

  await window.electronAPI.setGlobalVar('pdfPath', null);
  await window.electronAPI.setGlobalVar('currentPDF', content);
  window.location.reload();
  return true;
}

function isPdf(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}
