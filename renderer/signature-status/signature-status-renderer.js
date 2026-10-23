const SEAL_ICON = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="9" r="6"></circle>
    <polyline points="9.5 9 11.5 11 14.5 7.5"></polyline>
    <path d="M9 14.5 L8 22 L12 20 L16 22 L15 14.5"></path>
  </svg>
`;

const WARNING_ICON = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3 L22 20 L2 20 Z"></path>
    <line x1="12" y1="9" x2="12" y2="14"></line>
    <line x1="12" y1="17" x2="12" y2="17"></line>
  </svg>
`;

export async function showSignatureStatus() {
  const signatures = await window.electronAPI.readSignatureInfo();

  // A document without signatures shows no indicator at all
  if (!signatures?.length) {
    return;
  }

  const isTrustworthy = signatures.every(
    (signature) => signature.isValid && signature.coversWholeDocument,
  );

  const badge = document.createElement("div");
  badge.id = "signature-status";
  badge.className = isTrustworthy ? "is-signed" : "is-warning";
  badge.innerHTML = `
    ${isTrustworthy ? SEAL_ICON : WARNING_ICON}
    <span>${buildLabel(signatures, isTrustworthy)}</span>
  `;
  badge.title = buildDetails(signatures);

  document.body.appendChild(badge);
}

function buildLabel(signatures, isTrustworthy) {
  if (!isTrustworthy) {
    return "Signature not valid";
  }

  if (signatures.length > 1) {
    return `Signed by ${signatures.length} people`;
  }

  return signatures[0].signerName
    ? `Signed by ${signatures[0].signerName}`
    : "Signed document";
}

function buildDetails(signatures) {
  return signatures
    .map((signature) => {
      const name = signature.signerName || "Unknown signer";
      const date = signature.signedAt
        ? new Date(signature.signedAt).toLocaleString()
        : "unknown date";

      if (!signature.isValid) {
        return `${name}: the signature does not match the content.`;
      }

      if (!signature.coversWholeDocument) {
        return `${name} (${date}): the document was modified after signing.`;
      }

      return `${name} (${date})`;
    })
    .join("\n");
}
