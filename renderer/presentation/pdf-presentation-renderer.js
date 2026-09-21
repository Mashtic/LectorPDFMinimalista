import { PdfPresentationViewer } from "./pdf-presentation-viewer.js";

const currentPDF = await window.electronAPI.getGlobalVar("currentPDF");
const currentPage = await window.electronAPI.getGlobalVar("currentPage");

var mouseTimeout;
var isMouseHidden = false;

let viewer;

if (currentPDF) {
  viewer = new PdfPresentationViewer(currentPDF, currentPage);

  viewer.load();

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "arrowleft") {
      event.preventDefault();
      viewer.prevPage();
    }

    if (event.key.toLowerCase() === "arrowright") {
      event.preventDefault();
      viewer.nextPage();
    }

    if (event.key === "Escape") {
      window.top.close();
    }
  });

  document.addEventListener("wheel", (event) => {
    if (event.deltaY < 0) {
      event.preventDefault();
      viewer.prevPage();
    }

    if (event.deltaY > 0) {
      event.preventDefault();
      viewer.nextPage();
    }
  });
}

document.addEventListener("mousemove", handleMouseMove);

function handleMouseMove() {
  if (mouseTimeout) {
    clearTimeout(mouseTimeout);
  }

  mouseTimeout = setTimeout(() => {
    if (!isMouseHidden) {
      document.querySelector("body").style.cursor = "none";
      isMouseHidden = true;
    }
  }, 3000);

  if (isMouseHidden) {
    document.querySelector("body").style.cursor = "auto";
    isMouseHidden = false;
  }
}
