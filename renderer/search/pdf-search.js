import { createSearchState, buildPageIndex, findMatchesInPage } from "./text-search.js";

export class PdfSearchController {
  constructor(viewer) {
    this.viewer = viewer;
    this.state = createSearchState();
  }

  async search(query) {
    this.clear();
    this.state.query = query;
    if (!query) return this.state;

    for (const pageNumber of [...this.viewer.pages.keys()].sort((a, b) => a - b)) {
      const pageIndex = await this.getPageIndex(pageNumber);
      findMatchesInPage(pageIndex, query).forEach((match) =>
        this.state.matches.push({ ...match, pageNumber }),
      );
    }

    if (this.state.matches.length) {
      this.state.activeIndex = 0;
      await this.goToActiveMatch();
    }

    return this.state;
  }

  async getPageIndex(pageNumber) {
    const entry = this.viewer.pages.get(pageNumber);
    if (!entry.pageIndex) {
      const textContent = await entry.page.getTextContent();
      entry.pageIndex = buildPageIndex(textContent);
    }
    return entry.pageIndex;
  }

  async nextMatch() {
    if (!this.state.matches.length) return;
    this.state.activeIndex = (this.state.activeIndex + 1) % this.state.matches.length;
    await this.goToActiveMatch();
  }

  async previousMatch() {
    if (!this.state.matches.length) return;
    const total = this.state.matches.length;
    this.state.activeIndex = (this.state.activeIndex - 1 + total) % total;
    await this.goToActiveMatch();
  }

  async goToActiveMatch() {
    const match = this.state.matches[this.state.activeIndex];
    if (!match) return;

    const entry = this.viewer.pages.get(match.pageNumber);
    if (!entry.rendered) {
      await this.viewer.renderPage(match.pageNumber, entry.canvas);
    }

    this.refreshHighlights();

    const span = entry.textDivs?.[match.segments[0]?.itemIndex];
    (span ?? entry.wrapper).scrollIntoView({ block: "center", behavior: "smooth" });
  }

  refreshHighlights() {
    const ranges = [];
    let activeRange = null;

    this.state.matches.forEach((match, index) => {
    const entry = this.viewer.pages.get(match.pageNumber);

    if (!entry?.textDivs) return;

    match.segments.forEach((segment) => {
      const textNode = entry.textDivs[segment.itemIndex]?.firstChild;
      if (!textNode) return;

      const range = new Range();
      range.setStart(textNode, segment.startInItem);
      range.setEnd(textNode, segment.endInItem);

      if (index === this.state.activeIndex) activeRange = range;
      else ranges.push(range);
      });
    });

    CSS.highlights.set("pdf-search", new Highlight(...ranges));
    CSS.highlights.set("pdf-search-active", new Highlight(...(activeRange ? [activeRange] : [])));

}

  onPageRendered() {
    if (this.state.query) this.refreshHighlights();
  }

  onPageUnloaded() {
    if (this.state.query) this.refreshHighlights();
  }

  clear() {
    CSS.highlights.delete("pdf-search");
    CSS.highlights.delete("pdf-search-active");
    this.state = createSearchState();
  }
}
