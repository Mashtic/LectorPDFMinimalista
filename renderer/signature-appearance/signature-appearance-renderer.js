const ERROR_MESSAGES = {
  INVALID_IMAGE: "That file is not a valid PNG or JPG image.",
  UNREADABLE_FILE: "The image file could not be read.",
  SAVE_ERROR: "The signature appearance could not be saved.",
};

/*
 * Builds the preview of the graphic expression. The same markup is used in the
 * settings screen and in the placement overlay, so what the person arranges is
 * what ends up in the document. The proportions match
 * signature-stamp-service.js: the image on top, the text underneath.
 */
export function buildAppearancePreview(appearance, signerName) {
  const lines = [];

  if (appearance.text) {
    lines.push(...appearance.text.split("\n").filter(Boolean));
  }

  if (appearance.showName) {
    lines.push(signerName || "Signer name");
  }

  if (appearance.showDate) {
    lines.push(new Date().toLocaleString());
  }

  const textBlock = lines.length
    ? `<div class="appearance-preview-text">${lines
        .map((line) => `<span>${escapeHtml(line)}</span>`)
        .join("")}</div>`
    : "";

  return `
    <div class="appearance-preview">
      <img src="${appearance.imageDataUrl}" alt="Signature" draggable="false" />
      ${textBlock}
    </div>
  `;
}

export async function openSignatureAppearanceModal(onClose) {
  if (document.getElementById("appearance-overlay")) {
    return;
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="overlay is-open" id="appearance-overlay">
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-title"
      >
        <h2 id="appearance-title">Signature Appearance</h2>
        <div id="appearance-body"></div>
      </div>
    </div>
  `,
  );

  const overlay = document.getElementById("appearance-overlay");
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal(onClose);
    }
  });

  document.addEventListener("keydown", handleEscape);
  await render(onClose);
}

async function render(onClose) {
  const body = document.getElementById("appearance-body");
  if (!body) {
    return;
  }

  const appearance = await window.electronAPI.getSignatureAppearance();

  body.innerHTML = `
    <div class="appearance-row">
      <button id="appearance-pick" class="btn btn-cancel">
        ${appearance.isConfigured ? "Replace image" : "Choose image"}
      </button>
      <button id="appearance-clear" class="btn btn-cancel" ${
        appearance.isConfigured ? "" : "disabled"
      }>Remove</button>
    </div>

    <label for="appearance-text">Text (optional):</label>
    <input type="text" id="appearance-text" class="delete-input"
      value="${escapeHtml(appearance.text)}" />

    <label class="appearance-check">
      <input type="checkbox" id="appearance-name" ${
        appearance.showName ? "checked" : ""
      } />
      Include the signer name
    </label>
    <label class="appearance-check">
      <input type="checkbox" id="appearance-date" ${
        appearance.showDate ? "checked" : ""
      } />
      Include the signing date
    </label>

    <p class="appearance-label">Preview</p>
    <div class="appearance-preview-frame">
      ${
        appearance.isConfigured
          ? buildAppearancePreview(appearance, null)
          : '<span class="appearance-empty">Choose an image to see the preview.</span>'
      }
    </div>

    <div class="modal-actions">
      <button id="appearance-close" class="btn btn-cancel">Close</button>
      <button id="appearance-save" class="btn btn-accept">Save</button>
    </div>
  `;

  document.getElementById("appearance-pick").addEventListener("click", async () => {
    const result = await window.electronAPI.chooseSignatureAppearanceImage();

    if (!result.ok && result.code !== "CANCELLED") {
      showStatus(ERROR_MESSAGES[result.code] || ERROR_MESSAGES.SAVE_ERROR);
    }

    await render(onClose);
  });

  document.getElementById("appearance-clear").addEventListener("click", async () => {
    await window.electronAPI.clearSignatureAppearance();
    await render(onClose);
  });

  ["appearance-text", "appearance-name", "appearance-date"].forEach((id) => {
    document.getElementById(id).addEventListener("change", refreshPreview);
  });

  document
    .getElementById("appearance-close")
    .addEventListener("click", () => closeModal(onClose));
  document.getElementById("appearance-save").addEventListener("click", async () => {
    await saveCurrentValues();
    closeModal(onClose);
  });
}

async function refreshPreview() {
  const saved = await saveCurrentValues();
  const frame = document.querySelector(".appearance-preview-frame");

  if (frame && saved.isConfigured) {
    frame.innerHTML = buildAppearancePreview(saved, null);
  }
}

function saveCurrentValues() {
  return window.electronAPI.saveSignatureAppearance({
    text: document.getElementById("appearance-text").value,
    showName: document.getElementById("appearance-name").checked,
    showDate: document.getElementById("appearance-date").checked,
  });
}

function closeModal(onClose) {
  document.getElementById("appearance-overlay")?.remove();
  document.removeEventListener("keydown", handleEscape);
  onClose?.();
}

function handleEscape(event) {
  if (event.key === "Escape") {
    closeModal();
  }
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value ?? "";
  return element.innerHTML;
}

function showStatus(message) {
  const status = document.getElementById("save-status");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.classList.add("is-visible");

  setTimeout(() => {
    status.classList.remove("is-visible");
    status.textContent = "";
  }, 4000);
}
