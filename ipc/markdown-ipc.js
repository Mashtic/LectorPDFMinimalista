const { ipcMain, dialog, BrowserWindow } = require("electron");
const { readFile, writeFile, readdir } = require("node:fs/promises");
const path = require("node:path");
const { getGlobalVar, setGlobalVar } = require("../services/global-var-service.js");

function registerMarkdownIpc() {
  ipcMain.handle("markdown:folder", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(owner, { properties: ["openDirectory"] });
    if (canceled || !filePaths[0]) return null;

    const root = filePaths[0];
    const files = [];
    async function collect(directory) {
      const entries = await readdir(directory, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) await collect(entryPath);
        else if (entry.isFile() && /\.(md|markdown|mdown)$/i.test(entry.name)) {
          files.push({ name: path.relative(root, entryPath).split(path.sep).join("/"), content: await readFile(entryPath, "utf8") });
        }
      }
    }
    await collect(root);
    return { folderName: path.basename(root), files };
  });

  ipcMain.handle("markdown:exportPdf", async (event, { html, title }) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath } = await dialog.showSaveDialog(owner, {
      defaultPath: `${String(title || "markdown").replace(/[\\/:*?"<>|]/g, "_")}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return null;

    const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, javascript: false } });
    try {
      const page = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title || "Markdown")}</title><style>
        @page { size: A4; margin: 0; }
        body { box-sizing:border-box; min-height:297mm; margin:0; padding:64px 76px; color:#292929; font:16px/1.65 Arial,sans-serif; }
        h1,h2,h3,h4,h5,h6 { color:#202020; font-family:Arial,sans-serif; line-height:1.3; margin:1.5em 0 .55em; break-after:avoid; }
        h1 { font-size:2em; } h2 { font-size:1.5em; }
        p { margin:0 0 1.2em; } a { color:#496d88; } blockquote { margin:1em 0; padding-left:1em; border-left:2px solid #d8d8d8; color:#777; }
        pre { white-space:pre-wrap; padding:16px; background:#f0f0f0; border-radius:5px; font:13px/1.6 ui-monospace,monospace; }
        code { padding:.12em .3em; background:#eee; border-radius:3px; font:.88em ui-monospace,monospace; } img { max-width:100%; } hr { border:0; border-top:1px solid #ddd; margin:2em 0; }
        table { border-collapse:collapse; } td,th { padding:6px 10px; border:1px solid #ddd; }
        .document-section + .document-section { break-before: page; }
      </style></head><body>${html}</body></html>`;
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
      const pdf = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: "A4" });
      await writeFile(filePath, pdf);
      return { path: filePath };
    } finally {
      printWindow.close();
    }
  });

  ipcMain.handle("markdown:open", async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(owner, {
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
    });
    if (canceled || !filePaths[0]) return null;
    const path = filePaths[0];
    const content = await readFile(path, "utf8");
    setGlobalVar("markdownFolderPreviewActive", false);
    setGlobalVar("markdownPath", path);
    setGlobalVar("currentMarkdown", content);
    setGlobalVar("currentPDF", null);
    setGlobalVar("pdfPath", null);
    return { path, content };
  });

  ipcMain.handle("markdown:save", async (_event, content) => {
    const path = getGlobalVar("markdownPath");
    if (!path) return null;
    await writeFile(path, String(content), "utf8");
    setGlobalVar("currentMarkdown", String(content));
    return { path };
  });

  ipcMain.handle("markdown:saveAs", async (event, content) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePath: selectedPath } = await dialog.showSaveDialog(owner, {
      defaultPath: getGlobalVar("markdownPath") || "document.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (canceled || !selectedPath) return null;
    const filePath = /\.(md|markdown|mdown)$/i.test(selectedPath) ? selectedPath : `${selectedPath}.md`;
    await writeFile(filePath, String(content), "utf8");
    setGlobalVar("markdownPath", filePath);
    setGlobalVar("currentMarkdown", String(content));
    return { path: filePath };
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

module.exports = { registerMarkdownIpc };
