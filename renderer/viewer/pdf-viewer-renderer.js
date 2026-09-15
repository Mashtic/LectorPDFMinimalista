import { PdfViewer } from "./pdf-viewer.js";

const welcomeScreen = document.getElementById("welcome-screen");
const viewContainer = document.getElementById("pdf-viewer-container");
const currentPDF = await window.electronAPI.getGlobalVar("currentPDF");

let viewer;
let ticking = false;

if (currentPDF) {
  welcomeScreen.style.display = "none";
  viewContainer.style.display = "block";

  viewer = new PdfViewer(currentPDF);
  viewer.load();

  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey)) {
      return;
    }

    if (event.code === "Equal" || event.code === "NumpadAdd") {
      event.preventDefault();
      viewer.zoomInPages();
    } else if (event.code === "Minus" || event.code === "NumpadSubtract") {
      event.preventDefault();
      viewer.zoomOutPages();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "c") {
    const selection = window.getSelection();
    const text = selection?.toString();

    if (!text) return;

    navigator.clipboard.writeText(text);
  }
});

viewContainer.addEventListener("scroll", () => {
  if (!viewer) return;
  if (ticking) return;

  ticking = true;

  requestAnimationFrame(() => {
    viewer.updateCurrentPage();
    ticking = false;
  });
});
