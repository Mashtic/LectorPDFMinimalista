// FLOATING WINDOW
const floatingToggle = document.getElementById("floating-toggle");
const { ipcRenderer } = require("electron");

let isFloating = false;

floatingToggle.addEventListener("click", () => {
  isFloating = !isFloating;

  floatingToggle.textContent = isFloating ? "Floating" : "Normal";

  floatingToggle.classList.toggle("active", isFloating);

  floatingToggle.setAttribute("aria-pressed", String(isFloating));

  ipcRenderer.send("set-floating-mode", isFloating);
});
