import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFRef,
  PDFHexString,
  PDFString,
} from "../../node_modules/pdf-lib/dist/pdf-lib.esm.js";

function refFromAnnotationId(id) {
  const match = /^(\d+)R(\d*)$/.exec(id);
  if (!match) return null;
  return PDFRef.of(Number(match[1]), match[2] ? Number(match[2]) : 0);
}

function sameRef(a, b) {
  return (
    a instanceof PDFRef &&
    a.objectNumber === b.objectNumber &&
    a.generationNumber === b.generationNumber
  );
}

function indexOfRef(annots, ref) {
  for (let i = 0; i < annots.size(); i++) {
    if (sameRef(annots.get(i), ref)) return i;
  }
  return -1;
}

function findAnnotation(doc, pageNumber, id) {
  const ref = refFromAnnotationId(id);
  const annots = doc.getPages()[pageNumber - 1]?.node.Annots();

  if (!ref || !annots) {
    throw new Error(`Annotation ${id} not found on page ${pageNumber}`);
  }

  const index = indexOfRef(annots, ref);
  if (index === -1) {
    throw new Error(`Annotation ${id} not found on page ${pageNumber}`);
  }

  return { annots, ref, dict: doc.context.lookup(ref, PDFDict) };
}

export async function setHighlightComment(pdfBytes, pageNumber, id, text) {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const { dict } = findAnnotation(doc, pageNumber, id);

  const contents = PDFName.of("Contents");
  const targets = [dict];
  const popup = dict.lookupMaybe(PDFName.of("Popup"), PDFDict);
  if (popup) targets.push(popup);

  for (const target of targets) {
    if (text) target.set(contents, PDFHexString.fromText(text));
    else target.delete(contents);
  }

  // Rich-text copy would otherwise show the stale comment in other readers
  dict.delete(PDFName.of("RC"));
  dict.set(PDFName.of("M"), PDFString.fromDate(new Date()));

  return doc.save();
}

export async function deleteHighlight(pdfBytes, pageNumber, id) {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const { annots, ref, dict } = findAnnotation(doc, pageNumber, id);

  const toRemove = [ref];

  const popupRef = dict.get(PDFName.of("Popup"));
  if (popupRef instanceof PDFRef) toRemove.push(popupRef);

  for (let i = 0; i < annots.size(); i++) {
    const other = annots.get(i);
    if (!(other instanceof PDFRef)) continue;
    const otherDict = doc.context.lookupMaybe(other, PDFDict);
    if (sameRef(otherDict?.get(PDFName.of("IRT")), ref)) toRemove.push(other);
  }

  for (const target of toRemove) {
    const index = indexOfRef(annots, target);
    if (index !== -1) annots.remove(index);
    doc.context.delete(target);
  }

  return doc.save();
}

const COMMENTABLE_SUBTYPES = new Set([
  "Highlight",
  "Underline",
  "StrikeOut",
  "Squiggly",
  "Text",
  "Square",
  "Circle",
  "Line",
  "Polygon",
  "PolyLine",
  "Ink",
  "Stamp",
  "Caret",
  "FileAttachment",
]);

export function isCommentable(annotation) {
  return COMMENTABLE_SUBTYPES.has(annotation.subtype) && !annotation.inReplyTo;
}

export function getAnnotationText(annotation) {
  return annotation.contentsObj?.str ?? annotation.contents ?? "";
}

function normalizeQuads(annotation) {
  const raw = annotation.quadPoints;
  const quads = [];

  const fromNumbers = (n) => [
    { x: n[0], y: n[1] },
    { x: n[2], y: n[3] },
    { x: n[4], y: n[5] },
    { x: n[6], y: n[7] },
  ];

  if (raw?.length) {
    if (typeof raw[0] === "number") {
      for (let i = 0; i + 7 < raw.length; i += 8) {
        quads.push(fromNumbers(raw.slice(i, i + 8)));
      }
    } else {
      for (const item of raw) {
        if (item?.length === 8) quads.push(fromNumbers(item));
        else if (item?.[0]?.x !== undefined) quads.push(Array.from(item));
      }
    }
  }

  if (!quads.length && annotation.rect) {
    const [x1, y1, x2, y2] = annotation.rect;
    quads.push([
      { x: x1, y: y2 },
      { x: x2, y: y2 },
      { x: x1, y: y1 },
      { x: x2, y: y1 },
    ]);
  }

  return quads;
}

