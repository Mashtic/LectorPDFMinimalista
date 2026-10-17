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

    const dropIndicator = document.createElement("div");
    dropIndicator.className = "sidebar-drop-indicator";
    list.appendChild(dropIndicator);
    this.dropIndicator = dropIndicator;
    this.draggedPage = null;

    const hideDropIndicator = () => {
      dropIndicator.classList.remove("is-visible");
    };

    const getInsertionPoint = (targetItem, event) => {
      const rect = targetItem.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2
        ? targetItem
        : targetItem.nextElementSibling === dropIndicator
          ? null
          : targetItem.nextElementSibling;
    };

    const showDropIndicator = (draggedItem, insertBefore, targetItem) => {
      if (
        insertBefore === draggedItem ||
        (insertBefore === null
          ? list.lastElementChild === draggedItem
          : draggedItem.nextElementSibling === insertBefore)
      ) {
        hideDropIndicator();
        return;
      }
      const buttons = [...list.querySelectorAll(".sidebar-thumbnail")];
      const nextIndex = insertBefore
        ? buttons.indexOf(insertBefore)
        : buttons.length;
      const above = buttons[nextIndex - 1];
      const below = buttons[nextIndex];
      let y;
      if (above && below) {
        y = (above.offsetTop + above.offsetHeight + below.offsetTop) / 2;
      } else if (below) {
        y = Math.max(below.offsetTop - 2, 0);
      } else {
        y = above.offsetTop + above.offsetHeight + 2;
      }
      dropIndicator.style.top = `${y - 1.5}px`;
      dropIndicator.classList.add("is-visible");
    };

    list.addEventListener("dragleave", (event) => {
      if (!list.contains(event.relatedTarget)) hideDropIndicator();
    });

    const reorderBar = document.createElement("div");
    reorderBar.className = "sidebar-reorder-bar";
    const reorderButton = document.createElement("button");
    reorderButton.type = "button";
    reorderButton.className = "sidebar-reorder-button";
    reorderButton.textContent = "Edit File";
    reorderButton.setAttribute("aria-pressed", "false");
    const saveOrderButton = document.createElement("button");
    saveOrderButton.type = "button";
    saveOrderButton.className = "sidebar-reorder-button sidebar-save-order";
    saveOrderButton.textContent = "Accept";
    saveOrderButton.hidden = true;
    reorderBar.append(reorderButton, saveOrderButton);
    this.container.appendChild(reorderBar);
    this.list = list;
    this.order = [];
    this.reorderButton = reorderButton;
    this.saveOrderButton = saveOrderButton;
    reorderButton.addEventListener("click", () => {
      const enabled = reorderButton.getAttribute("aria-pressed") !== "true";
      reorderButton.setAttribute("aria-pressed", String(enabled));
      reorderButton.textContent = enabled ? "Cancel" : "Edit File";
      list.classList.toggle("is-reordering", enabled);
      saveOrderButton.hidden = !enabled;
      if (!enabled) hideDropIndicator();
    });
    saveOrderButton.addEventListener("click", async () => {
      saveOrderButton.disabled = true;
      saveOrderButton.textContent = "Accepting…";
      try {
        await window.electronAPI.reorderPages(this.order);
        window.location.reload();
      } catch (error) {
        saveOrderButton.disabled = false;
        saveOrderButton.textContent = "Accept";
        console.error("Could not reorder PDF pages", error);
      }
    });

    for (const [pageNumber, entry] of this.viewer.pages) {
      const baseViewport = entry.page.getViewport({ scale: 1 });
      const height =
        (THUMBNAIL_WIDTH * baseViewport.height) / baseViewport.width;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "sidebar-thumbnail";
      button.dataset.pageNumber = pageNumber;
      button.setAttribute("aria-label", `Go to page ${pageNumber}`);
      button.draggable = true;

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
        if (list.classList.contains("is-reordering")) return;
        this.viewer.jumpToPage(pageNumber);
      });

      button.addEventListener("dragstart", (event) => {
        if (!list.classList.contains("is-reordering")) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData("text/plain", String(pageNumber));
        event.dataTransfer.effectAllowed = "move";
        button.classList.add("is-dragging");
        this.draggedPage = pageNumber;
      });
      button.addEventListener("dragend", () => {
        button.classList.remove("is-dragging");
        this.draggedPage = null;
        hideDropIndicator();
      });
      button.addEventListener("dragover", (event) => {
        if (!list.classList.contains("is-reordering")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const dragged = this.items.get(this.draggedPage);
        if (!dragged) return;
        const insertBefore = getInsertionPoint(button, event);
        showDropIndicator(dragged.button, insertBefore, button);
      });
      button.addEventListener("drop", (event) => {
        if (!list.classList.contains("is-reordering")) return;
        event.preventDefault();
        hideDropIndicator();
        const draggedPage = Number(event.dataTransfer.getData("text/plain"));
        const targetPage = Number(button.dataset.pageNumber);
        if (!this.order.includes(draggedPage) || draggedPage === targetPage)
          return;
        const draggedItem = this.items.get(draggedPage).button;
        const targetItem = this.items.get(targetPage).button;
        list.insertBefore(draggedItem, getInsertionPoint(targetItem, event));
        this.order = [...list.querySelectorAll(".sidebar-thumbnail")].map(
          (item) => Number(item.dataset.pageNumber),
        );
      });

      list.appendChild(button);
      this.order.push(pageNumber);
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
