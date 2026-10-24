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

  document.addEventListener("floating-mode-entered", () => {
    viewer.resetZoom();
  });

  initializeSearchBar(searchController);
  initializeSidebar(viewer);

  // --- Floating selection toolbar (highlight + comment) ----------------
  const selectionToolbar = document.createElement("div");
  selectionToolbar.id = "selection-toolbar";
  selectionToolbar.hidden = true;
  document.body.appendChild(selectionToolbar);

  // Keep the text selection alive when a button is pressed
  selectionToolbar.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  const selectionHighlightButton = document.createElement("button");
  selectionHighlightButton.type = "button";
  selectionHighlightButton.className = "highlight-action-button";
  selectionHighlightButton.title = "Highlight";
  selectionHighlightButton.setAttribute("aria-label", "Highlight selection");
  selectionHighlightButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
         viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="m9 11-6 6v3h9l3-3"/>
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
    </svg>
  `;
  selectionHighlightButton.addEventListener("click", () => {
    viewer.annotationManager.addHighlightFromSelection();
    selectionToolbar.hidden = true;
  });

  const selectionCommentButton = document.createElement("button");
  selectionCommentButton.type = "button";
  selectionCommentButton.className = "highlight-action-button";
  selectionCommentButton.title = "Add comment";
  selectionCommentButton.setAttribute("aria-label", "Add comment to selection");
  selectionCommentButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
         viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  `;
  selectionCommentButton.addEventListener("click", () => {
    // Same flow as the old context-menu item. The panel reads the current
    // selection itself, so it must still exist when this fires (the
    // toolbar's mousedown handler keeps it alive).
    const text = window.getSelection()?.toString() ?? "";
    selectionToolbar.hidden = true;
    document.dispatchEvent(
      new CustomEvent("open-comments", { detail: { text } }),
    );
  });

  selectionToolbar.append(selectionHighlightButton, selectionCommentButton);

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

  const positionSelectionToolbar = () => {
    const range = getViewerSelectionRange();
    if (!range) {
      selectionToolbar.hidden = true;
      return;
    }

    const rects = range.getClientRects();
    const last = rects[rects.length - 1];
    const bounds = viewContainer.getBoundingClientRect();

    // Selection scrolled out of view
    if (!last || last.bottom < bounds.top || last.top > bounds.bottom) {
      selectionToolbar.hidden = true;
      return;
    }

    selectionToolbar.hidden = false;
    const { offsetWidth: width, offsetHeight: height } = selectionToolbar;
    const left = Math.min(
      Math.max(last.right - width / 2, 8),
      window.innerWidth - width - 8,
    );
    const top = Math.min(last.bottom + 8, window.innerHeight - height - 8);
    selectionToolbar.style.left = `${left}px`;
    selectionToolbar.style.top = `${top}px`;
  };

  // Mouse selection: show once the user releases the button
  viewContainer.addEventListener("mouseup", () => {
    setTimeout(positionSelectionToolbar, 0);
  });

  // Keyboard selection (shift+arrows, ctrl+A, ...)
  document.addEventListener("keyup", (event) => {
    if (event.key.startsWith("Arrow") || event.key.toLowerCase() === "a") {
      positionSelectionToolbar();
    }
  });

  // Hide as soon as the selection disappears
  document.addEventListener("selectionchange", () => {
    if (!getViewerSelectionRange()) selectionToolbar.hidden = true;
  });

  // Follow the selection while scrolling
  viewContainer.addEventListener("scroll", () => {
    if (!selectionToolbar.hidden) positionSelectionToolbar();
  });

  // --- Highlight action buttons (colors + comment + delete) ------------
  const HIGHLIGHT_COLORS = [
    { name: "Red", rgb: [255, 107, 107] },
    { name: "Blue", rgb: [100, 181, 246] },
    { name: "Yellow", rgb: [255, 235, 59] },
    { name: "Green", rgb: [144, 238, 144] }, // the default highlight color
  ];

  const palette = document.createElement("div");
  palette.id = "highlight-color-palette";
  palette.hidden = true;
  document.body.appendChild(palette);

  let paletteTarget = null; // { id, pageNumber, annotation }

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

  // pdf.js quads are already [left, top, right, top, left, bottom, right,
  // bottom], which is the shape createComment() expects, 8 numbers per quad
  const highlightToQuads = (annotation) => {
    const flat = Array.from(annotation.quadPoints ?? []);
    const quads = [];
    for (let i = 0; i + 7 < flat.length; i += 8) {
      quads.push(flat.slice(i, i + 8));
    }
    if (quads.length === 0 && annotation.rect) {
      const [left, bottom, right, top] = annotation.rect;
      quads.push([left, top, right, top, left, bottom, right, bottom]);
    }
    return quads;
  };

  const paletteCommentButton = document.createElement("button");
  paletteCommentButton.type = "button";
  paletteCommentButton.className = "highlight-action-button";
  paletteCommentButton.title = "Add comment";
  paletteCommentButton.setAttribute("aria-label", "Add comment");
  paletteCommentButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
         viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  `;
  paletteCommentButton.addEventListener("click", () => {
    if (!paletteTarget) return;
    const { id, pageNumber, annotation } = paletteTarget;
    hidePalette();
    document.dispatchEvent(
      new CustomEvent("open-comments", {
        detail: {
          text: "",
          page: pageNumber,
          quads: highlightToQuads(annotation),
          replaces: { id, pageNumber },
        },
      }),
    );
  });
  palette.appendChild(paletteCommentButton);

  // The comment replaces the highlight it was created from
  document.addEventListener("comment-replaced-highlight", (event) => {
    const { id, pageNumber } = event.detail;
    viewer.annotationManager.deleteHighlight(id, pageNumber);
  });

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
    paletteTarget = { id: annotation.id, pageNumber, annotation };

    // Mark the highlight's current color
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

  // Close when clicking elsewhere, pressing Escape, or scrolling/zooming
  document.addEventListener("mousedown", (event) => {
    if (!palette.hidden && !palette.contains(event.target)) hidePalette();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hidePalette();
  });
  viewContainer.addEventListener("scroll", hidePalette);
  viewContainer.addEventListener("wheel", hidePalette, { passive: true });
  showSignatureStatus();

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
