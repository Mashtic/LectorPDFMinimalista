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

const ICONS = {
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
  trash:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
};

const SELECTING_CLASS = "highlight-comment-selecting";

let popupElement = null;
let tooltipElement = null;
let removeOutsideListener = null;

export function isCommentable(annotation) {
  return COMMENTABLE_SUBTYPES.has(annotation.subtype) && !annotation.inReplyTo;
}

export function getAnnotationText(annotation) {
  return annotation.contentsObj?.str ?? annotation.contents ?? "";
}

function normalizeQuads(annotation) {
  const quadPoints = annotation.quadPoints;
  const quads = [];

  const fromNumbers = (numbers) => [
    { x: numbers[0], y: numbers[1] },
    { x: numbers[2], y: numbers[3] },
    { x: numbers[4], y: numbers[5] },
    { x: numbers[6], y: numbers[7] },
  ];

  if (quadPoints?.length) {
    if (typeof quadPoints[0] === "number") {
      for (let index = 0; index + 7 < quadPoints.length; index += 8) {
        quads.push(fromNumbers(quadPoints.slice(index, index + 8)));
      }
    } else {
      for (const item of quadPoints) {
        if (item?.length === 8) {
          quads.push(fromNumbers(item));
        } else if (item?.[0]?.x !== undefined) {
          quads.push(Array.from(item));
        }
      }
    }
  }

  if (!quads.length && annotation.rect) {
    const [firstX, firstY, secondX, secondY] = annotation.rect;
    quads.push([
      { x: firstX, y: secondY },
      { x: secondX, y: secondY },
      { x: firstX, y: firstY },
      { x: secondX, y: firstY },
    ]);
  }

  return quads;
}

export function getHighlightRectangles(annotation, viewport) {
  return normalizeQuads(annotation).map((quad) => {
    const xValues = quad.map((point) => point.x);
    const yValues = quad.map((point) => point.y);

    const [firstX, firstY] = viewport.convertToViewportPoint(
      Math.min(...xValues),
      Math.min(...yValues),
    );
    const [secondX, secondY] = viewport.convertToViewportPoint(
      Math.max(...xValues),
      Math.max(...yValues),
    );

    return {
      left: Math.min(firstX, secondX),
      top: Math.min(firstY, secondY),
      width: Math.abs(secondX - firstX),
      height: Math.abs(secondY - firstY),
    };
  });
}

export function formatPDFDate(rawDate) {
  if (!rawDate) {
    return "";
  }

  const match =
    /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(Z|[+-])?(\d{2})?'?(\d{2})?/.exec(
      String(rawDate).trim(),
    );

  if (!match) {
    return "";
  }

  const [
    ,
    year,
    month = "01",
    day = "01",
    hour = "00",
    minute = "00",
    second = "00",
    sign,
    offsetHour = "00",
    offsetMinute = "00",
  ] = match;

  let time;

  if (sign) {
    time = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);

    if (sign !== "Z") {
      const offset = (Number(offsetHour) * 60 + Number(offsetMinute)) * 60000;
      time += sign === "+" ? -offset : offset;
    }
  } else {
    time = new Date(+year, +month - 1, +day, +hour, +minute, +second).getTime();
  }

  const date = new Date(time);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function hideCommentTooltip() {
  tooltipElement?.remove();
  tooltipElement = null;
}

export function isCommentPopupOpen() {
  return popupElement !== null;
}

export function showCommentTooltip({ x, y, text, author }) {
  hideCommentTooltip();

  const tooltip = document.createElement("div");
  tooltip.className = "highlight-comment-tooltip";

  if (author) {
    const authorElement = document.createElement("div");
    authorElement.className = "author";
    authorElement.textContent = author;
    tooltip.appendChild(authorElement);
  }

  const body = document.createElement("div");
  body.textContent = text;
  tooltip.appendChild(body);

  document.body.appendChild(tooltip);

  const left = Math.max(
    8,
    Math.min(x, window.innerWidth - tooltip.offsetWidth - 8),
  );
  const top = Math.max(
    8,
    Math.min(y, window.innerHeight - tooltip.offsetHeight - 8),
  );
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;

  tooltipElement = tooltip;
}

