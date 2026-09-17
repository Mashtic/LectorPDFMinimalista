import { PdfViewer } from './pdf-viewer.js';

const welcomeScreen = document.getElementById('welcome-screen');
const viewContainer = document.getElementById('pdf-viewer-container');
const currentPDF = await window.electronAPI.getGlobalVar('currentPDF');

if (currentPDF) {
  welcomeScreen.style.display = 'none';
  viewContainer.style.display = 'block';

  const viewer = new PdfViewer(currentPDF);
  viewer.load();
}

document.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'c') {
    const selection = window.getSelection();
    const text = selection?.toString();

    if (!text) return;

    navigator.clipboard.writeText(text);
  }
});
