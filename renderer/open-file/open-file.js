export async function openFile() {
  await displayDocument(await window.electronAPI.openFile());
}

export async function openDocument() {
  await displayDocument(await window.electronAPI.openDocument());
}

async function displayDocument(file) {
  if (!file) return;

  const isMarkdown = file.type === "markdown";
  await window.electronAPI.setGlobalVar("markdownFolderPreviewActive", false);
  await window.electronAPI.setGlobalVar("markdownPath", isMarkdown ? file.path : null);
  await window.electronAPI.setGlobalVar("currentMarkdown", isMarkdown ? file.content : null);
  await window.electronAPI.setGlobalVar("pdfPath", isMarkdown ? null : file.path);
  await window.electronAPI.setGlobalVar("suggestedSavePath", file.suggestedSavePath ?? null);
  await window.electronAPI.setGlobalVar("currentPDF", isMarkdown ? null : file.content);
  window.location.reload();
}

export async function appendPdf() {
  if (await window.electronAPI.appendPdf()) {
    window.location.reload();
  }
}

export async function openPdfFromFile(file) {
  if (!file || !isPdf(file)) return false;

  const content = new Uint8Array(await file.arrayBuffer());
  const currentPDF = await window.electronAPI.getGlobalVar("currentPDF");

  if (currentPDF) {
    await window.electronAPI.appendPdfContent(content);
    window.location.reload();
    return true;
  }

  await window.electronAPI.setGlobalVar("pdfPath", null);
  await window.electronAPI.setGlobalVar("suggestedSavePath", null);
  await window.electronAPI.setGlobalVar("markdownFolderPreviewActive", false);
  await window.electronAPI.setGlobalVar("currentPDF", content);
  await window.electronAPI.setGlobalVar("markdownPath", null);
  await window.electronAPI.setGlobalVar("currentMarkdown", null);
  window.location.reload();
  return true;
}

function isPdf(file) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
}
