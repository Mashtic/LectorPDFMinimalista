
let saveStatusTimeout;

function showSaveSuccessMessage() {
  const saveStatus = document.getElementById("save-status");
  if (!saveStatus) {
    return;
  }
  saveStatus.textContent = "PDF saved successfully";
  saveStatus.classList.add("is-visible");
  clearTimeout(saveStatusTimeout);
  saveStatusTimeout = setTimeout(() => {
    saveStatus.classList.remove("is-visible");
  }, 2500);
}

export async function saveFile() {
  const currentPDF = await window.electronAPI.getGlobalVar('currentPDF');
  if (currentPDF) {
    await window.electronAPI.saveFile();
  }
}

export async function saveCurrentPdf() {
  const currentPDF = await window.electronAPI.getGlobalVar("currentPDF");
  if (currentPDF) {
    const wasSaved = await window.electronAPI.saveCurrentPdf();
    if (wasSaved) {
      showSaveSuccessMessage();
    }
  }
}
