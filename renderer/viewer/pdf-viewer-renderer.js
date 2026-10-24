import { PdfViewer } from "./pdf-viewer.js";
import { PdfSearchController } from "../search/pdf-search.js";
import { initializeSearchBar } from "../search/search-bar.js";
import { initializeSidebar } from "../sidebar/sidebar.js";
import { showSignatureStatus } from "../signature-status/signature-status-renderer.js";

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
  viewer.onTextLayerRendered = (pageNumber) =>
    searchController.onPageRendered(pageNumber);
  viewer.onTextLayerUnloaded = (pageNumber) =>
    searchController.onPageUnloaded(pageNumber);

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

  // window.electronAPI.addHighlight(() => {
  //   viewer.annotationManager.addHighlightFromSelection()
  // });

  document.addEventListener("floating-mode-entered", () => {
    viewer.resetZoom();
  });

  initializeSearchBar(searchController);
  initializeSidebar(viewer);
  showSignatureStatus();

  const HIGHLIGHT_COLORS = [
    { name: "Red", rgb: [255, 107, 107] },
    { name: "Blue", rgb: [100, 181, 246] },
    { name: "Yellow", rgb: [255, 235, 59] },
    { name: "Green", rgb: [144, 238, 144] },
  ];

  const palette = document.createElement("div");
  palette.id = "highlight-color-palette";
  palette.hidden = true;
  document.body.appendChild(palette);

  let paletteTarget = null;

  const hidePalette = () => {
    palette.hidden = true;
    paletteTarget = null;
  };

  for (const { name, rgb } of HIGHLIGHT_COLORS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "highlight-action-button highlight-color-button";
    button.title = name;
    button.setAttribute("aria-label", `${name} highlight`);
    button.dataset.color = rgb.join(",");
    button.innerHTML = `<span class="highlight-color-dot"
      style="background-color: rgb(${rgb.join(",")})"></span>`;
    button.addEventListener("click", () => {
      if (!paletteTarget) return;
      viewer.annotationManager.setHighlightColor(
        paletteTarget.id,
        paletteTarget.pageNumber,
        rgb,
      );
      hidePalette();
    });
    palette.appendChild(button);
  }

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "highlight-action-button highlight-delete-button";
  deleteButton.title = "Delete highlight";
  deleteButton.setAttribute("aria-label", "Delete highlight");
  deleteButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
         viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M3 6h18"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <path d="M10 11v6"/>
      <path d="M14 11v6"/>
    </svg>
  `;
  deleteButton.addEventListener("click", () => {
    if (!paletteTarget) return;
    viewer.annotationManager.deleteHighlight(
      paletteTarget.id,
      paletteTarget.pageNumber,
    );
    hidePalette();
  });
  palette.appendChild(deleteButton);

  viewer.annotationManager.onHighlightClick = ({
    pageNumber,
    annotation,
    event,
  }) => {
    paletteTarget = { id: annotation.id, pageNumber };

    const current = Array.from(annotation.color ?? [144, 238, 144]).join(",");
    for (const button of palette.querySelectorAll(".highlight-color-button")) {
      button.classList.toggle("active", button.dataset.color === current);
    }

    palette.hidden = false;
    const { offsetWidth: width, offsetHeight: height } = palette;
    palette.style.left = `${Math.min(
      Math.max(event.clientX - width / 2, 8),
      window.innerWidth - width - 8,
    )}px`;
    palette.style.top = `${Math.min(
      event.clientY + 14,
      window.innerHeight - height - 8,
    )}px`;
  };

  document.addEventListener("mousedown", (event) => {
    if (!palette.hidden && !palette.contains(event.target)) hidePalette();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hidePalette();
  });
  viewContainer.addEventListener("scroll", hidePalette);
  viewContainer.addEventListener("wheel", hidePalette, { passive: true });

  const highlightButton = document.createElement("button");
  highlightButton.id = "floating-highlight-button";
  highlightButton.type = "button";
  highlightButton.title = "Highlight";
  highlightButton.setAttribute("aria-label", "Highlight selection");
  highlightButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
         viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="m9 11-6 6v3h9l3-3"/>
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
    </svg>
  `;
  highlightButton.hidden = true;
  document.body.appendChild(highlightButton);

  highlightButton.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  highlightButton.addEventListener("click", () => {
    viewer.annotationManager.addHighlightFromSelection();
    highlightButton.hidden = true;
  });

  const getViewerSelectionRange = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }
    const range = selection.getRangeAt(0);
    const container =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;
    return viewContainer.contains(container) ? range : null;
  };

  const positionHighlightButton = () => {
    const range = getViewerSelectionRange();
    if (!range) {
      highlightButton.hidden = true;
      return;
    }

    const rects = range.getClientRects();
    const last = rects[rects.length - 1];
    const bounds = viewContainer.getBoundingClientRect();

    if (!last || last.bottom < bounds.top || last.top > bounds.bottom) {
      highlightButton.hidden = true;
      return;
    }

    highlightButton.hidden = false;
    const { offsetWidth: width, offsetHeight: height } = highlightButton;
    const left = Math.min(
      Math.max(last.right - width / 2, 8),
      window.innerWidth - width - 8,
    );
    const top = Math.min(last.bottom + 8, window.innerHeight - height - 8);
    highlightButton.style.left = `${left}px`;
    highlightButton.style.top = `${top}px`;
  };

  viewContainer.addEventListener("mouseup", () => {
    setTimeout(positionHighlightButton, 0);
  });

  document.addEventListener("keyup", (event) => {
    if (event.key.startsWith("Arrow") || event.key.toLowerCase() === "a") {
      positionHighlightButton();
    }
  });

  document.addEventListener("selectionchange", () => {
    if (!getViewerSelectionRange()) highlightButton.hidden = true;
  });

  viewContainer.addEventListener("scroll", () => {
    if (!highlightButton.hidden) positionHighlightButton();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "j") {
      viewer.skipDown();
    } else if (event.key.toLowerCase() === "k") {
      viewer.skipUp();
    }
  });

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

  document.addEventListener("pdf-comment-added", (event) => {
    viewer.commitPDFChange(event.detail);
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

  viewer.onDocumentModified = (dataPDF) => {
    document.dispatchEvent(
      new CustomEvent("pdf-modified", { detail: dataPDF }),
    );
  };
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
