// INICIO BLOQUE: controles aislados para crear un PDF combinado.
// Se comunica con el servicio principal sin cambiar la lógica de los visores.
function initializePdfMerge() {
const { ipcRenderer, webUtils } = require('electron');

const mergeButton = document.getElementById('merge-button');
const mergeStatus = document.getElementById('merge-status');
const mergeFileInput = document.getElementById('merge-file-input');
const readerFileInput = document.getElementById('file-input');
let preview = null;

function openPdfPaths() {
  return [...document.querySelectorAll('.reader-pane.visible')]
    .sort((first, second) => Number(first.dataset.pane) - Number(second.dataset.pane))
    .map((pane) => pane.dataset.filePath)
    .filter(Boolean);
}

function updateMergeButton() {
  const [firstFile, secondFile] = openPdfPaths();
  if (preview) return;
  mergeButton.disabled = !firstFile;
  if (!firstFile) mergeStatus.textContent = 'Abre un PDF para comenzar a combinar.';
  else if (!secondFile) mergeStatus.textContent = 'Pulsa para añadir otro PDF al final.';
  else mergeStatus.textContent = 'Se unirán en este orden: documento izquierdo y después documento derecho.';
}

async function preparePreview(firstFile, secondFile) {
  mergeButton.disabled = true;
  mergeStatus.textContent = 'Creando vista previa…';
  try {
    const result = await ipcRenderer.invoke('pdf:prepare-merge', firstFile, secondFile);
    preview = result;
    window.pdfReader.showMergePreview(result.previewPath, result.fileName);
    mergeButton.textContent = 'Guardar PDF combinado';
    mergeButton.disabled = false;
    readerFileInput.disabled = true;
    mergeStatus.textContent = 'Revisa el PDF unido. Cuando estés listo, pulsa Guardar PDF combinado.';
  } catch (error) {
    mergeStatus.textContent = `No se pudo combinar: ${error.message}`;
    updateMergeButton();
  }
}

mergeButton.addEventListener('click', async () => {
  if (preview) {
    mergeButton.disabled = true;
    try {
      const result = await ipcRenderer.invoke('pdf:save-preview', preview.previewPath, preview.fileName);
      if (result.canceled) {
        mergeStatus.textContent = 'Guardado cancelado. La vista previa sigue disponible.';
      } else {
        mergeStatus.textContent = `PDF combinado guardado como ${result.filePath.split(/[\\/]/).pop()}.`;
        preview = null;
        mergeButton.textContent = 'Unir PDF';
        readerFileInput.disabled = false;
      }
    } catch (error) {
      mergeStatus.textContent = `No se pudo guardar: ${error.message}`;
    } finally {
      mergeButton.disabled = false;
    }
    return;
  }
  const [firstFile, secondFile] = openPdfPaths();
  if (!firstFile) return;
  if (secondFile) return preparePreview(firstFile, secondFile);
  mergeFileInput.click();
});

mergeFileInput.addEventListener('change', () => {
  const secondFile = mergeFileInput.files[0];
  mergeFileInput.value = '';
  const [firstFile] = openPdfPaths();
  if (firstFile && secondFile) preparePreview(firstFile, webUtils.getPathForFile(secondFile));
});

document.addEventListener('pdf-pane-change', updateMergeButton);
updateMergeButton();
}
// FIN BLOQUE: controles aislados para crear un PDF combinado.
