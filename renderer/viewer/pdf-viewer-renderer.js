import { PdfViewer } from "./pdf-viewer.js";

const welcomeScreen = document.getElementById("welcome-screen");
const viewContainer = document.getElementById("pdf-viewer-container");
const pdf_json = sessionStorage.getItem("currentPDF");

if (pdf_json) {
  welcomeScreen.style.display = "none";
  viewContainer.style.display = "block";

  const currentPDF = pdf_json ? new Uint8Array(JSON.parse(pdf_json)) : null;

  if (currentPDF) {
    const viewer = new PdfViewer(currentPDF);
    viewer.load();
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "c") {
    const selection = window.getSelection();
    const text = selection?.toString();

    if (!text) return;

    navigator.clipboard.writeText(text);
  }
});
