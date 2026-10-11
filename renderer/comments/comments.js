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

window.electronAPI.getGlobalVar("currentPDF").then((data) => {
  pdfData = data;
  renderComments();
});

document.addEventListener("contextmenu", (event) => {
  const page = event.target.closest?.(".pdf-page");
  contextPage = page ? Number(page.dataset.pageNumber) : null;
}, true);

window.electronAPI.onOpenComments(async (selectedText) => {
  pendingQuote = selectedText.trim();
  const selectedGeometry = pendingQuote ? captureSelectionGeometry() : null;
  await loadPdfComments();
  pendingQuads = selectedGeometry ? await convertSelectionToPdfQuads(selectedGeometry) : [];
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

  const page = Number(form.dataset.page) || Number(document.getElementById("pdf-page-count").value) || 1;
  window.electronAPI.addPdfComment({ pageNumber: page, text: message, quote: pendingQuote, quads: pendingQuads })
    .then((updatedData) => {
      pdfData = new Uint8Array(updatedData);
      comments.push({ text: message, quote: pendingQuote, page, createdAt: new Date().toISOString() });
      input.value = "";
      pendingQuote = "";
      pendingQuads = [];
      quote.hidden = true;
      form.dataset.page = "";
      renderComments();
    })
    .catch((error) => console.error("Could not add the PDF comment", error));
});

async function loadPdfComments() {
  if (!pdfData) return;
  try {
    const { getDocument } = await import("../../node_modules/pdfjs-dist/build/pdf.mjs");
    pdfDocument = await getDocument({ data: new Uint8Array(pdfData) }).promise;
    const savedComments = [];
    for (let page = 1; page <= pdfDocument.numPages; page++) {
      const pdfPage = await pdfDocument.getPage(page);
      const annotations = await pdfPage.getAnnotations();
      for (const annotation of annotations) {
        if (["Text", "Highlight"].includes(annotation.subtype) && annotation.contents) {
          savedComments.push({ text: annotation.contents, quote: annotation.subject || "", page, createdAt: "" });
        }
      }
    }
    comments = savedComments;
    renderComments();
  } catch (error) {
    console.error("Could not read PDF comments", error);
  }
}

function captureSelectionGeometry() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  const rangeStart = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer
    : range.startContainer.parentElement;
  const pageWrapper = rangeStart?.closest(".pdf-page");
  if (!pageWrapper) return null;
  const canvas = pageWrapper.querySelector("canvas[data-page-number]");
  if (!canvas) return null;

  const pageBounds = pageWrapper.getBoundingClientRect();
  const rects = Array.from(range.getClientRects())
    .filter((rect) => rect.left < pageBounds.right && rect.right > pageBounds.left && rect.top < pageBounds.bottom && rect.bottom > pageBounds.top)
    .map((rect) => ({
      left: Math.max(0, rect.left - pageBounds.left),
      top: Math.max(0, rect.top - pageBounds.top),
      right: Math.min(pageBounds.width, rect.right - pageBounds.left),
      bottom: Math.min(pageBounds.height, rect.bottom - pageBounds.top),
    }));
  return { pageNumber: Number(canvas.dataset.pageNumber), pageWidth: pageBounds.width, rects };
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

    if (comment.quote) {
      const excerpt = document.createElement("blockquote");
      excerpt.textContent = `“${comment.quote}”`;
      card.append(excerpt);
    }

    const body = document.createElement("p");
    body.textContent = comment.text;
    card.append(body);

    const details = document.createElement("div");
    details.className = "comment-meta";
    const date = new Date(comment.createdAt);
    details.textContent = `${comment.page ? `Page ${comment.page}` : ""}${comment.createdAt ? `${comment.page ? " · " : ""}${date.toLocaleString("en-US")}` : ""}`;
    card.append(details);
    list.append(card);
  }
}
