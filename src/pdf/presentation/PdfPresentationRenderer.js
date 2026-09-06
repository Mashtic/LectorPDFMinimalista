import { PdfPresentationViewer } from "./PdfPresentationViewer.js";

const viewer = new PdfPresentationViewer("../test/pdf2.pdf")

var mouseTimeout
var isMouseHidden = false

viewer.load()

document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'arrowleft') {
        event.preventDefault();
        viewer.prevPage()
    }

    if (event.key.toLowerCase() === 'arrowright') {
        event.preventDefault();
        viewer.nextPage()
    }
});

document.addEventListener('mousewheel', (event) => {
    if (event.deltaY < 0) {
        event.preventDefault();
        viewer.prevPage()
    }

    if (event.deltaY > 0) {
        event.preventDefault();
        viewer.nextPage()
    }
});

document.addEventListener('mousemove', hideMouse)

function hideMouse() {
    if (mouseTimeout) {
        clearTimeout(mouseTimeout)
    }

    mouseTimeout = setTimeout(() => {
        if (!isMouseHidden) {
            document.querySelector('body').style.cursor = 'none'
            isMouseHidden = true
        }
    }, 3000)

    if (isMouseHidden) {
        document.querySelector('body').style.cursor = 'auto'
        isMouseHidden = false
    }
}
