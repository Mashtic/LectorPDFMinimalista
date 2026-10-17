const panel = document.getElementById("comments-panel");
const list = document.getElementById("comments-list");
const form = document.getElementById("comment-form");
const input = document.getElementById("comment-input");
const quote = document.getElementById("comment-selection");
const count = document.getElementById("comments-count");
const closeButton = document.getElementById("comments-close");

let comments = [];
let contextPage = null;
let pendingQuote = "";
let pendingQuads = [];
let pdfData = null;
let pdfDocument = null;
let loadingTask = null;
let latestLoadId = 0;

const pdfDataReady = window.electronAPI
  .getGlobalVar("currentPDF")
  .then((data) => {
    pdfData = data;
    loadPdfComments();
  });

document.addEventListener(
  "contextmenu",
  (event) => {
    const page = event.target.closest?.(".pdf-page");
    contextPage = page ? Number(page.dataset.pageNumber) : null;
  },
  true,
);

window.electronAPI.onOpenComments(async (selectedText) => {
  pendingQuote = selectedText.trim();
  const selectedGeometry = pendingQuote ? captureSelectionGeometry() : null;
  window.getSelection()?.removeAllRanges();
  await loadPdfComments();
  pendingQuads = selectedGeometry
    ? await convertSelectionToPdfQuads(selectedGeometry)
    : [];
  panel.hidden = false;
  quote.hidden = !pendingQuote;
  quote.textContent = pendingQuote ? `“${pendingQuote}”` : "";
  form.dataset.page = selectedGeometry?.pageNumber || contextPage || "";
  input.focus();
});

closeButton.addEventListener("click", () => {
  panel.hidden = true;
  pendingQuote = "";
  quote.hidden = true;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  const page =
    Number(form.dataset.page) ||
    Number(document.getElementById("pdf-page-count").value) ||
    1;
  window.electronAPI
    .addPdfComment({
      pageNumber: page,
      text: message,
      quote: pendingQuote,
      quads: pendingQuads,
    })
    .then((updatedData) => {
      pdfData = new Uint8Array(updatedData);
      document.dispatchEvent(
        new CustomEvent("pdf-comment-added", { detail: updatedData }),
      );
      comments.push({
        text: message,
        quote: pendingQuote,
        page,
        quads: pendingQuads,
        createdAt: new Date().toISOString(),
      });
      input.value = "";
      pendingQuote = "";
      pendingQuads = [];
      quote.hidden = true;
      form.dataset.page = "";
      // The PDF is the only source of truth: re-read the list from it
      loadPdfComments();
    })
    .catch((error) => console.error("Could not add the PDF comment", error));
});

async function loadPdfComments() {
  await pdfDataReady;
  if (!pdfData) return;

  // Only the most recent call may update the list (calls can overlap)
  const loadId = ++latestLoadId;

  try {
    const { getDocument } =
      await import("../../node_modules/pdfjs-dist/build/pdf.mjs");
    const { getAnnotationText, isCommentable, formatPDFDate } =
      await import("./highlight-comments.js");

    const newLoadingTask = getDocument({ data: new Uint8Array(pdfData) });
    const loadedDocument = await newLoadingTask.promise;

    const savedComments = [];
    for (let page = 1; page <= loadedDocument.numPages; page++) {
      const pdfPage = await loadedDocument.getPage(page);
      // Same filter as the comment bubbles, so both always agree
      const annotations = await pdfPage.getAnnotations({ intent: "display" });
      for (const annotation of annotations) {
        const annotationText =
          annotation.contents ||
          annotation.contentsObj?.str ||
          annotation.richText?.str ||
          "";
        if (annotationText.trim()) {
          savedComments.push({
            text: annotationText,
            quote: annotation.subject || "",
            page,
            quads: Array.from(annotation.quadPoints || []),
            rect: annotation.rect || null,
            createdAt: "",
          });
        }
      }
    }

    if (loadId !== latestLoadId) {
      await newLoadingTask.destroy();
      return;
    }

    const previousLoadingTask = loadingTask;
    loadingTask = newLoadingTask;
    pdfDocument = loadedDocument;
    comments = savedComments;
    renderComments();

    // Release the previous document so it does not leak
    await previousLoadingTask?.destroy();
  } catch (error) {
    console.error("Could not read PDF comments", error);
  }
}

function captureSelectionGeometry() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
    return null;

  const range = selection.getRangeAt(0);
  const rangeStart =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
  const pageWrapper = rangeStart?.closest(".pdf-page");
  if (!pageWrapper) return null;
  const canvas = pageWrapper.querySelector("canvas[data-page-number]");
  if (!canvas) return null;

  const pageBounds = pageWrapper.getBoundingClientRect();
  const rects = Array.from(range.getClientRects())
    .filter(
      (rect) =>
        rect.left < pageBounds.right &&
        rect.right > pageBounds.left &&
        rect.top < pageBounds.bottom &&
        rect.bottom > pageBounds.top,
    )
    .map((rect) => ({
      left: Math.max(0, rect.left - pageBounds.left),
      top: Math.max(0, rect.top - pageBounds.top),
      right: Math.min(pageBounds.width, rect.right - pageBounds.left),
      bottom: Math.min(pageBounds.height, rect.bottom - pageBounds.top),
    }));
  return {
    pageNumber: Number(canvas.dataset.pageNumber),
    pageWidth: pageBounds.width,
    rects,
  };
}

