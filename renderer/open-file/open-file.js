export async function openFile() {
  const currentPDF = await window.electronAPI.getGlobalVar('currentPDF');
  if (currentPDF == null) {
    const file = await window.electronAPI.openFile();
    if (file) {
      window.electronAPI.setGlobalVar('pdfPath', file.path);
      window.electronAPI.setGlobalVar('currentPDF', file.content);
      window.location.reload()
    }
  }
}