export function getHighlightRects(annotation, viewport) {
  return normalizeQuads(annotation).map((quad) => {
    const xs = quad.map((p) => p.x);
    const ys = quad.map((p) => p.y);
    const [x1, y1] = viewport.convertToViewportPoint(
      Math.min(...xs),
      Math.min(...ys),
    );
    const [x2, y2] = viewport.convertToViewportPoint(
      Math.max(...xs),
      Math.max(...ys),
    );
    return {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  });
}

// TODO: Change this for something not made with AI
// At least improve the looks or something xd

let popupEl = null;
let removeOutsideListener = null;

function injectStyles() {
  if (document.getElementById("highlight-comment-styles")) return;

  const style = document.createElement("style");
  style.id = "highlight-comment-styles";
  style.textContent = `
    .highlight-comment-layer { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
    .highlight-comment-button {
      display: flex; align-items: center; justify-content: center; padding: 0;
      border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 3px;
      background: rgba(255, 255, 255, 0.8); color: #444; cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    .highlight-comment-button:hover { background: #fff; }
    .highlight-comment-button { user-select: none; -webkit-user-select: none; }
    /* While the mouse is down (e.g. selecting text) buttons must not catch it */
    html.highlight-comment-selecting .highlight-comment-button { pointer-events: none !important; }
    .highlight-comment-tooltip {
      position: fixed; z-index: 1000; max-width: 260px; padding: 8px 10px;
      background: #fff; color: #222; border: 1px solid #bbb; border-radius: 8px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25); font: 13px system-ui, sans-serif;
      pointer-events: none; white-space: pre-wrap; overflow-wrap: anywhere;
    }
    .highlight-comment-tooltip .author { color: #777; font-size: 11px; margin-bottom: 4px; }
    .highlight-comment-popup {
      position: fixed; z-index: 1000; width: 280px; padding: 10px;
      background: #fff; color: #222; border: 1px solid #bbb; border-radius: 8px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25); font: 13px system-ui, sans-serif;
      outline: none;
    }
    .highlight-comment-popup [hidden] { display: none !important; }
    .highlight-comment-popup .header { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .highlight-comment-popup .meta {
      flex: 1; min-width: 0; margin: -4px 0 -4px -4px; padding: 4px;
      color: #777; font-size: 11px; line-height: 1.4;
      cursor: move; user-select: none; touch-action: none;
    }
    .highlight-comment-popup .tools { display: flex; gap: 2px; }
    .highlight-comment-popup .icon-button {
      display: flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; padding: 0; border: none; border-radius: 4px;
      background: transparent; color: #555; cursor: pointer;
    }
    .highlight-comment-popup .icon-button:hover:not(:disabled) { background: rgba(0, 0, 0, 0.08); }
    .highlight-comment-popup .icon-button.danger:hover:not(:disabled) { color: #b00020; }
    .highlight-comment-popup .icon-button:disabled { opacity: 0.4; cursor: default; }
    .highlight-comment-popup .comment-text {
      white-space: pre-wrap; overflow-wrap: anywhere; max-height: 200px; overflow: auto;
    }
    .highlight-comment-popup textarea {
      width: 100%; min-height: 90px; box-sizing: border-box; resize: vertical;
      font: inherit; padding: 6px; border: 1px solid #ccc; border-radius: 4px;
    }
    .highlight-comment-popup .actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }
    .highlight-comment-popup .actions button { font: inherit; padding: 4px 10px; cursor: pointer; }
  `;
  document.head.appendChild(style);
}

let tooltipEl = null;

export function hideCommentTooltip() {
  tooltipEl?.remove();
  tooltipEl = null;
}

export function isCommentPopupOpen() {
  return popupEl !== null;
}

/** Read-only hover preview of a comment, placed at (x, y) in client coordinates. */
export function showCommentTooltip({ x, y, text, author }) {
  injectStyles();
  hideCommentTooltip();

  const tip = document.createElement("div");
  tip.className = "highlight-comment-tooltip";

  if (author) {
    const authorEl = document.createElement("div");
    authorEl.className = "author";
    authorEl.textContent = author;
    tip.appendChild(authorEl);
  }

  const body = document.createElement("div");
  body.textContent = text;
  tip.appendChild(body);

  document.body.appendChild(tip);

  const left = Math.max(
    8,
    Math.min(x, window.innerWidth - tip.offsetWidth - 8),
  );
  const top = Math.max(
    8,
    Math.min(y, window.innerHeight - tip.offsetHeight - 8),
  );
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;

  tooltipEl = tip;
}

export function closeCommentPopup() {
  hideCommentTooltip();
  popupEl?.remove();
  popupEl = null;
  removeOutsideListener?.();
  removeOutsideListener = null;
}

export function formatPdfDate(raw) {
  if (!raw) return "";

  const match =
    /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(Z|[+-])?(\d{2})?'?(\d{2})?/.exec(
      String(raw).trim(),
    );
  if (!match) return "";

  const [
    ,
    y,
    mo = "01",
    d = "01",
    h = "00",
    mi = "00",
    sec = "00",
    sign,
    oh = "00",
    om = "00",
  ] = match;

  let time;
  if (sign) {
    time = Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec);
    if (sign !== "Z") {
      const offset = (Number(oh) * 60 + Number(om)) * 60000;
      time += sign === "+" ? -offset : offset;
    }
  } else {
    time = new Date(+y, +mo - 1, +d, +h, +mi, +sec).getTime();
  }

  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const ICONS = {
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
  trash:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
};

