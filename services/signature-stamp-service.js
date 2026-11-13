const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

/*
 * Draws the graphic expression of the signature on a page: the image on top
 * and the text underneath. It runs before the document is signed, so the
 * stamp ends up covered by the signature instead of invalidating it.
 *
 * The placement arrives as fractions of the page (0 to 1) measured from the
 * top left corner, because the viewer does not know the page size in points.
 */

// Share of the box height taken by the text when there is text to draw
const TEXT_BLOCK_RATIO = 0.32;
const LINE_SPACING = 1.25;
const MAX_FONT_SIZE = 11;

function createStampError(code) {
  const error = new Error(`Signature stamp failed: ${code}`);
  error.code = code;
  return error;
}

function buildTextLines(appearance, signerName) {
  const lines = [];

  if (appearance.text) {
    lines.push(...appearance.text.split("\n").filter(Boolean));
  }

  if (appearance.showName && signerName) {
    lines.push(signerName);
  }

  if (appearance.showDate) {
    lines.push(new Date().toLocaleString());
  }

  return lines;
}

function toPdfBox(placement, page) {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const width = placement.width * pageWidth;
  const height = placement.height * pageHeight;

  return {
    x: placement.x * pageWidth,
    // The viewer measures from the top, PDF measures from the bottom
    y: pageHeight - placement.y * pageHeight - height,
    width,
    height,
  };
}

async function embedImage(pdf, appearance) {
  if (appearance.mediaType === "image/png") {
    // embedPng keeps the alpha channel, so transparency is preserved
    return pdf.embedPng(appearance.imageBytes);
  }

  return pdf.embedJpg(appearance.imageBytes);
}

function drawTextLines(page, font, lines, box, fontSize) {
  let cursor = box.y + (lines.length - 1) * fontSize * LINE_SPACING;

  lines.forEach((line) => {
    const lineWidth = font.widthOfTextAtSize(line, fontSize);

    page.drawText(line, {
      x: box.x + Math.max(0, (box.width - lineWidth) / 2),
      y: cursor,
      size: fontSize,
      font,
      color: rgb(0.1, 0.12, 0.15),
    });

    cursor -= fontSize * LINE_SPACING;
  });
}

async function stampAppearance({
  pdfBuffer,
  appearance,
  placement,
  pageNumber,
  signerName,
}) {
  const pdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const page = pdf.getPages()[Number(pageNumber) - 1];

  if (!page) {
    throw createStampError("INVALID_PAGE");
  }

  const box = toPdfBox(placement, page);
  const lines = buildTextLines(appearance, signerName);

  const textHeight = lines.length ? box.height * TEXT_BLOCK_RATIO : 0;
  const imageHeight = box.height - textHeight;

  let image;

  try {
    image = await embedImage(pdf, appearance);
  } catch (error) {
    throw error.code ? error : createStampError("INVALID_IMAGE");
  }

  page.drawImage(image, {
    x: box.x,
    y: box.y + textHeight,
    width: box.width,
    height: imageHeight,
  });

  if (lines.length) {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontSize = Math.min(
      MAX_FONT_SIZE,
      textHeight / (lines.length * LINE_SPACING),
    );

    drawTextLines(page, font, lines, { ...box, y: box.y }, fontSize);
  }

  return Buffer.from(await pdf.save());
}

module.exports = { stampAppearance };
