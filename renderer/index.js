import { appendPdf, openFile, openPdfFromFile } from "./open-file/open-file.js";
import { openDeletePagesModal } from "./delete-pages/delete-pages-renderer.js";
import { saveCurrentPdf, saveFile } from "./save-file/save-file.js";
import "./window/window.js";


document.getElementById("OpenFileBtn").addEventListener("click", openFile);

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

window.electronAPI.openAppendDialog(() => {
  appendPdf();
});

document.addEventListener("dragover", (event) => {
  if ([...(event.dataTransfer?.files || [])].some(isPdf)) {
    event.preventDefault();
    document.body.classList.add("is-dropping-pdf");
  }
});

document.addEventListener("dragleave", (event) => {
  if (!event.relatedTarget) document.body.classList.remove("is-dropping-pdf");
});

document.addEventListener("drop", async (event) => {
  document.body.classList.remove("is-dropping-pdf");
  const file = [...(event.dataTransfer?.files || [])].find(isPdf);
  if (!file) return;

  event.preventDefault();
  await openPdfFromFile(file);
});

document.addEventListener("paste", async (event) => {
  const file = [...(event.clipboardData?.files || [])].find(isPdf);
  if (!file) return;

  event.preventDefault();
  await openPdfFromFile(file);
});

function isPdf(file) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
}
