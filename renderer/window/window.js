// FLOATING WINDOW
const floatingToggle = document.getElementById("floating-toggle");

let isFloating = false;
let documentSize = null;

function getDocumentSize() {
  const page = document.querySelector(".pdf-page");
  if (!page) {
    return null;
  }
  return {
    width: page.offsetWidth,
    height: page.offsetHeight,
  };
}

document.addEventListener("pdf-document-loaded", (event) => {
  documentSize = event.detail;
  if (isFloating) {
    window.electronAPI.setFloatingMode(true, documentSize);
  }
});

window.addEventListener("resize", () => {
  if (isFloating) {
    document.dispatchEvent(new CustomEvent("floating-window-resized"));
  }
});

floatingToggle.addEventListener("click", () => {
  isFloating = !isFloating;
  documentSize = getDocumentSize() || documentSize;
  floatingToggle.textContent = isFloating ? "Floating" : "Normal";
  floatingToggle.classList.toggle("active", isFloating);
  floatingToggle.setAttribute("aria-pressed", String(isFloating));
  window.electronAPI.setFloatingMode(isFloating, documentSize);
});