export function closeCommentPopup() {
  hideCommentTooltip();
  popupElement?.remove();
  popupElement = null;
  removeOutsideListener?.();
  removeOutsideListener = null;
}

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
  closeCommentPopup();

  const popup = document.createElement("div");
  popup.className = "highlight-comment-popup";
  popup.tabIndex = -1;

  const header = document.createElement("div");
  header.className = "header";

  const metadata = document.createElement("div");
  metadata.className = "metadata";

  const lines = [];
  const createdText = formatPDFDate(created);
  const modifiedText = formatPDFDate(modified);

  if (createdText) {
    lines.push(`Created: ${createdText}`);
  }

  if (modifiedText) {
    lines.push(`Modified: ${modifiedText}`);
  }

  if (!lines.length && author) {
    lines.push(author);
  }

  if (!lines.length) {
    lines.push("\u00a0");
  }

  for (const line of lines) {
    const lineElement = document.createElement("div");
    lineElement.textContent = line;
    metadata.appendChild(lineElement);
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
  header.append(metadata, tools);

  const commentView = document.createElement("div");
  commentView.className = "comment-text";
  commentView.textContent = text || "";

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
  popup.append(header, commentView, textarea, actions);
  document.body.appendChild(popup);

  const keepOnScreen = () => {
    const maxTop = window.innerHeight - popup.offsetHeight - 8;
    popup.style.top = `${Math.max(8, Math.min(popup.offsetTop, maxTop))}px`;
  };

  const setEditing = (editing) => {
    commentView.hidden = editing;
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
    popup.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });

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

  metadata.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const originLeft = popup.offsetLeft;
    const originTop = popup.offsetTop;

    metadata.setPointerCapture(event.pointerId);

    const onMove = (moveEvent) => {
      const nextLeft = originLeft + moveEvent.clientX - startX;
      const nextTop = originTop + moveEvent.clientY - startY;
      const maxLeft = window.innerWidth - popup.offsetWidth;
      const maxTop = window.innerHeight - popup.offsetHeight;
      popup.style.left = `${Math.max(0, Math.min(nextLeft, maxLeft))}px`;
      popup.style.top = `${Math.max(0, Math.min(nextTop, maxTop))}px`;
    };

    const onRelease = () => {
      metadata.removeEventListener("pointermove", onMove);
      metadata.removeEventListener("pointerup", onRelease);
      metadata.removeEventListener("pointercancel", onRelease);
    };

    metadata.addEventListener("pointermove", onMove);
    metadata.addEventListener("pointerup", onRelease);
    metadata.addEventListener("pointercancel", onRelease);
  });

  popup.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!textarea.hidden) {
        setEditing(false);
      } else {
        closeCommentPopup();
      }
    }

    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey) &&
      !textarea.hidden
    ) {
      saveButton.click();
    }
  });

  const onOutsidePointerDown = (event) => {
    if (!popup.contains(event.target)) {
      closeCommentPopup();
    }
  };

  setTimeout(
    () => document.addEventListener("pointerdown", onOutsidePointerDown),
    0,
  );
  removeOutsideListener = () =>
    document.removeEventListener("pointerdown", onOutsidePointerDown);

  popupElement = popup;
  popup.focus();
}

const rootElement = document.documentElement;

window.addEventListener(
  "pointerdown",
  (event) => {
    if (event.button !== 0) {
      return;
    }

    if (event.target.closest?.(".highlight-comment-button")) {
      return;
    }

    rootElement.classList.add(SELECTING_CLASS);
  },
  true,
);

for (const type of ["pointerup", "pointercancel", "dragend"]) {
  window.addEventListener(
    type,
    () => rootElement.classList.remove(SELECTING_CLASS),
    true,
  );
}

window.addEventListener("blur", () =>
  rootElement.classList.remove(SELECTING_CLASS),
);
