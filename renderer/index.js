import { openFile } from "./open-file/open-file.js";
import { openDeletePagesModal } from "./delete-pages/delete-pages-renderer.js";
import { saveCurrentPdf, saveFile } from "./save-file/save-file.js";
import "./window/window.js";

// if (await window.electronAPI.getGlobalVar("currentPDF")) {
//   document.getElementById("SaveFileBtn").style = "display: block;";
// }

document.getElementById("OpenFileBtn").addEventListener("click", openFile);

// document
//   .getElementById("DeletePagesBtn")
//   .addEventListener("click", openDeletePagesModal);

// document.getElementById("SaveFileBtn").addEventListener("click", saveFile);

window.electronAPI.openDeletePagesModal(() => {
  openDeletePagesModal();
});

window.electronAPI.openPdfDialog(() => {
  openFile();
});

window.electronAPI.openSaveFileDialog(() => {
  saveFile();
});

window.electronAPI.openSaveCurrentPdfDialog(() => {
  saveCurrentPdf();
});
