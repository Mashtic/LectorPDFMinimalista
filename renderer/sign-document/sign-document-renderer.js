const ERROR_MESSAGES = {
  NO_DOCUMENT: "There is no document to sign.",
  PIN_REQUIRED: "Enter the PIN of your signature card.",
  PIN_INCORRECT: "Incorrect PIN. Check it before trying again.",
  PIN_LOCKED: "The card is blocked. Unlock it with the PIN tool.",
  NO_MODULE: "The digital signature driver is not installed.",
  NO_CARD: "No card detected. Insert it in the reader and try again.",
  NO_CERTIFICATE: "No certificate was found on the card.",
  NO_PRIVATE_KEY: "The signing key was not found on the card.",
  CARD_ERROR: "The card could not be read. Try reconnecting the reader.",
  SIGN_ERROR: "The document could not be signed. Try again.",
};

const modalMarkup = `
  <div class="overlay is-open" id="sign-overlay">
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-modal-title"
    >
      <h2 id="sign-modal-title">Sign Document</h2>
      <div id="sign-modal-body"></div>
    </div>
  </div>
`;

const formMarkup = `
  <p>Insert your digital signature card in the reader.</p>
  <label for="sign-pin">Card PIN:</label>
  <input type="password" id="sign-pin" class="delete-input" />
  <div class="modal-actions">
    <button id="sign-cancel-btn" class="btn btn-cancel">Cancel</button>
    <button id="sign-submit-btn" class="btn btn-accept">Sign</button>
  </div>
`;

export function openSignDocumentModal() {
  if (document.getElementById("sign-overlay")) {
    return;
  }

  document.body.insertAdjacentHTML("beforeend", modalMarkup);
  renderForm();

  const overlay = document.getElementById("sign-overlay");
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  document.addEventListener("keydown", handleEscape);
}

function renderForm() {
  const body = document.getElementById("sign-modal-body");
  if (!body) {
    return;
  }

  body.innerHTML = formMarkup;

  const input = document.getElementById("sign-pin");
  input.focus();

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      submitSignature();
    }
  });

  document
    .getElementById("sign-submit-btn")
    .addEventListener("click", submitSignature);
  document
    .getElementById("sign-cancel-btn")
    .addEventListener("click", closeModal);
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

function renderError(code) {
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
  document
    .getElementById("sign-retry-btn")
    .addEventListener("click", () => renderForm());
}

async function submitSignature() {
  const input = document.getElementById("sign-pin");
  if (!input) {
    return;
  }

  const pin = input.value;
  input.value = "";
  renderWaiting();

  const result = await window.electronAPI.signDocument(pin);

  if (!document.getElementById("sign-overlay")) {
    return;
  }

  if (result.ok) {
    renderSuccess(result);
    return;
  }

  renderError(result.code);
}

function closeModal() {
  const overlay = document.getElementById("sign-overlay");
  if (overlay) {
    overlay.remove();
  }

  document.removeEventListener("keydown", handleEscape);
}

function handleEscape(event) {
  if (event.key === "Escape") {
    closeModal();
  }
}