async function convertSelectionToPdfQuads(geometry) {
  if (!pdfDocument || !geometry?.rects.length) return [];
  const page = await pdfDocument.getPage(geometry.pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = geometry.pageWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  return geometry.rects.map(({ left, top, right, bottom }) => {
    const topLeft = viewport.convertToPdfPoint(left, top);
    const topRight = viewport.convertToPdfPoint(right, top);
    const bottomLeft = viewport.convertToPdfPoint(left, bottom);
    const bottomRight = viewport.convertToPdfPoint(right, bottom);
    return [...topLeft, ...topRight, ...bottomLeft, ...bottomRight];
  });
}

function renderComments() {
  list.replaceChildren();
  count.textContent = `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`;

  for (const comment of comments) {
    const card = document.createElement("article");
    card.className = "comment-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Go to comment on page ${comment.page}`);
    card.addEventListener("click", () => goToComment(comment));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        goToComment(comment);
      }
    });

    if (comment.quote) {
      const excerpt = document.createElement("blockquote");
      excerpt.textContent = `“${comment.quote}”`;
      card.append(excerpt);
    }

    const body = document.createElement("p");
    body.textContent = comment.text;
    card.append(body);

    // createdAt is already formatted by loadPdfComments
    const details = document.createElement("div");
    details.className = "comment-meta";
    details.textContent = [
      comment.page ? `Page ${comment.page}` : "",
      comment.createdAt,
    ]
      .filter(Boolean)
      .join(" · ");
    card.append(details);
    list.append(card);
  }
}

document.addEventListener("pdf-modified", (event) => {
  pdfData = new Uint8Array(event.detail);
  loadPdfComments();
});
async function goToComment(comment) {
  const pageNumber = Number(comment.page);
  const wrapper = document
    .querySelector(`.pdf-page canvas[data-page-number="${pageNumber}"]`)
    ?.closest(".pdf-page");
  if (!wrapper) return;

  const container = document.getElementById("pdf-viewer-container");
  const canvas = wrapper.querySelector("canvas");
  const page = pdfDocument && (await pdfDocument.getPage(pageNumber));
  const viewport = page?.getViewport({
    scale: canvas.clientWidth / page.getViewport({ scale: 1 }).width,
  });
  let targetY = 0;

  if (viewport && comment.quads?.length) {
    const quad = comment.quads.slice(0, 8);
    targetY = Math.min(
      ...[1, 3, 5, 7].map(
        (index) =>
          viewport.convertToViewportPoint(quad[index - 1], quad[index])[1],
      ),
    );
  } else if (viewport && comment.rect?.length === 4) {
    targetY = viewport.convertToViewportPoint(
      comment.rect[0],
      comment.rect[3],
    )[1];
  }

  const pageOffset =
    wrapper.getBoundingClientRect().top - container.getBoundingClientRect().top;
  container.scrollTop += pageOffset + targetY - 24;
  document.getElementById("pdf-page-count").value = pageNumber;
  highlightCommentLocation(wrapper, viewport, comment);
}

function highlightCommentLocation(wrapper, viewport, comment) {
  document
    .querySelectorAll(".comment-location-highlight")
    .forEach((element) => element.remove());
  const quads = comment.quads || [];
  const rectangles = [];

  if (viewport && quads.length >= 8) {
    for (let index = 0; index + 7 < quads.length; index += 8) {
      const points = [0, 2, 4, 6].map((offset) =>
        viewport.convertToViewportPoint(
          quads[index + offset],
          quads[index + offset + 1],
        ),
      );
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      rectangles.push({
        left: Math.min(...xs),
        top: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      });
    }
  } else if (viewport && comment.rect?.length === 4) {
    const [left, bottom] = viewport.convertToViewportPoint(
      comment.rect[0],
      comment.rect[1],
    );
    const [right, top] = viewport.convertToViewportPoint(
      comment.rect[2],
      comment.rect[3],
    );
    rectangles.push({
      left: Math.min(left, right),
      top: Math.min(top, bottom),
      width: Math.abs(right - left),
      height: Math.abs(bottom - top),
    });
  }

  rectangles.forEach((rect) => {
    const marker = document.createElement("div");
    marker.className = "comment-location-highlight";
    Object.assign(marker.style, {
      position: "absolute",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${Math.max(rect.height, 3)}px`,
      background: "rgb(255 210 50 / 45%)",
      outline: "2px solid rgb(220 155 0 / 75%)",
      pointerEvents: "none",
      zIndex: "5",
    });
    wrapper.append(marker);
  });
  if (rectangles.length)
    setTimeout(
      () =>
        wrapper
          .querySelectorAll(".comment-location-highlight")
          .forEach((element) => element.remove()),
      1800,
    );
}
