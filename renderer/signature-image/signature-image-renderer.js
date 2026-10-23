const ERROR_MESSAGES = {
  NO_DOCUMENT: "Open a PDF before inserting a signature image.",
  INVALID_IMAGE: "That file is not a valid PNG or JPG image.",
  UNREADABLE_FILE: "The image file could not be read.",
  INVALID_PAGE: "The page is no longer available.",
  NO_IMAGE: "Choose the image again.",
  INSERT_ERROR: "The signature image could not be inserted.",
};

// Fractions of the page, so the placement survives any zoom level
const DEFAULT_WIDTH_RATIO = 0.3;
const DEFAULT_BOTTOM_RATIO = 0.12;
const MIN_WIDTH_RATIO = 0.05;

let placementSession = null;

export async function insertSignatureImage() {
  if (placementSession) {
    return;
  }

  const result = await window.electronAPI.pickSignatureImage();

  // Closing the file picker is not an error
  if (!result.ok) {
    if (result.code !== "CANCELLED") {
      showStatus(ERROR_MESSAGES[result.code] || ERROR_MESSAGES.INSERT_ERROR);
    }

    return;
  }

  startPlacement(result.dataUrl);
}

function getCurrentPageWrapper() {
  const pageNumber =
    Number(document.getElementById("pdf-page-count")?.value) || 1;
  const canvas = document.querySelector(
    `canvas[data-page-number="${pageNumber}"]`,
  );

  return { pageNumber, wrapper: canvas?.parentElement || null };
}

function startPlacement(dataUrl) {
  const { pageNumber, wrapper } = getCurrentPageWrapper();

  if (!wrapper) {
    showStatus(ERROR_MESSAGES.INVALID_PAGE);
    return;
  }

  const image = new Image();

  image.onload = () => {
    const aspectRatio = image.naturalHeight / image.naturalWidth;
    const pageAspectRatio = wrapper.offsetHeight / wrapper.offsetWidth;

    placementSession = {
      pageNumber,
      wrapper,
      // Height is expressed against the page height, so the image keeps its
      // real proportions whatever the page shape is
      placement: {
        x: (1 - DEFAULT_WIDTH_RATIO) / 2,
        y: 0,
        width: DEFAULT_WIDTH_RATIO,
        height: (DEFAULT_WIDTH_RATIO * aspectRatio) / pageAspectRatio,
      },
      aspectRatio,
      pageAspectRatio,
    };

    placementSession.placement.y =
      1 - DEFAULT_BOTTOM_RATIO - placementSession.placement.height;

    buildOverlay(dataUrl);
    applyPlacement();
  };

  image.onerror = () => showStatus(ERROR_MESSAGES.INVALID_IMAGE);
  image.src = dataUrl;
}

function buildOverlay(dataUrl) {
  const overlay = document.createElement("div");
  overlay.id = "signature-placement";
  overlay.innerHTML = `
    <img src="${dataUrl}" alt="Signature preview" draggable="false" />
    <span class="signature-placement-handle" aria-hidden="true"></span>
  `;

  const toolbar = document.createElement("div");
  toolbar.id = "signature-placement-toolbar";
  toolbar.innerHTML = `
    <span>Drag to move, pull the corner to resize</span>
    <button id="signature-placement-cancel" class="btn btn-cancel">Cancel</button>
    <button id="signature-placement-accept" class="btn btn-accept">Insert</button>
  `;

  placementSession.wrapper.appendChild(overlay);
  placementSession.wrapper.appendChild(toolbar);
  placementSession.overlay = overlay;
  placementSession.toolbar = toolbar;

  overlay.addEventListener("pointerdown", startDrag);
  overlay
    .querySelector(".signature-placement-handle")
    .addEventListener("pointerdown", startResize);

  document
    .getElementById("signature-placement-cancel")
    .addEventListener("click", cancelPlacement);
  document
    .getElementById("signature-placement-accept")
    .addEventListener("click", confirmPlacement);

  document.addEventListener("keydown", handleEscape);

  // Zoom changes the page size; the overlay follows because it is positioned
  // from fractions of the page
  placementSession.observer = new ResizeObserver(applyPlacement);
  placementSession.observer.observe(placementSession.wrapper);
}

function applyPlacement() {
  if (!placementSession?.overlay) {
    return;
  }

  const { overlay, toolbar, placement, wrapper } = placementSession;

  overlay.style.left = `${placement.x * 100}%`;
  overlay.style.top = `${placement.y * 100}%`;
  overlay.style.width = `${placement.width * 100}%`;
  overlay.style.height = `${placement.height * 100}%`;

  const toolbarTop = (placement.y + placement.height) * wrapper.offsetHeight;
  toolbar.style.top = `${toolbarTop + 8}px`;
}

function startDrag(event) {
  if (event.target.classList.contains("signature-placement-handle")) {
    return;
  }

  event.preventDefault();

  const { wrapper, placement } = placementSession;
  const startX = event.clientX;
  const startY = event.clientY;
  const originX = placement.x;
  const originY = placement.y;

  const onMove = (moveEvent) => {
    const deltaX = (moveEvent.clientX - startX) / wrapper.offsetWidth;
    const deltaY = (moveEvent.clientY - startY) / wrapper.offsetHeight;

    placement.x = clamp(originX + deltaX, 0, 1 - placement.width);
    placement.y = clamp(originY + deltaY, 0, 1 - placement.height);
    applyPlacement();
  };

  trackPointer(event, onMove);
}

function startResize(event) {
  event.preventDefault();
  event.stopPropagation();

  const { wrapper, placement, aspectRatio, pageAspectRatio } =
    placementSession;
  const startX = event.clientX;
  const originWidth = placement.width;

  const onMove = (moveEvent) => {
    const deltaX = (moveEvent.clientX - startX) / wrapper.offsetWidth;
    const maxWidth = 1 - placement.x;

    placement.width = clamp(originWidth + deltaX, MIN_WIDTH_RATIO, maxWidth);
    // Height follows the width so the image never deforms
    placement.height = (placement.width * aspectRatio) / pageAspectRatio;

    if (placement.y + placement.height > 1) {
      placement.y = 1 - placement.height;
    }

    applyPlacement();
  };

  trackPointer(event, onMove);
}

function trackPointer(event, onMove) {
  event.target.setPointerCapture(event.pointerId);

  const onUp = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
  };

  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}

async function confirmPlacement() {
  const { pageNumber, placement } = placementSession;
  const result = await window.electronAPI.insertSignatureImage({
    pageNumber,
    placement: { ...placement },
  });

  if (!result.ok) {
    showStatus(ERROR_MESSAGES[result.code] || ERROR_MESSAGES.INSERT_ERROR);
    endPlacement();
    return;
  }

  endPlacement();
  location.reload();
}

function cancelPlacement() {
  window.electronAPI.cancelSignatureImage();
  endPlacement();
}

function endPlacement() {
  if (!placementSession) {
    return;
  }

  placementSession.observer?.disconnect();
  placementSession.overlay?.remove();
  placementSession.toolbar?.remove();
  placementSession = null;

  document.removeEventListener("keydown", handleEscape);
}

function handleEscape(event) {
  if (event.key === "Escape") {
    cancelPlacement();
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
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