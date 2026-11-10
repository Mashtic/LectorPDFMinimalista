const container = document.getElementById("markdown-container");
const preview = document.getElementById("markdown-preview");
const editor = document.getElementById("markdown-editor");
const status = document.getElementById("save-status");

let folderPreviewOpen = false;
let folderPreviewOriginalContent = "";
let folderPreviewTitle = "";
let markdownOutlineInitialized = false;

let filePath = await window.electronAPI.getGlobalVar("markdownPath");
let content = await window.electronAPI.getGlobalVar("currentMarkdown");

if (filePath && typeof content === "string") {
  document.body.classList.add("is-markdown");
  document.getElementById("welcome-screen").hidden = true;
  container.hidden = false;
  editor.value = content;
  renderPreview();
  initializeMarkdownOutline();
}

editor.addEventListener("input", () => {
  renderPreview();
  renderMarkdownOutline(document.getElementById("sidebar-outline"));
});
document.addEventListener("keydown", (event) => {
  if (container.hidden || folderPreviewOpen) return;
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (modifier && event.shiftKey && key === "s") {
    event.preventDefault();
    saveAs();
  } else if (modifier && key === "e") {
    event.preventDefault();
    if (editor.hidden) showSource();
    else showPreview();
  } else if (modifier && key === "s") {
    event.preventDefault();
    save();
  }
});

window.electronAPI.onSaveMarkdownDialog(save);
window.electronAPI.onSaveMarkdownAsDialog(saveAs);
window.electronAPI.onEditMarkdown(showSource);
window.electronAPI.onPreviewMarkdown(showPreview);
window.electronAPI.onMarkdownFolderDialog(convertFolderToPdf);
window.electronAPI.onMarkdownFolderSaveDialog(saveFolderPdf);
window.electronAPI.onMarkdownFolderCancelDialog(cancelFolderPreview);

async function convertFolderToPdf() {
  const folder = await window.electronAPI.openMarkdownFolder();
  if (!folder) return;
  if (!folder.files.length) {
    showStatus("No Markdown files found in this folder");
    return;
  }

  folderPreviewOriginalContent = editor.value;
  folderPreviewTitle = folder.folderName;
  const sections = document.createDocumentFragment();
  for (const file of folder.files) {
    editor.value = file.content;
    renderPreview();
    const section = document.createElement("section");
    section.className = "document-section";
    const heading = document.createElement("h1");
    heading.textContent = file.name;
    section.append(heading, ...preview.cloneNode(true).childNodes);
    sections.append(section);
  }
  preview.replaceChildren(sections);
  preview.classList.add("markdown-folder-preview");
  const folderHeadings = [...preview.querySelectorAll("h1, h2, h3, h4, h5, h6")];
  folderHeadings.forEach((heading, index) => { heading.id = `folder-preview-heading-${index}`; });
  editor.value = folderPreviewOriginalContent;
  editor.hidden = true;
  preview.hidden = false;
  container.hidden = false;
  container.classList.add("is-folder-preview");
  document.getElementById("welcome-screen").hidden = true;
  document.body.classList.add("is-markdown");
  folderPreviewOpen = true;
  await window.electronAPI.setGlobalVar("markdownFolderPreviewActive", true);
  initializeMarkdownOutline();
  renderMarkdownOutline(document.getElementById("sidebar-outline"), folderHeadings);
}

async function saveFolderPdf() {
  if (!folderPreviewOpen) return;
  let result;
  try {
    result = await window.electronAPI.exportMarkdownPdf({ html: preview.innerHTML, title: folderPreviewTitle });
  } catch (error) {
    showStatus(`Could not create PDF: ${error.message}`, 6000);
    return;
  }
  if (!result) return;
  folderPreviewOpen = false;
  await window.electronAPI.setGlobalVar("markdownFolderPreviewActive", false);
  if (filePath) {
    editor.value = folderPreviewOriginalContent;
    container.classList.remove("is-folder-preview");
    preview.classList.remove("markdown-folder-preview");
    renderPreview();
    renderMarkdownOutline(document.getElementById("sidebar-outline"));
  } else {
    container.hidden = true;
    container.classList.remove("is-folder-preview");
    preview.classList.remove("markdown-folder-preview");
    document.body.classList.remove("is-markdown");
    document.getElementById("welcome-screen").hidden = false;
  }
  showStatus(`PDF saved to: ${result.path}`, 8000);
}

function cancelFolderPreview() {
  if (!folderPreviewOpen) return;
  folderPreviewOpen = false;
  window.electronAPI.setGlobalVar("markdownFolderPreviewActive", false);
  if (filePath) {
    editor.value = folderPreviewOriginalContent;
    container.classList.remove("is-folder-preview");
    preview.classList.remove("markdown-folder-preview");
    renderPreview();
  } else {
    container.hidden = true;
    container.classList.remove("is-folder-preview");
    preview.classList.remove("markdown-folder-preview");
    document.body.classList.remove("is-markdown");
    document.getElementById("welcome-screen").hidden = false;
  }
}

function showSource() {
  editor.hidden = false;
  preview.hidden = true;
  editor.focus();
}

