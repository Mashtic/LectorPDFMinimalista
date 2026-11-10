import { appendPdf, openFile, openDocument, openPdfFromFile } from "./open-file/open-file.js";
import { saveCurrentPdf, saveFile } from "./save-file/save-file.js";
import { openSignDocumentModal } from "./sign-document/sign-document-renderer.js";
import { insertSignatureImage } from "./signature-image/signature-image-renderer.js";
import "./window/window.js";


document.getElementById("OpenFileBtn").addEventListener("click", openDocument);
document.addEventListener("keydown", (event) => {
  const target = event.target;
  const typing = target?.isContentEditable || ["INPUT", "TEXTAREA"].includes(target?.tagName);
  if (!typing && event.key.toLowerCase() === "m" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    window.electronAPI.showContextMenu();
  }
});
window.electronAPI.onOpenMarkdownDialog(async () => {
  if (await window.electronAPI.openMarkdown()) window.location.reload();
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

window.electronAPI.openSignModal(() => {
  openSignDocumentModal();
});

window.electronAPI.onInsertSignatureImage(() => {
  insertSignatureImage();
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
