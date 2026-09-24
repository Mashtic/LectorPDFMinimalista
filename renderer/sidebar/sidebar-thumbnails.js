const THUMBNAIL_WIDTH = 150;

export class SidebarThumbnails {
  constructor(viewer, container) {
    this.viewer = viewer;
    this.container = container;
    this.items = new Map();
    this.activePage = null;
    this.isBuilt = false;
    this.observer = null;
  }

  build() {
    if (this.isBuilt) return;
    this.isBuilt = true;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const pageNumber = Number(entry.target.dataset.pageNumber);
          this.observer.unobserve(entry.target);
          this.renderThumbnail(pageNumber);
        });
      },
      {
        root: this.container,
        rootMargin: "400px 0px",
        threshold: 0,
      },
    );

    const list = document.createElement("div");
    list.className = "sidebar-thumbnail-list";

    for (const [pageNumber, entry] of this.viewer.pages) {
      const baseViewport = entry.page.getViewport({ scale: 1 });
      const height = (THUMBNAIL_WIDTH * baseViewport.height) / baseViewport.width;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "sidebar-thumbnail";
      button.dataset.pageNumber = pageNumber;
      button.setAttribute("aria-label", `Go to page ${pageNumber}`);

      const canvas = document.createElement("canvas");
      canvas.className = "sidebar-thumbnail-canvas";
      canvas.style.width = `${THUMBNAIL_WIDTH}px`;
      canvas.style.height = `${height}px`;

      const label = document.createElement("span");
      label.className = "sidebar-thumbnail-label";
      label.textContent = pageNumber;

      button.appendChild(canvas);
      button.appendChild(label);
      button.addEventListener("click", () => {
        this.viewer.jumpToPage(pageNumber);
      });

      list.appendChild(button);
      this.items.set(pageNumber, { button, canvas, isRendered: false });
      this.observer.observe(button);
    }

    this.container.appendChild(list);

    if (this.activePage) {
      this.setActivePage(this.activePage, false);
    }
  }

  async renderThumbnail(pageNumber) {
    const item = this.items.get(pageNumber);
    if (!item || item.isRendered) return;
    item.isRendered = true;

    try {
      const page = await this.viewer.documentPDF.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: THUMBNAIL_WIDTH / baseViewport.width,
      });
      const outputScale = window.devicePixelRatio || 1;

      item.canvas.width = Math.floor(viewport.width * outputScale);
      item.canvas.height = Math.floor(viewport.height * outputScale);

      await page.render({
        canvasContext: item.canvas.getContext("2d"),
        viewport,
        transform:
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
      }).promise;
    } catch {
      item.isRendered = false;
      this.observer.observe(item.button);
    }
  }

  setActivePage(pageNumber, shouldScroll) {
    const previous = this.items.get(this.activePage);
    if (previous) {
      previous.button.classList.remove("is-active");
      previous.button.removeAttribute("aria-current");
    }

    this.activePage = pageNumber;

    const current = this.items.get(pageNumber);
    if (!current) return;

    current.button.classList.add("is-active");
    current.button.setAttribute("aria-current", "page");

    if (shouldScroll && !this.container.hidden) {
      current.button.scrollIntoView({ block: "nearest" });
    }
  }
}