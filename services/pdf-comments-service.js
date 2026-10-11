const {
  PDFDocument,
  PDFArray,
  PDFName,
  PDFNumber,
  PDFHexString,
  PDFDict,
  PDFRef,
  PDFString,
} = require("pdf-lib");
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
    const now = PDFString.fromDate(new Date());
    annotation = context.obj({
      Type: "Annot",
      Subtype: "Highlight",
      Rect: [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys),
      ],
      QuadPoints: points,
      Contents: PDFHexString.fromText(text),
      Subj: PDFHexString.fromText(quote || ""),
      // T: PDFHexString.fromText("Folio"),
      C: [1, 0.85, 0.25],
      CA: 0.35,
      F: PDFNumber.of(4),
      CreationDate: now,
    });
  } else {
    const { width, height } = page.getSize();
    const noteIndex = annotations.size();
    const x = Math.max(0, width - 32 - (noteIndex % 4) * 24);
    const y = Math.max(0, height - 32 - Math.floor(noteIndex / 4) * 24);
    const now = PDFString.fromDate(new Date());
    annotation = context.obj({
      Type: "Annot",
      Subtype: "Text",
      Rect: [x, y, x + 24, y + 24],
      Contents: PDFHexString.fromText(text),
      // T: PDFHexString.fromText("Folio"),
      Name: "Comment",
      C: [1, 0.9, 0.55],
      F: PDFNumber.of(4),
      CreationDate: now,
    });
  }
  annotations.push(context.register(annotation));

  const updatedPdf = await pdf.save();
  setGlobalVar("currentPDF", updatedPdf);
  return Array.from(updatedPdf);
}

function referenceFromAnnotationId(annotationId) {
  const match = /^(\d+)R(\d*)$/.exec(annotationId);

  if (!match) {
    return null;
  }

  return PDFRef.of(Number(match[1]), match[2] ? Number(match[2]) : 0);
}

function isSameReference(first, second) {
  return (
    first instanceof PDFRef &&
    first.objectNumber === second.objectNumber &&
    first.generationNumber === second.generationNumber
  );
}

function indexOfReference(annotations, reference) {
  for (let index = 0; index < annotations.size(); index++) {
    if (isSameReference(annotations.get(index), reference)) {
      return index;
    }
  }

  return -1;
}

function findAnnotation(documentPDF, pageNumber, annotationId) {
  const reference = referenceFromAnnotationId(annotationId);
  const annotations = documentPDF.getPages()[pageNumber - 1]?.node.Annots();

  if (!reference || !annotations) {
    throw new Error(
      `Annotation ${annotationId} not found on page ${pageNumber}`,
    );
  }

  if (indexOfReference(annotations, reference) === -1) {
    throw new Error(
      `Annotation ${annotationId} not found on page ${pageNumber}`,
    );
  }

  return {
    annotations,
    reference,
    dictionary: documentPDF.context.lookup(reference, PDFDict),
  };
}

async function setHighlightComment(dataPDF, pageNumber, annotationId, text) {
  const documentPDF = await PDFDocument.load(dataPDF, {
    updateMetadata: false,
  });
  const { dictionary } = findAnnotation(documentPDF, pageNumber, annotationId);

  const contentsKey = PDFName.of("Contents");
  const targets = [dictionary];
  const popup = dictionary.lookupMaybe(PDFName.of("Popup"), PDFDict);

  if (popup) {
    targets.push(popup);
  }

  for (const target of targets) {
    if (text) {
      target.set(contentsKey, PDFHexString.fromText(text));
    } else {
      target.delete(contentsKey);
    }
  }

  dictionary.delete(PDFName.of("RC"));
  dictionary.set(PDFName.of("M"), PDFString.fromDate(new Date()));

  return documentPDF.save();
}

async function deleteHighlight(dataPDF, pageNumber, annotationId) {
  const documentPDF = await PDFDocument.load(dataPDF, {
    updateMetadata: false,
  });
  const { annotations, reference, dictionary } = findAnnotation(
    documentPDF,
    pageNumber,
    annotationId,
  );

  const references = [reference];
  const popupReference = dictionary.get(PDFName.of("Popup"));

  if (popupReference instanceof PDFRef) {
    references.push(popupReference);
  }

  for (let index = 0; index < annotations.size(); index++) {
    const other = annotations.get(index);

    if (!(other instanceof PDFRef)) {
      continue;
    }

    const otherDictionary = documentPDF.context.lookupMaybe(other, PDFDict);

    if (isSameReference(otherDictionary?.get(PDFName.of("IRT")), reference)) {
      references.push(other);
    }
  }

  for (const target of references) {
    const index = indexOfReference(annotations, target);

    if (index !== -1) {
      annotations.remove(index);
    }

    documentPDF.context.delete(target);
  }

  return documentPDF.save();
}

module.exports = { addPdfComment, setHighlightComment, deleteHighlight };
