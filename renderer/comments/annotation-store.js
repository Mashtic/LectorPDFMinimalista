import { AnnotationType } from "../../node_modules/pdfjs-dist/build/pdf.mjs";
import { getAnnotationText, isCommentable } from "./highlight-comments.js";

const LOCAL_HIGHLIGHT_COLOR = [255, 217, 64];
const LOCAL_HIGHLIGHT_OPACITY = 0.35;
const AUTO_FLUSH_MS = 2000;

function toPdfDate(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `D:${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
  );
}

function boundingRect(flatQuads) {
  if (flatQuads.length < 8) return null;
  const xs = flatQuads.filter((_, i) => i % 2 === 0);
  const ys = flatQuads.filter((_, i) => i % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export class AnnotationStore extends EventTarget {
  #document = null;
  #baseBytes = null;
  #baseSent = false;

  #pages = new Map();
  #textEdits = new Map();
  #deleted = new Map();
  #created = new Map();

  #nextLocalId = 1;
  #revision = 0;
  #flushedRevision = 0;
  #flushing = Promise.resolve();
  #flushTimer = null;

  get document() {
    return this.#document;
  }

  get isDirty() {
    return this.#revision !== this.#flushedRevision;
  }

  attach(documentPDF, baseBytes) {
    clearTimeout(this.#flushTimer);
    this.#document = documentPDF;
    this.#baseBytes = baseBytes;
    this.#baseSent = false;
    this.#pages = new Map();
    this.#textEdits.clear();
    this.#deleted.clear();
    this.#created.clear();
    this.#revision = 0;
    this.#flushedRevision = 0;
    this.dispatchEvent(
      new CustomEvent("change", { detail: { pageNumber: null } }),
    );
  }

  #filePage(pageNumber) {
    if (!this.#pages.has(pageNumber)) {
      const documentPDF = this.#document;
      this.#pages.set(
        pageNumber,
        (async () => {
          const page = await documentPDF.getPage(pageNumber);
          const annotations = await page.getAnnotations({ intent: "display" });
          const entries = [];
          for (const annotation of annotations) {
            if (!isCommentable(annotation)) continue;
            const text = getAnnotationText(annotation);
            if (!text) continue;
            entries.push({
              id: annotation.id,
              pageNumber,
              text,
              quote: annotation.subject || "",
              author: annotation.titleObj?.str ?? "",
              created: annotation.creationDate ?? "",
              modified: annotation.modificationDate ?? "",
              annotation,
              local: false,
            });
          }
          return entries;
        })(),
      );
    }
    return this.#pages.get(pageNumber);
  }

  async getPageComments(pageNumber) {
    if (!this.#document) return [];
    const result = [];

    for (const entry of await this.#filePage(pageNumber)) {
      const key = `${pageNumber}:${entry.id}`;
      if (this.#deleted.has(key)) continue;
      const edit = this.#textEdits.get(key);
      if (!edit) {
        result.push(entry);
      } else if (edit.text) {
        result.push({ ...entry, text: edit.text, modified: edit.modified });
      }
    }
    for (const { entry } of this.#created.values()) {
      if (entry.pageNumber === pageNumber) result.push(entry);
    }
    return result;
  }

  async getAllComments() {
    if (!this.#document) return [];
    const all = [];
    for (let n = 1; n <= this.#document.numPages; n++) {
      all.push(...(await this.getPageComments(n)));
    }
    return all;
  }

  isHighlightDeleted(pageNumber, id) {
    return this.#deleted.has(`${pageNumber}:${id}`);
  }

  applyOverrides(pageNumber, annotation) {
    const key = `${pageNumber}:${annotation.id}`;
    if (this.#deleted.has(key)) return null;
    const edit = this.#textEdits.get(key);
    if (!edit) return annotation;
    return {
      ...annotation,
      contents: edit.text,
      contentsObj: {
        str: edit.text,
        dir: annotation.contentsObj?.dir ?? "ltr",
      },
      hasPopup: annotation.hasPopup && !!edit.text,
    };
  }

  getLocalHighlights(pageNumber) {
    const result = [];
    for (const { entry } of this.#created.values()) {
      const { annotation } = entry;
      if (entry.pageNumber !== pageNumber || !annotation.rect) continue;
      result.push({
        annotationType: AnnotationType.HIGHLIGHT,
        id: entry.id,
        rect: annotation.rect,
        quadPoints: annotation.quadPoints,
        rotation: 0,
        color: new Uint8ClampedArray(LOCAL_HIGHLIGHT_COLOR),
        opacity: LOCAL_HIGHLIGHT_OPACITY,
        hasAppearance: true,
        noHTML: false,
      });
    }
    return result;
  }

  createComment({ pageNumber, text, quote = "", quads = [] }) {
    pageNumber = Number(pageNumber);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      // Fail here, at the call site, not 2 seconds later inside the flush
      throw new Error(
        `createComment needs { pageNumber } (a page >= 1), got ${pageNumber}`,
      );
    }
    text = (text ?? "").trim();
    if (!text) return null;

    const id = `user_comment_${this.#nextLocalId++}`;
    const flat = quads.flat();
    const now = toPdfDate();
    const entry = {
      id,
      pageNumber,
      text,
      quote,
      author: "",
      created: now,
      modified: now,
      local: true,
      annotation: {
        id,
        annotationType: AnnotationType.HIGHLIGHT,
        rect: boundingRect(flat),
        quadPoints: Float32Array.from(flat),
        titleObj: { str: "" },
        subject: quote,
      },
    };
    this.#created.set(id, {
      entry,
      payload: { pageNumber, text, quote, quads },
    });
    this.#changed(pageNumber);
    return id;
  }

  setCommentText(pageNumber, id, text) {
    text = text.trim();
    const local = this.#created.get(id);

    if (local) {
      if (!text) {
        this.#created.delete(id);
      } else {
        local.entry.text = text;
        local.entry.modified = toPdfDate();
        local.payload.text = text;
      }
    } else {
      this.#textEdits.set(`${pageNumber}:${id}`, {
        pageNumber,
        id,
        text,
        modified: toPdfDate(),
      });
    }
    this.#changed(pageNumber);
  }

  deleteHighlight(pageNumber, id) {
    if (this.#created.delete(id)) {
      this.#changed(pageNumber);
      return;
    }
    const key = `${pageNumber}:${id}`;
    this.#textEdits.delete(key);
    this.#deleted.set(key, { pageNumber, id });
    this.#changed(pageNumber);
  }

  noteExternalChange() {
    this.#changed(null);
  }

  #changed(pageNumber) {
    this.#revision++;
    this.dispatchEvent(new CustomEvent("change", { detail: { pageNumber } }));
    clearTimeout(this.#flushTimer);
    this.#flushTimer = setTimeout(
      () =>
        this.flush().catch((e) => console.error("Annotation flush failed", e)),
      AUTO_FLUSH_MS,
    );
  }

  flush() {
    clearTimeout(this.#flushTimer);
    this.#flushing = this.#flushing.then(
      () => this.#write(),
      () => this.#write(),
    );
    return this.#flushing;
  }

  async getBytes() {
    await this.flush();
    return window.electronAPI.getGlobalVar("currentPDF");
  }

  async #write() {
    const revision = this.#revision;
    if (revision === this.#flushedRevision) return;

    const api = window.electronAPI;
    const documentPDF = this.#document;

    const ops = {
      edits: [...this.#textEdits.values()].map(({ pageNumber, id, text }) => ({
        pageNumber,
        annotationId: id,
        text,
      })),
      deletions: [...this.#deleted.values()].map(({ pageNumber, id }) => ({
        pageNumber,
        annotationId: id,
      })),
      creates: [...this.#created.values()].map(({ payload }) => payload),
    };

    if (documentPDF.annotationStorage.size > 0) {
      ops.base = new Uint8Array(await documentPDF.saveDocument());
    } else if (!this.#baseSent) {
      await api.setAnnotationBase(this.#baseBytes); // once per loaded document
      this.#baseSent = true;
    }

    await api.applyAnnotationOps(ops);

    if (documentPDF === this.#document) {
      this.#flushedRevision = revision;
    }
  }
}

export const annotationStore = new AnnotationStore();
