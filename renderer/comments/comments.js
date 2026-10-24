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
let latestLoadId = 0;
let annotationStore = null;
let pendingReplaces = null;

import("./annotation-store.js").then((module) => {
  annotationStore = module.annotationStore;
  annotationStore.addEventListener("change", refreshComments);
  refreshComments();
});

async function refreshComments() {
  if (!annotationStore) return;

  const loadId = ++latestLoadId;
  const entries = await annotationStore.getAllComments();

  if (loadId !== latestLoadId) return;

  comments = entries.map((e) => ({
    text: e.text,
    quote: e.quote,
    page: e.pageNumber,
    quads: Array.from(e.annotation.quadPoints || []),
    rect: e.annotation.rect || null,
    createdAt: "",
  }));

  renderComments();
}

document.addEventListener(
  "contextmenu",
  (event) => {
    const page = event.target.closest?.(".pdf-page");
    contextPage = page ? Number(page.dataset.pageNumber) : null;
  },
  true,
);

async function openComments(
  selectedText,
  { page = null, quads = null, replaces = null } = {},
) {
  pendingQuote = (selectedText ?? "").trim();
  pendingReplaces = replaces;

  // Geometry comes from the live selection, unless the caller already has it
  // (a click on an existing highlight)
  const selectedGeometry =
    pendingQuote && !quads ? captureSelectionGeometry() : null;
  window.getSelection()?.removeAllRanges();
  pendingQuads =
    quads ??
    (selectedGeometry
      ? await convertSelectionToPdfQuads(selectedGeometry)
      : []);

  panel.hidden = false;
  quote.hidden = !pendingQuote;
  quote.textContent = pendingQuote ? `“${pendingQuote}”` : "";
  form.dataset.page = page || selectedGeometry?.pageNumber || contextPage || "";
  input.focus();
}

window.electronAPI.onOpenComments((selectedText) => openComments(selectedText));

// Used by the floating selection button and the highlight palette
document.addEventListener("open-comments", (event) =>
  openComments(event.detail?.text, event.detail),
);

closeButton.addEventListener("click", () => {
  panel.hidden = true;
  pendingQuote = "";
  pendingReplaces = null;
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
  const id = annotationStore.createComment({
    pageNumber: page,
    text: message,
    quote: pendingQuote,
    quads: pendingQuads,
  });

  // A comment made from an existing highlight takes its place
  if (id && pendingReplaces) {
    document.dispatchEvent(
      new CustomEvent("comment-replaced-highlight", {
        detail: pendingReplaces,
      }),
    );
  }

  input.value = "";
  pendingQuote = "";
  pendingQuads = [];
  pendingReplaces = null;
  quote.hidden = true;
  form.dataset.page = "";
});

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
  const pdfDocument = annotationStore?.document;
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

async function goToComment(comment) {
  const pdfDocument = annotationStore?.document;
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
