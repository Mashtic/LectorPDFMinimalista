import {
  buildAppearancePreview,
  openSignatureAppearanceModal,
} from "../signature-appearance/signature-appearance-renderer.js";
import { startSignaturePlacement } from "../signature-image/signature-image-renderer.js";

const ERROR_MESSAGES = {
  NO_DOCUMENT: "There is no document to sign.",
  PIN_REQUIRED: "Enter the PIN of your signature card.",
  PIN_INCORRECT: "Incorrect PIN. Check it before trying again.",
  PIN_LOCKED: "The card is blocked. Unlock it with the PIN tool.",
  NO_MODULE: "The digital signature driver is not installed.",
  NO_CARD: "No card detected. Insert it in the reader and try again.",
  NO_CERTIFICATE: "No certificate was found on the card.",
  NO_PRIVATE_KEY: "The signing key was not found on the card.",
  NO_APPEARANCE: "Configure the signature appearance before signing.",
  INVALID_PAGE: "The page is no longer available.",
  CARD_ERROR: "The card could not be read. Try reconnecting the reader.",
  SIGN_ERROR: "The document could not be signed. Try again.",
};

/*
 * Signing happens in one go: the person places the graphic expression, enters
 * the PIN, and the document comes back stamped and signed. The stamp is
 * applied before the signature so it ends up covered by it.
 */
export async function startSigning() {
  const appearance = await window.electronAPI.getSignatureAppearance();

  if (!appearance.isConfigured) {
    openSetupPrompt();
    return;
  }

  const image = new Image();

  image.onload = () => {
    const started = startSignaturePlacement({
      previewHtml: buildAppearancePreview(appearance, null),
      // The text block grows the box, so the preview keeps its real shape
      aspectRatio:
        image.naturalHeight / image.naturalWidth / (hasText(appearance) ? 0.68 : 1),
      onConfirm: (placement) => openPinModal(placement),
    });

    if (!started) {
      showStatus(ERROR_MESSAGES.INVALID_PAGE);
    }
  };

  image.onerror = () => showStatus(ERROR_MESSAGES.SIGN_ERROR);
  image.src = appearance.imageDataUrl;
}

function hasText(appearance) {
  return Boolean(appearance.text || appearance.showName || appearance.showDate);
}

function openModal(title, bodyHtml) {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div class="overlay is-open" id="sign-overlay">
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sign-modal-title"
      >
        <h2 id="sign-modal-title">${title}</h2>
        <div id="sign-modal-body">${bodyHtml}</div>
      </div>
    </div>
  `,
  );

  const overlay = document.getElementById("sign-overlay");
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  document.addEventListener("keydown", handleEscape);
}

function openSetupPrompt() {
  openModal(
    "Sign Document",
    `
    <p>There is no signature appearance configured yet. Set it up once and it
    will be used every time you sign.</p>
    <div class="modal-actions">
      <button id="sign-cancel-btn" class="btn btn-cancel">Cancel</button>
      <button id="sign-setup-btn" class="btn btn-accept">Configure</button>
    </div>
  `,
  );

  document
    .getElementById("sign-cancel-btn")
    .addEventListener("click", closeModal);
  document.getElementById("sign-setup-btn").addEventListener("click", () => {
    closeModal();
    openSignatureAppearanceModal(() => startSigning());
  });
}

function openPinModal(placement) {
  openModal(
    "Sign Document",
    `
    <p>Insert your digital signature card in the reader.</p>
    <label for="sign-pin">Card PIN:</label>
    <input type="password" id="sign-pin" class="delete-input" />
    <div class="modal-actions">
      <button id="sign-cancel-btn" class="btn btn-cancel">Cancel</button>
      <button id="sign-submit-btn" class="btn btn-accept">Sign</button>
    </div>
  `,
  );

  const input = document.getElementById("sign-pin");
  input.focus();
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      submitSignature(placement);
    }
  });

  document
    .getElementById("sign-submit-btn")
    .addEventListener("click", () => submitSignature(placement));
  document
    .getElementById("sign-cancel-btn")
    .addEventListener("click", closeModal);
}

async function submitSignature(placement) {
  const input = document.getElementById("sign-pin");
  if (!input) {
    return;
  }

  const pin = input.value;
  input.value = "";
  renderWaiting();

  const result = await window.electronAPI.signDocument(pin, placement);

  if (!document.getElementById("sign-overlay")) {
    return;
  }

  if (result.ok) {
    renderSuccess(result);
    return;
  }

  renderError(result.code, placement);
}

function renderWaiting() {
  const body = document.getElementById("sign-modal-body");
  if (!body) {
    return;
  }

  body.innerHTML = `
    <p class="sign-status">
      <span class="sign-spinner" aria-hidden="true"></span>
      Signing with the card. Do not remove it from the reader.
    </p>
  `;
}

function renderSuccess(result) {
  const body = document.getElementById("sign-modal-body");
  if (!body) {
    return;
  }

  const signer = result.signerName ? ` by ${result.signerName}` : "";

  body.innerHTML = `
    <p>Document signed${signer}. Save it to keep the signature.</p>
    <div class="modal-actions">
      <button id="sign-done-btn" class="btn btn-accept">Accept</button>
    </div>
  `;

  document.getElementById("sign-done-btn").addEventListener("click", () => {
    closeModal();
    location.reload();
  });
}

function renderError(code, placement) {
  const body = document.getElementById("sign-modal-body");
  if (!body) {
    return;
  }

  body.innerHTML = `
    <p class="sign-error">${ERROR_MESSAGES[code] || ERROR_MESSAGES.SIGN_ERROR}</p>
    <div class="modal-actions">
      <button id="sign-close-btn" class="btn btn-cancel">Close</button>
      <button id="sign-retry-btn" class="btn btn-accept">Try again</button>
    </div>
  `;

  document
    .getElementById("sign-close-btn")
    .addEventListener("click", closeModal);
  document.getElementById("sign-retry-btn").addEventListener("click", () => {
    closeModal();
    openPinModal(placement);
  });
}

function closeModal() {
  document.getElementById("sign-overlay")?.remove();
  document.removeEventListener("keydown", handleEscape);
}

function handleEscape(event) {
  if (event.key === "Escape") {
    closeModal();
  }
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
