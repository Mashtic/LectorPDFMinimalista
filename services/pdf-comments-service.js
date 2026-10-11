const { PDFDocument, PDFArray, PDFName, PDFNumber, PDFHexString } = require("pdf-lib");
const { getGlobalVar, setGlobalVar } = require("./global-var-service.js");

async function addPdfComment({ pageNumber, text, quote, quads = [] }) {
  const source = getGlobalVar("currentPDF");
  if (!source) throw new Error("No PDF is currently open");

  const pdf = await PDFDocument.load(source);
  const page = pdf.getPage(Number(pageNumber) - 1);
  if (!page) throw new Error("Invalid PDF page");

  const context = pdf.context;
  const annotationsKey = PDFName.of("Annots");
  let annotations = page.node.lookupMaybe(annotationsKey, PDFArray);
  if (!annotations) {
    annotations = context.obj([]);
    page.node.set(annotationsKey, annotations);
  }

  const isTextComment = Array.isArray(quads) && quads.length > 0;
  let annotation;

  if (isTextComment) {
    const points = quads.flat();
    const xs = quads.flatMap((quad) => [quad[0], quad[2], quad[4], quad[6]]);
    const ys = quads.flatMap((quad) => [quad[1], quad[3], quad[5], quad[7]]);
    annotation = context.obj({
      Type: "Annot",
      Subtype: "Highlight",
      Rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      QuadPoints: points,
      Contents: PDFHexString.fromText(text),
      Subj: PDFHexString.fromText(quote || ""),
      T: PDFHexString.fromText("Folio"),
      C: [1, 0.85, 0.25],
      CA: 0.35,
      F: PDFNumber.of(4),
    });
  } else {
    const { width, height } = page.getSize();
    const noteIndex = annotations.size();
    const x = Math.max(0, width - 32 - (noteIndex % 4) * 24);
    const y = Math.max(0, height - 32 - Math.floor(noteIndex / 4) * 24);
    annotation = context.obj({
      Type: "Annot",
      Subtype: "Text",
      Rect: [x, y, x + 24, y + 24],
      Contents: PDFHexString.fromText(text),
      T: PDFHexString.fromText("Folio"),
      Name: "Comment",
      C: [1, 0.9, 0.55],
      F: PDFNumber.of(4),
    });
  }
  annotations.push(context.register(annotation));

  const updatedPdf = await pdf.save();
  setGlobalVar("currentPDF", updatedPdf);
  return Array.from(updatedPdf);
}

module.exports = { addPdfComment };
