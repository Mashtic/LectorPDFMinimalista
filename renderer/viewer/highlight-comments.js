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

// THIS POPUP AND ITS LOGIC WERE ABSOLUTELY VIBE-CODED BTW
// TODO: CHANGE IT TO SOMETHING THAT ACTUALLY LOOKS GOOD

let popupEl = null;
let removeOutsideListener = null;

function injectStyles() {
  if (document.getElementById("highlight-comment-styles")) return;

  const style = document.createElement("style");
  style.id = "highlight-comment-styles";
  style.textContent = `
    .highlight-comment-layer { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
    .highlight-comment-hit { position: absolute; pointer-events: auto; cursor: pointer; }
    .highlight-comment-hit.has-comment { border-bottom: 2px solid rgba(220, 150, 0, 0.9); }
    .highlight-comment-popup {
      position: fixed; z-index: 1000; width: 280px; padding: 10px;
      background: #fff; color: #222; border: 1px solid #bbb; border-radius: 8px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25); font: 13px system-ui, sans-serif;
    }
    .highlight-comment-popup textarea {
      width: 100%; min-height: 90px; box-sizing: border-box; resize: vertical;
      font: inherit; padding: 6px; border: 1px solid #ccc; border-radius: 4px;
    }
    .highlight-comment-popup .meta { color: #777; font-size: 11px; margin-bottom: 6px; }
    .highlight-comment-popup .actions { display: flex; gap: 6px; margin-top: 8px; }
    .highlight-comment-popup .spacer { flex: 1; }
    .highlight-comment-popup button { font: inherit; padding: 4px 10px; cursor: pointer; }
    .highlight-comment-popup .danger { color: #b00020; }
  `;
  document.head.appendChild(style);
}

export function closeCommentPopup() {
  popupEl?.remove();
  popupEl = null;
  removeOutsideListener?.();
  removeOutsideListener = null;
}

/**
 * Shows an editor next to (x, y) in client coordinates.
 * onSave(text) and onDelete() may be async; the popup closes after they finish.
 */
export function showCommentPopup({ x, y, text, author, onSave, onDelete }) {
  injectStyles();
  closeCommentPopup();

  const popup = document.createElement("div");
  popup.className = "highlight-comment-popup";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = author || "Highlight comment";

  const textarea = document.createElement("textarea");
  textarea.value = text || "";
  textarea.placeholder = "Add a comment…";

  const actions = document.createElement("div");
  actions.className = "actions";

  const makeButton = (label, className, handler) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (className) button.className = className;
    button.addEventListener("click", async () => {
      popup.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        await handler();
      } catch (error) {
        console.error("Highlight comment action failed:", error);
      }
      closeCommentPopup();
    });
    return button;
  };

  const spacer = document.createElement("span");
  spacer.className = "spacer";

  actions.append(
    makeButton("Save", "", () => onSave(textarea.value.trim())),
    makeButton("Cancel", "", async () => {}),
    spacer,
    makeButton("Delete highlight", "danger", () => onDelete()),
  );

  popup.append(meta, textarea, actions);
  document.body.appendChild(popup);

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

  popup.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeCommentPopup();
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      popup.querySelector("button").click();
    }
  });

  const onOutside = (event) => {
    if (!popup.contains(event.target)) closeCommentPopup();
  };
  // Deferred so the click that opened the popup does not close it
  setTimeout(() => document.addEventListener("pointerdown", onOutside), 0);
  removeOutsideListener = () =>
    document.removeEventListener("pointerdown", onOutside);

  popupEl = popup;
  textarea.focus();
}

// Inject styles immediately so the click layer works before any popup opens
injectStyles();
