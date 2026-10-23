const ERROR_MESSAGES = {
  NO_DOCUMENT: "Open a PDF before inserting a signature image.",
  INVALID_IMAGE: "That file is not a valid PNG or JPG image.",
  UNREADABLE_FILE: "The image file could not be read.",
  INVALID_PAGE: "The page is no longer available.",
  INSERT_ERROR: "The signature image could not be inserted.",
};

export async function insertSignatureImage() {
  const pageInput = document.getElementById("pdf-page-count");
  const pageNumber = Number(pageInput?.value) || 1;

  const result = await window.electronAPI.insertSignatureImage({ pageNumber });

  // Closing the file picker is not an error
  if (!result.ok && result.code === "CANCELLED") {
    return;
  }

  if (!result.ok) {
    showStatus(ERROR_MESSAGES[result.code] || ERROR_MESSAGES.INSERT_ERROR);
    return;
  }

  location.reload();
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
