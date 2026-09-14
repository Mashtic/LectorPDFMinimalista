import { GlobalWorkerOptions, getDocument } from '../../node_modules/pdfjs-dist/build/pdf.mjs';
import { createZoomState, zoomIn, zoomOut, setZoom } from './zoom.js';

GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';

// Temp sample file for zoom testing
const url = './sample.pdf';

let pdfDoc = null;
let pageIsRendering = false;
let renderPending = false;

const zoomState = createZoomState();

const container = document.getElementById('pdf-container');
const canvas = document.getElementById('pdf-render');
const context = canvas.getContext('2d');

async function renderPage(onDone) {
    pageIsRendering = true;

    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: zoomState.scale });

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;

    pageIsRendering = false;
    if (onDone) onDone();

    if (renderPending) {
        const pending = renderPending === true ? undefined : renderPending;
        renderPending = false;
        renderPage(pending);
    }
}

function queueRenderPage(onDone) {
    if (pageIsRendering) {
        renderPending = onDone || true;
    } else {
        renderPage(onDone);
    }
}


// Zoom controls (ctrl + +/- or ctrl + wheel)
document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;

    if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomIn(zoomState);
        queueRenderPage();
    }

    if (event.key === '-') {
        event.preventDefault();
        zoomOut(zoomState);
        queueRenderPage();
    }
});

document.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();

    const rect = container.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const prevScale = zoomState.scale;

    const docX = (container.scrollLeft + cursorX) / prevScale;
    const docY = (container.scrollTop + cursorY) / prevScale;

    const direction = event.deltaY < 0 ? 1 : -1;
    setZoom(zoomState, prevScale + direction * zoomState.step);

    queueRenderPage(() => {
        container.scrollLeft = docX * zoomState.scale - cursorX;
        container.scrollTop = docY * zoomState.scale - cursorY;
    });
}, { passive: false });

(async function () {
    console.log(url);
    pdfDoc = await getDocument({ url }).promise;
    await renderPage();
}());