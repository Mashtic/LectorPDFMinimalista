import { SimpleLinkService } from "../node_modules/pdfjs-dist/web/pdf_viewer.mjs";

function destinationTop(kind, args) {
  switch (kind) {
    case "XYZ": // [left, top, zoom]
      return args[1] ?? null;
    case "FitH": // [top]
    case "FitBH":
      return args[0] ?? null;
    case "FitR": // [left, bottom, right, top]
      return args[3] ?? null;
    default: // Fit, FitB, FitV, FitBV: whole page / vertical fit
      return null;
  }
}

export class ViewerLinkService extends SimpleLinkService {
  constructor(viewer) {
    super();
    this.viewer = viewer;
  }

  get pagesCount() {
    return this.viewer.documentPDF?.numPages ?? 0;
  }

  get page() {
    return this.viewer.currentPage;
  }

  set page(pageNumber) {
    this.viewer.jumpToPage(pageNumber);
  }

  goToPage(value) {
    const pageNumber = Number.parseInt(value, 10);
    if (Number.isInteger(pageNumber)) this.viewer.jumpToPage(pageNumber);
  }

  async goToDestination(dest) {
    const documentPDF = this.viewer.documentPDF;
    if (!documentPDF) return;

    let explicitDest;
    try {
      explicitDest =
        typeof dest === "string"
          ? await documentPDF.getDestination(dest)
          : await dest;
    } catch (error) {
      console.error("Could not resolve link destination:", error);
      return;
    }
    if (!Array.isArray(explicitDest)) return;

    const [destRef, kind, ...args] = explicitDest;

    let pageNumber;
    if (destRef && typeof destRef === "object") {
      try {
        pageNumber = (await documentPDF.getPageIndex(destRef)) + 1;
      } catch {
        return;
      }
    } else if (Number.isInteger(destRef)) {
      pageNumber = destRef + 1;
    }

    if (!pageNumber || pageNumber < 1 || pageNumber > documentPDF.numPages) {
      return;
    }

    this.viewer.jumpToPagePosition(
      pageNumber,
      destinationTop(kind?.name, args),
    );
  }

  executeNamedAction(action) {
    switch (action) {
      case "NextPage":
        this.viewer.skipDown();
        break;
      case "PrevPage":
        this.viewer.skipUp();
        break;
      case "FirstPage":
        this.viewer.jumpToPage(1);
        break;
      case "LastPage":
        this.viewer.jumpToPage(this.pagesCount);
        break;
    }
  }
}
