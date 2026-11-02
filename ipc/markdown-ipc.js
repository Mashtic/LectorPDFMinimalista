const { ipcMain, dialog } = require("electron");
const { readFile, writeFile } = require("node:fs/promises");
const { getGlobalVar, setGlobalVar } = require("../services/global-var-service.js");

function registerMarkdownIpc() {
  ipcMain.handle("markdown:open", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown"] }],
    });
    if (canceled || !filePaths[0]) return null;
    const path = filePaths[0];
    const content = await readFile(path, "utf8");
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

  ipcMain.handle("markdown:saveAs", async (_event, content) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: getGlobalVar("markdownPath") || "document.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (canceled || !filePath) return null;
    await writeFile(filePath, String(content), "utf8");
    setGlobalVar("markdownPath", filePath);
    setGlobalVar("currentMarkdown", String(content));
    return { path: filePath };
  });
}

module.exports = { registerMarkdownIpc };
