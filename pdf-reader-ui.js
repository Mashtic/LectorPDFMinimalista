// INICIO BLOQUE: lógica exclusiva para abrir y leer PDFs en simultáneo.
// Este módulo no crea ni guarda PDFs combinados.
function initializePdfReader() {
  const { pathToFileURL } = require('url');
  const { webUtils } = require('electron');
  const fileInput = document.getElementById('file-input');
  const readers = document.getElementById('readers');
  const emptyState = document.getElementById('empty-state');
  const modeMessage = document.getElementById('mode-message');
  const dialog = document.getElementById('choice-dialog');
  const panes = [...document.querySelectorAll('.reader-pane')];
  let activePane = 0;
  let pendingFile = null;

  function notifyPaneChange() { document.dispatchEvent(new CustomEvent('pdf-pane-change')); }
  function visiblePanes() { return panes.filter((pane) => pane.classList.contains('visible')); }
  function setActivePane(index) {
    activePane = index;
    panes.forEach((pane, paneIndex) => pane.classList.toggle('active', paneIndex === index && pane.classList.contains('visible')));
  }
  function updateLayout() {
    const count = visiblePanes().length;
    readers.classList.toggle('split', count === 2);
    emptyState.classList.toggle('hidden', count !== 0);
    modeMessage.textContent = count === 0 ? 'Selecciona un archivo PDF para comenzar.' : count === 1 ? 'Abre otro PDF para reemplazarlo o verlo en simultáneo.' : 'Modo simultáneo: cada panel tiene sus propias páginas y controles.';
  }
  function showPdfPathInPane(filePath, fileName, index) {
    const pane = panes[index];
    pane.querySelector('.viewer').src = pathToFileURL(filePath).href;
    pane.dataset.filePath = filePath;
    pane.querySelector('.file-name').textContent = fileName;
    pane.querySelector('.viewer').title = `Documento PDF: ${fileName}`;
    pane.classList.add('visible');
    setActivePane(index);
    updateLayout();
    notifyPaneChange();
  }
  function openFileInPane(file, index) { showPdfPathInPane(webUtils.getPathForFile(file), file.name, index); }
  function showMergePreview(filePath, fileName) {
    closePane(1);
    showPdfPathInPane(filePath, `Vista previa: ${fileName}`, 0);
  }
  function closePane(index) {
    const pane = panes[index];
    pane.querySelector('.viewer').src = 'about:blank';
    delete pane.dataset.filePath;
    pane.classList.remove('visible', 'active');
    const remaining = visiblePanes();
    if (remaining.length === 1) setActivePane(Number(remaining[0].dataset.pane));
    updateLayout();
    notifyPaneChange();
  }

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    fileInput.value = '';
    if (!file) return;
    const openCount = visiblePanes().length;
    if (openCount === 0) openFileInPane(file, 0);
    else if (openCount === 1) { pendingFile = file; dialog.showModal(); }
    else openFileInPane(file, activePane);
  });
  document.getElementById('replace-choice').addEventListener('click', () => { if (pendingFile) openFileInPane(pendingFile, activePane); pendingFile = null; dialog.close(); });
  document.getElementById('split-choice').addEventListener('click', () => { const availablePane = panes.findIndex((pane) => !pane.classList.contains('visible')); if (pendingFile && availablePane !== -1) openFileInPane(pendingFile, availablePane); pendingFile = null; dialog.close(); });
  document.getElementById('cancel-choice').addEventListener('click', () => { pendingFile = null; dialog.close(); });
  panes.forEach((pane, index) => {
    pane.addEventListener('pointerdown', () => setActivePane(index));
    pane.querySelector('.close-pane').addEventListener('click', (event) => { event.stopPropagation(); closePane(index); });
  });
  // API mínima para que el módulo de combinación pueda mostrar su vista previa.
  window.pdfReader = { showMergePreview };
}
// FIN BLOQUE: lógica exclusiva para abrir y leer PDFs en simultáneo.
