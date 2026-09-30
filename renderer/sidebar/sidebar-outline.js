export async function renderOutline(viewer, container) {
  container.innerHTML = "";

  const outline = await viewer.documentPDF.getOutline();

  if (!outline || outline.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "sidebar-empty";
    emptyMessage.textContent = "This document has no outline.";
    container.appendChild(emptyMessage);
    return;
  }

  container.appendChild(createOutlineList(viewer, outline, 0));
}

export async function resolveDestination(documentPDF, dest) {
  const explicitDest =
    typeof dest === "string" ? await documentPDF.getDestination(dest) : dest;

  if (!Array.isArray(explicitDest) || explicitDest.length === 0) {
    return null;
  }

  const [target, mode, ...args] = explicitDest;
  let pageIndex = null;

  if (target && typeof target === "object") {
    pageIndex = await documentPDF.getPageIndex(target);
  } else if (Number.isInteger(target)) {
    pageIndex = target;
  }

  if (pageIndex === null) return null;

  let top = null;

  if (mode?.name === "XYZ") {
    top = args[1];
  } else if (mode?.name === "FitH" || mode?.name === "FitBH") {
    top = args[0];
  }

  return {
    pageNumber: pageIndex + 1,
    top: typeof top === "number" ? top : null,
  };
}

function createOutlineList(viewer, items, depth) {
  const list = document.createElement("ul");
  list.className = "sidebar-outline-list";

  items.forEach((item) => {
    list.appendChild(createOutlineItem(viewer, item, depth));
  });

  return list;
}

function createOutlineItem(viewer, item, depth) {
  const listItem = document.createElement("li");
  listItem.className = "sidebar-outline-item";

  const row = document.createElement("div");
  row.className = "sidebar-outline-row";
  row.style.setProperty("--outline-depth", depth);

  const hasChildren = item.items && item.items.length > 0;

  if (hasChildren) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "sidebar-outline-toggle";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", `Collapse ${item.title}`);
    toggle.innerHTML = `
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
        stroke-linejoin="round">
        <polyline points="3 2 7 5 3 8"></polyline>
      </svg>`;

    toggle.addEventListener("click", () => {
      const isCollapsed = listItem.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!isCollapsed));
      toggle.setAttribute(
        "aria-label",
        `${isCollapsed ? "Expand" : "Collapse"} ${item.title}`,
      );
    });

    row.appendChild(toggle);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "sidebar-outline-spacer";
    row.appendChild(spacer);
  }

  const link = document.createElement("button");
  link.type = "button";
  link.className = "sidebar-outline-link";
  link.textContent = item.title;
  link.title = item.title;

  if (item.dest) {
    link.addEventListener("click", async () => {
      const destination = await resolveDestination(
        viewer.documentPDF,
        item.dest,
      );
      if (!destination) return;

      viewer.jumpToPagePosition(destination.pageNumber, destination.top);
    });
  } else {
    link.disabled = true;
  }

  row.appendChild(link);
  listItem.appendChild(row);

  if (hasChildren) {
    listItem.appendChild(createOutlineList(viewer, item.items, depth + 1));
  }

  return listItem;
}