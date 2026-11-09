/*
 * Lets the person place a box on the current page by dragging and resizing it.
 * The result is expressed as fractions of the page (0 to 1) measured from the
 * top left corner, so it stays correct at any zoom level and the viewer never
 * needs to know the page size in points.
 */

const DEFAULT_WIDTH_RATIO = 0.3;
const DEFAULT_BOTTOM_RATIO = 0.12;
const MIN_WIDTH_RATIO = 0.05;

let placementSession = null;

export function startSignaturePlacement({
  previewHtml,
  aspectRatio,
  onConfirm,
  onCancel,
}) {
  if (placementSession) {
    return false;
  }

  const pageNumber =
    Number(document.getElementById("pdf-page-count")?.value) || 1;
  const canvas = document.querySelector(
    `canvas[data-page-number="${pageNumber}"]`,
  );
  const wrapper = canvas?.parentElement;

  if (!wrapper) {
    return false;
  }

  const pageAspectRatio = wrapper.offsetHeight / wrapper.offsetWidth;
  const height = (DEFAULT_WIDTH_RATIO * aspectRatio) / pageAspectRatio;

  placementSession = {
    pageNumber,
    wrapper,
    aspectRatio,
    pageAspectRatio,
    onConfirm,
    onCancel,
    placement: {
      x: (1 - DEFAULT_WIDTH_RATIO) / 2,
      y: 1 - DEFAULT_BOTTOM_RATIO - height,
      width: DEFAULT_WIDTH_RATIO,
      height,
    },
  };

  buildOverlay(previewHtml);
  applyPlacement();
  return true;
}

function buildOverlay(previewHtml) {
  const overlay = document.createElement("div");
  overlay.id = "signature-placement";
  overlay.innerHTML = `
    ${previewHtml}
    <span class="signature-placement-handle" aria-hidden="true"></span>
  `;

  const toolbar = document.createElement("div");
  toolbar.id = "signature-placement-toolbar";
  toolbar.innerHTML = `
    <span>Drag to move, pull the corner to resize</span>
    <button id="signature-placement-cancel" class="btn btn-cancel">Cancel</button>
    <button id="signature-placement-accept" class="btn btn-accept">Continue</button>
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

  trackPointer(event, (moveEvent) => {
    const deltaX = (moveEvent.clientX - startX) / wrapper.offsetWidth;
    const deltaY = (moveEvent.clientY - startY) / wrapper.offsetHeight;

    placement.x = clamp(originX + deltaX, 0, 1 - placement.width);
    placement.y = clamp(originY + deltaY, 0, 1 - placement.height);
    applyPlacement();
  });
}

function startResize(event) {
  event.preventDefault();
  event.stopPropagation();

  const { wrapper, placement, aspectRatio, pageAspectRatio } = placementSession;
  const startX = event.clientX;
  const originWidth = placement.width;

  trackPointer(event, (moveEvent) => {
    const deltaX = (moveEvent.clientX - startX) / wrapper.offsetWidth;

    placement.width = clamp(
      originWidth + deltaX,
      MIN_WIDTH_RATIO,
      1 - placement.x,
    );
    // Height follows the width so the stamp never deforms
    placement.height = (placement.width * aspectRatio) / pageAspectRatio;

    if (placement.y + placement.height > 1) {
      placement.y = 1 - placement.height;
    }

    applyPlacement();
  });
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

function confirmPlacement() {
  const { pageNumber, placement, onConfirm } = placementSession;
  endPlacement();
  onConfirm?.({ pageNumber, placement: { ...placement } });
}

function cancelPlacement() {
  const { onCancel } = placementSession;
  endPlacement();
  onCancel?.();
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
