const { PdfPresentationViewer } = require("./pdf-presentation-viewer.js");

const viewer = new PdfPresentationViewer("../../src/pdf/test/pdf2.pdf");

var mouseTimeout;
var isMouseHidden = false;

viewer.load();

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "arrowleft") {
    event.preventDefault();
    viewer.prevPage();
  }

  if (event.key.toLowerCase() === "arrowright") {
    event.preventDefault();
    viewer.nextPage();
  }
});

document.addEventListener("wheel", (event) => {
  if (event.deltaY < 0) {
    event.preventDefault();
    viewer.prevPage();
  }

  if (event.deltaY > 0) {
    event.preventDefault();
    viewer.nextPage();
  }
});

document.addEventListener("mousemove", handleMouseMove);

function handleMouseMove() {
  if (mouseTimeout) {
    clearTimeout(mouseTimeout);
  }

  mouseTimeout = setTimeout(() => {
    if (!isMouseHidden) {
      document.querySelector("body").style.cursor = "none";
      isMouseHidden = true;
    }
  }, 3000);

  if (isMouseHidden) {
    document.querySelector("body").style.cursor = "auto";
    isMouseHidden = false;
  }
}
