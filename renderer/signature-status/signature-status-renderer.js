const SEAL_ICON = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="9" r="6"></circle>
    <polyline points="9.5 9 11.5 11 14.5 7.5"></polyline>
    <path d="M9 14.5 L8 22 L12 20 L16 22 L15 14.5"></path>
  </svg>
`;

const WARNING_ICON = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3 L22 20 L2 20 Z"></path>
    <line x1="12" y1="9" x2="12" y2="14"></line>
    <line x1="12" y1="17" x2="12" y2="17"></line>
  </svg>
`;

// The label is shown when the document opens and then folds into the icon
const COLLAPSE_DELAY_MS = 10000;

const STATE = {
  SIGNED: "is-signed",
  MODIFIED: "is-modified",
  INVALID: "is-warning",
};

export async function showSignatureStatus() {
  const entries = await window.electronAPI.readSignatureInfo();

  // A document without signatures shows no indicator at all
  if (!entries?.length) {
    return;
  }

  // Document timestamps are checked too, but they are not people who signed
  const signers = groupBySigner(
    entries.filter((entry) => entry.kind !== "timestamp"),
  );
  const timestamps = entries.filter((entry) => entry.kind === "timestamp");
  const state = getState(entries);

  document.getElementById("signature-status")?.remove();

  const badge = document.createElement("div");
  badge.id = "signature-status";
  badge.className = state;
  badge.tabIndex = 0;

  const icon = document.createElement("span");
  icon.className = "signature-status-icon";
  icon.innerHTML = state === STATE.SIGNED ? SEAL_ICON : WARNING_ICON;

  const label = document.createElement("span");
  label.className = "signature-status-label";
  label.textContent = buildLabel(signers, state);

  badge.append(icon, label, buildDetails(signers, timestamps, state));
  badge.setAttribute("aria-label", label.textContent);
  document.body.appendChild(badge);

  setTimeout(() => badge.classList.add("is-collapsed"), COLLAPSE_DELAY_MS);
}

function getState(entries) {
  if (entries.some((entry) => !entry.isValid)) {
    return STATE.INVALID;
  }

  if (entries.some((entry) => !entry.coversWholeDocument)) {
    return STATE.MODIFIED;
  }

  return STATE.SIGNED;
}

/*
 * A person can sign the same document several times, for example once per
 * page. They are listed once, with the date of their latest signature.
 */
function groupBySigner(signatures) {
  const signers = new Map();

  for (const signature of signatures) {
    const key = signature.signerId || signature.signerName || Symbol("unknown");
    const signer = signers.get(key);

    if (!signer) {
      signers.set(key, { ...signature, count: 1 });
      continue;
    }

    signer.count += 1;
    signer.isValid = signer.isValid && signature.isValid;
    if (signature.signedAt > signer.signedAt) {
      signer.signedAt = signature.signedAt;
    }
  }

  return [...signers.values()];
}

function buildLabel(signers, state) {
  if (state === STATE.INVALID) {
    return "Signature not valid";
  }

  if (state === STATE.MODIFIED) {
    return "Modified after signing";
  }

  if (signers.length > 1) {
    return `Signed by ${signers.length} people`;
  }

  return signers[0]?.signerName
    ? `Signed by ${signers[0].signerName}`
    : "Signed document";
}

function formatDate(isoDate) {
  return isoDate ? new Date(isoDate).toLocaleString() : "Unknown date";
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

// Names come from the certificates, so they are only ever set as text
function buildDetails(signers, timestamps, state) {
  const details = createElement("div", "signature-status-details");
  details.setAttribute("role", "tooltip");

  details.append(
    createElement(
      "p",
      "signature-status-title",
      signers.length === 1 ? "Signed by" : `Signed by ${signers.length} people`,
    ),
  );

  const list = createElement("ul", "signature-status-signers");

  for (const signer of signers) {
    const item = createElement(
      "li",
      signer.isValid ? "" : "is-invalid",
    );
    const times = signer.count > 1 ? ` · ${signer.count} signatures` : "";
    // Tells a date certified by a timestamp authority from a self-declared one
    const certified = signer.hasCertifiedDate ? " · certified date" : "";

    item.append(
      createElement(
        "span",
        "signature-status-name",
        signer.signerName || "Unknown signer",
      ),
      createElement(
        "span",
        "signature-status-meta",
        signer.isValid
          ? `${formatDate(signer.signedAt)}${certified}${times}`
          : "The signature does not match the content",
      ),
    );
    list.append(item);
  }

  details.append(list);

  for (const timestamp of timestamps) {
    details.append(
      createElement(
        "p",
        "signature-status-note",
        timestamp.isValid
          ? `Timestamp: ${formatDate(timestamp.signedAt)}` +
              (timestamp.signerName ? ` (${timestamp.signerName})` : "")
          : "The document timestamp is not valid",
      ),
    );
  }

  if (state === STATE.MODIFIED) {
    details.append(
      createElement(
        "p",
        "signature-status-note is-alert",
        "The document was modified after it was signed.",
      ),
    );
  }

  return details;
}
