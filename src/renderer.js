import { PdfPresentationViewer } from './pdf/PdfPresentationViewer.js';

const { ipcRenderer } = require('electron');

function toggleFullscreen() {
    ipcRenderer.send('toggle-fullscreen');
}

const viewer = new PdfPresentationViewer('./src/pdf/test/pdf.pdf');

viewer.load();

document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'a') {
        event.preventDefault();
        toggleFullscreen();
    }
});
