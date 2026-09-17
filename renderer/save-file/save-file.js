
export async function saveFile() {
  const currentPDF = await window.electronAPI.getGlobalVar('currentPDF');
  if (currentPDF) {
    await window.electronAPI.saveFile();
  }
}
