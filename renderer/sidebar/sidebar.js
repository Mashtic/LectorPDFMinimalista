import { SidebarThumbnails } from "./sidebar-thumbnails.js";
import { renderOutline } from "./sidebar-outline.js";

export function initializeSidebar(viewer) {
  const toggleButton = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");
  const tabs = [...document.querySelectorAll(".sidebar-tab")];
  const panels = {
    pages: document.getElementById("sidebar-pages"),
    outline: document.getElementById("sidebar-outline"),
  };

  const thumbnails = new SidebarThumbnails(viewer, panels.pages);
  let isOpen = false;
  let isOutlineLoaded = false;

  toggleButton.hidden = false;

  toggleButton.addEventListener("click", () => {
    setOpen(!isOpen);
  });

  // Floating mode shrinks the window to the page size, so the sidebar steps
  // aside instantly to keep the document width measurement correct.
  document.addEventListener("floating-mode-entered", () => {
    if (isOpen) {
      setOpen(false, false);
    }
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  });

  viewer.onCurrentPageChanged = (pageNumber) => {
    thumbnails.setActivePage(pageNumber, isOpen);
  };

  thumbnails.setActivePage(viewer.currentPage, false);

  function setOpen(open, isAnimated = true) {
    isOpen = open;

    if (!isAnimated) {
      document.body.classList.add("sidebar-no-transition");
      requestAnimationFrame(() => {
        document.body.classList.remove("sidebar-no-transition");
      });
    }

    document.body.classList.toggle("sidebar-open", open);
    sidebar.inert = !open;
    toggleButton.setAttribute("aria-expanded", String(open));

    if (open) {
      thumbnails.build();
      thumbnails.setActivePage(viewer.currentPage, true);
    }
  }

  function selectTab(tabName) {
    tabs.forEach((tab) => {
      const isSelected = tab.dataset.tab === tabName;
      tab.classList.toggle("is-active", isSelected);
      tab.setAttribute("aria-selected", String(isSelected));
    });

    Object.entries(panels).forEach(([name, panel]) => {
      panel.hidden = name !== tabName;
    });

    if (tabName === "outline" && !isOutlineLoaded) {
      isOutlineLoaded = true;
      renderOutline(viewer, panels.outline);
    }

    if (tabName === "pages") {
      thumbnails.setActivePage(viewer.currentPage, true);
    }
  }
}
