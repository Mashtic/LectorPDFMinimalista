export async function openFile() {
  const file = await window.electronAPI.openFile();
  if (file) {
    window.electronAPI.setGlobalVar("pdfPath", file.path);
    window.electronAPI.setGlobalVar("currentPDF", file.content);
    window.location.reload();
  }
}