export function showCommentPopup({
  x,
  y,
  text,
  author,
  created,
  modified,
  onSave,
  onDelete,
}) {
  injectStyles();
  closeCommentPopup();

  const popup = document.createElement("div");
  popup.className = "highlight-comment-popup";
  popup.tabIndex = -1;

  const header = document.createElement("div");
  header.className = "header";

  const meta = document.createElement("div");
  meta.className = "meta";

  const lines = [];
  const createdText = formatPdfDate(created);
  const modifiedText = formatPdfDate(modified);
  if (createdText) lines.push(`Created: ${createdText}`);
  if (modifiedText) lines.push(`Modified: ${modifiedText}`);
  if (!lines.length && author) lines.push(author);
  if (!lines.length) lines.push("\u00a0");

  for (const line of lines) {
    const lineEl = document.createElement("div");
    lineEl.textContent = line;
    meta.appendChild(lineEl);
  }

  const tools = document.createElement("div");
  tools.className = "tools";

  const makeIconButton = (label, icon, className) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-button ${className}`.trim();
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = icon;
    return button;
  };

  const editButton = makeIconButton("Edit comment", ICONS.edit, "");
  const deleteButton = makeIconButton("Delete comment", ICONS.trash, "danger");
  tools.append(editButton, deleteButton);
  header.append(meta, tools);

  const view = document.createElement("div");
  view.className = "comment-text";
  view.textContent = text || "";

  const textarea = document.createElement("textarea");
  textarea.placeholder = "Add a comment…";
  textarea.hidden = true;

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.hidden = true;

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Accept";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";

  actions.append(cancelButton, saveButton);
  popup.append(header, view, textarea, actions);
  document.body.appendChild(popup);

  const keepOnScreen = () => {
    const maxTop = window.innerHeight - popup.offsetHeight - 8;
    popup.style.top = `${Math.max(8, Math.min(popup.offsetTop, maxTop))}px`;
  };

  const setEditing = (editing) => {
    view.hidden = editing;
    textarea.hidden = !editing;
    actions.hidden = !editing;
    editButton.disabled = editing;

    if (editing) {
      textarea.value = text || "";
      keepOnScreen();
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    } else {
      popup.focus();
    }
  };

  const run = async (handler) => {
    popup.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      await handler();
    } catch (error) {
      console.error("Highlight comment action failed:", error);
    }
    closeCommentPopup();
  };

  editButton.addEventListener("click", () => setEditing(true));
  cancelButton.addEventListener("click", () => setEditing(false));
  saveButton.addEventListener("click", () =>
    run(() => onSave(textarea.value.trim())),
  );
  deleteButton.addEventListener("click", () => run(() => onDelete()));

  const left = Math.max(
    8,
    Math.min(x, window.innerWidth - popup.offsetWidth - 8),
  );
  const top = Math.max(
    8,
    Math.min(y, window.innerHeight - popup.offsetHeight - 8),
  );
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;

  meta.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const originLeft = popup.offsetLeft;
    const originTop = popup.offsetTop;

    meta.setPointerCapture(event.pointerId);

    const onMove = (moveEvent) => {
      const nextLeft = originLeft + moveEvent.clientX - startX;
      const nextTop = originTop + moveEvent.clientY - startY;
      popup.style.left = `${Math.max(0, Math.min(nextLeft, window.innerWidth - popup.offsetWidth))}px`;
      popup.style.top = `${Math.max(0, Math.min(nextTop, window.innerHeight - popup.offsetHeight))}px`;
    };

    const onUp = () => {
      meta.removeEventListener("pointermove", onMove);
      meta.removeEventListener("pointerup", onUp);
      meta.removeEventListener("pointercancel", onUp);
    };

    meta.addEventListener("pointermove", onMove);
    meta.addEventListener("pointerup", onUp);
    meta.addEventListener("pointercancel", onUp);
  });

  popup.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!textarea.hidden) setEditing(false);
      else closeCommentPopup();
    }
    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey) &&
      !textarea.hidden
    ) {
      saveButton.click();
    }
  });

  const onOutside = (event) => {
    if (!popup.contains(event.target)) closeCommentPopup();
  };
  setTimeout(() => document.addEventListener("pointerdown", onOutside), 0);
  removeOutsideListener = () =>
    document.removeEventListener("pointerdown", onOutside);

  popupEl = popup;
  popup.focus();
}

injectStyles();

const selectingClass = "highlight-comment-selecting";
const root = document.documentElement;

window.addEventListener(
  "pointerdown",
  (event) => {
    if (event.button !== 0) return;
    if (event.target.closest?.(".highlight-comment-button")) return;
    root.classList.add(selectingClass);
  },
  true,
);

for (const type of ["pointerup", "pointercancel", "dragend"]) {
  window.addEventListener(
    type,
    () => root.classList.remove(selectingClass),
    true,
  );
}
window.addEventListener("blur", () => root.classList.remove(selectingClass));
