import { PdfViewer } from "./pdf-viewer.js";
import { PdfSearchController } from "../search/pdf-search.js";
import { initializeSearchBar } from "../search/search-bar.js";
import { initializeSidebar } from "../sidebar/sidebar.js";

const welcomeScreen = document.getElementById("welcome-screen");
const viewContainer = document.getElementById("pdf-viewer-container");
const viewerActions = document.getElementById("viewer-actions");
const currentPDF = await window.electronAPI.getGlobalVar("currentPDF");

let viewer;
let ticking = false;

const pageInput = document.getElementById("pdf-page-count");

if (currentPDF) {
  welcomeScreen.style.display = "none";
  viewContainer.style.display = "block";
  viewerActions.hidden = false;

  viewer = new PdfViewer(currentPDF);
  const searchController = new PdfSearchController(viewer);
  viewer.onTextLayerRendered = (pageNumber) => searchController.onPageRendered(pageNumber);
  viewer.onTextLayerUnloaded = (pageNumber) => searchController.onPageUnloaded(pageNumber);

  await viewer.load();
  const firstPage = document.querySelector(".pdf-page");

  if (firstPage) {
    document.dispatchEvent(
      new CustomEvent("pdf-document-loaded", {
        detail: {
          width: firstPage.offsetWidth,
          height: firstPage.offsetHeight,
        },
      }),
    );
  }
  window.electronAPI.onFloatingWindowSized(() => {
    viewer.fitWidth(viewContainer.clientWidth);
  });

  document.addEventListener("floating-mode-entered", () => {
    viewer.resetZoom();
  });

  initializeSearchBar(searchController);
  initializeSidebar(viewer);

  document.addEventListener("keydown", (event) => {
    if (!event.ctrlKey) {
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

  viewContainer.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      viewer.zoomAtPoint(
        event.clientX,
        event.clientY,
        event.deltaY < 0 ? "in" : "out",
      );
    },
    { passive: false },
  );
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

pageInput.addEventListener("click", () => {
  pageInput.select();
});

pageInput.addEventListener("keydown", (event) => {
  if (!viewer) return;

  if (event.key.toLowerCase() === "enter") {
    const pageNumber = parseInt(pageInput.value, 10);

    viewer.jumpToPage(pageNumber);
  }
});