function showPreview() {
  editor.hidden = true;
  preview.hidden = false;
  renderPreview();
}

async function saveAs() {
  try {
    const result = await window.electronAPI.saveMarkdownAs(editor.value);
    if (!result) return;
    filePath = result.path;
    content = editor.value;
    showStatus(`Markdown saved to: ${result.path}`, 5000);
  } catch (error) {
    showStatus(`Could not save Markdown: ${error.message}`, 6000);
  }
}

async function save() {
  if (!filePath) return saveAs();
  try {
    const result = await window.electronAPI.saveMarkdown(editor.value);
    if (result) {
      content = editor.value;
      showStatus(`Markdown saved to: ${result.path}`, 5000);
    }
  } catch (error) {
    showStatus(`Could not save Markdown: ${error.message}`, 6000);
  }
}

function showStatus(message, duration = 1600) {
  status.textContent = message;
  status.classList.add("is-visible");
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => status.classList.remove("is-visible"), duration);
}

function renderPreview() {
  preview.replaceChildren();
  const lines = editor.value.replace(/\r\n?/g, "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const fence = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      const code = [];
      const fenceCharacter = fence[1][0];
      const fenceLength = fence[1].length;
      const language = fence[2].trim().split(/\s+/, 1)[0].toLowerCase();
      index++;
      const closingFence = new RegExp(`^ {0,3}${fenceCharacter}{${fenceLength},}\\s*$`);
      while (index < lines.length && !closingFence.test(lines[index])) {
        code.push(lines[index].replace(/^ {1,3}/, ""));
        index++;
      }
      if (index < lines.length) index++;
      const pre = document.createElement("pre");
      const codeNode = document.createElement("code");
      if (language) codeNode.classList.add(`language-${language}`);
      if (["powershell", "pwsh", "ps1"].includes(language)) appendPowerShellCode(codeNode, code.join("\n"));
      else codeNode.textContent = code.join("\n");
      pre.append(codeNode); preview.append(pre); continue;
    }
    if (index + 1 < lines.length && isTableDelimiter(lines[index + 1]) && line.includes("|")) {
      const headers = parseTableRow(line);
      const alignments = parseTableRow(lines[index + 1]).map((cell) => {
        const value = cell.trim();
        return value.startsWith(":") && value.endsWith(":") ? "center" : value.endsWith(":") ? "right" : value.startsWith(":") ? "left" : "";
      });
      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      headers.forEach((label, column) => {
        const cell = document.createElement("th");
        cell.scope = "col";
        if (alignments[column]) cell.style.textAlign = alignments[column];
        appendInline(cell, label.trim());
        headerRow.append(cell);
      });
      thead.append(headerRow);
      table.append(thead);
      index += 2;
      const tbody = document.createElement("tbody");
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        const values = parseTableRow(lines[index++]);
        const row = document.createElement("tr");
        headers.forEach((_, column) => {
          const cell = document.createElement("td");
          if (alignments[column]) cell.style.textAlign = alignments[column];
          appendInline(cell, (values[column] || "").trim());
          row.append(cell);
        });
        tbody.append(row);
      }
      table.append(tbody);
      const wrapper = document.createElement("div");
      wrapper.className = "markdown-table-wrapper";
      wrapper.append(table);
      preview.append(wrapper);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const node = document.createElement(`h${heading[1].length}`);
      node.id = `markdown-heading-${index}`;
      appendInline(node, heading[2]); preview.append(node); index++; continue;
    }
    if (/^[-*_]{3,}\s*$/.test(line)) { preview.append(document.createElement("hr")); index++; continue; }
    if (/^>\s?/.test(line)) {
      const quote = document.createElement("blockquote");
      while (index < lines.length && /^>\s?/.test(lines[index])) appendInline(quote, lines[index++].replace(/^>\s?/, ""));
      preview.append(quote); continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const list = document.createElement(ordered ? "ol" : "ul");
      const pattern = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/;
      while (index < lines.length && pattern.test(lines[index])) {
        const item = document.createElement("li"); appendInline(item, lines[index++].replace(pattern, "")); list.append(item);
      }
      preview.append(list); continue;
    }
    const paragraph = document.createElement("p");
    const paragraphLines = [line]; index++;
    while (index < lines.length && lines[index].trim() && !/^( {0,3}(?:`{3,}|~{3,})|#{1,6}\s|>|\s*[-*+]\s|\s*\d+\.\s|[-*_]{3,}\s*$)/.test(lines[index])) paragraphLines.push(lines[index++]);
    appendInline(paragraph, paragraphLines.join(" ")); preview.append(paragraph);
  }
}

function parseTableRow(line) {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, "|").trim());
}

function isTableDelimiter(line) {
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function appendPowerShellCode(parent, source) {
  const token = /(#.*$|'(?:''|[^'])*'|\$[\w:]+|\b(?:Set-Clipboard|Get-Clipboard)\b|\b\d+\b)/gim;
  let offset = 0;
  for (const match of source.matchAll(token)) {
    parent.append(document.createTextNode(source.slice(offset, match.index)));
    const span = document.createElement("span");
    span.className = match[0].startsWith("#") ? "token-comment"
      : match[0].startsWith("'") ? "token-string"
        : match[0].startsWith("$") ? "token-variable"
          : /^\d+$/.test(match[0]) ? "token-number" : "token-command";
    span.textContent = match[0];
    parent.append(span);
    offset = match.index + match[0].length;
  }
  parent.append(document.createTextNode(source.slice(offset)));
}

function initializeMarkdownOutline() {
  if (markdownOutlineInitialized) return;
  markdownOutlineInitialized = true;
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("sidebar-toggle");
  const pagesTab = document.getElementById("sidebar-tab-pages");
  const outlineTab = document.getElementById("sidebar-tab-outline");
  const pagesPanel = document.getElementById("sidebar-pages");
  const outlinePanel = document.getElementById("sidebar-outline");
  toggle.hidden = false;
  pagesTab.hidden = true;
  pagesPanel.hidden = true;
  outlinePanel.hidden = false;
  outlineTab.classList.add("is-active");
  outlineTab.setAttribute("aria-selected", "true");
  toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("sidebar-open");
    sidebar.inert = !open;
    toggle.setAttribute("aria-expanded", String(open));
  });
  renderMarkdownOutline(outlinePanel);
}

function renderMarkdownOutline(panel, headingNodes = null) {
  panel.replaceChildren();
  const headings = headingNodes
    ? headingNodes.map((node) => ({
        title: node.textContent.trim(),
        depth: Number(node.tagName.slice(1)) - 1,
        id: node.id,
      }))
    : [...editor.value.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((match) => ({
        title: match[2].replace(/\s+#+\s*$/, ""),
        depth: match[1].length - 1,
        id: `markdown-heading-${editor.value.slice(0, match.index).split("\n").length - 1}`,
      }));
  if (!headings.length) {
    const empty = document.createElement("p");
    empty.className = "sidebar-empty";
    empty.textContent = "This document has no outline.";
    panel.append(empty);
    return;
  }
  const root = { children: [] };
  const stack = [{ depth: -1, children: root.children }];
  for (const heading of headings) {
    while (stack.length > 1 && stack.at(-1).depth >= heading.depth) stack.pop();
    const item = { ...heading, children: [] };
    stack.at(-1).children.push(item);
    stack.push(item);
  }

  function buildList(items) {
    const list = document.createElement("ul");
    list.className = "sidebar-outline-list";
    for (const heading of items) {
    const item = document.createElement("li");
    item.className = "sidebar-outline-item";
    const row = document.createElement("div");
    row.className = "sidebar-outline-row";
    row.style.setProperty("--outline-depth", heading.depth);
    if (heading.children.length) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "sidebar-outline-toggle";
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", `Collapse ${heading.title}`);
      toggle.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 2 7 5 3 8"></polyline></svg>';
      toggle.addEventListener("click", () => {
        const collapsed = item.classList.toggle("is-collapsed");
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${heading.title}`);
      });
      row.append(toggle);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "sidebar-outline-spacer";
      row.append(spacer);
    }
    const link = document.createElement("button");
    link.type = "button";
    link.className = "sidebar-outline-link";
    link.textContent = heading.title;
    link.title = link.textContent;
    link.addEventListener("click", () => {
      if (!editor.hidden) {
        showPreview();
      }
      document.getElementById(heading.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    row.append(link);
    item.append(row);
    if (heading.children.length) item.append(buildList(heading.children));
    list.append(item);
    }
    return list;
  }
  panel.append(buildList(root.children));
}

function appendInline(parent, text) {
  const token = /(!?)\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)|(`[^`]+`)|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|~~(.+?)~~/g;
  let offset = 0;
  for (const match of text.matchAll(token)) {
    parent.append(document.createTextNode(text.slice(offset, match.index)));
    const [raw, image, label, url, title, inlineCode, bold, boldAlt, italic, italicAlt, strike] = match;
    if (url) {
      try {
        const safeUrl = new URL(url, "https://markdown.invalid/");
        if (["http:", "https:", "mailto:"].includes(safeUrl.protocol)) {
          if (image) { const img = document.createElement("img"); img.alt = label; img.src = url; if (title) img.title = title; parent.append(img); }
          else { const a = document.createElement("a"); a.href = url; a.textContent = label; a.rel = "noreferrer"; if (title) a.title = title; parent.append(a); }
        } else parent.append(document.createTextNode(raw));
      } catch { parent.append(document.createTextNode(raw)); }
    } else if (inlineCode) { const code = document.createElement("code"); code.textContent = inlineCode.slice(1, -1); parent.append(code); }
    else if (bold || boldAlt) { const strong = document.createElement("strong"); strong.textContent = bold || boldAlt; parent.append(strong); }
    else if (italic || italicAlt) { const em = document.createElement("em"); em.textContent = italic || italicAlt; parent.append(em); }
    else { const del = document.createElement("del"); del.textContent = strike; parent.append(del); }
    offset = match.index + raw.length;
  }
  parent.append(document.createTextNode(text.slice(offset)));
}
