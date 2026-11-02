export async function openFile() {
  const file = await window.electronAPI.openFile();
  if (file) {
    window.electronAPI.setGlobalVar("pdfPath", file.path);
    window.electronAPI.setGlobalVar("currentPDF", file.content);
    window.electronAPI.setGlobalVar("markdownPath", null);
    window.electronAPI.setGlobalVar("currentMarkdown", null);
    window.location.reload();
  }
}

export async function openDocument() {
  const file = await window.electronAPI.openDocument();
  if (!file) return;
  if (file.type === "markdown") {
    await window.electronAPI.setGlobalVar("markdownPath", file.path);
    await window.electronAPI.setGlobalVar("currentMarkdown", file.content);
    await window.electronAPI.setGlobalVar("pdfPath", null);
    await window.electronAPI.setGlobalVar("currentPDF", null);
  } else {
    await window.electronAPI.setGlobalVar("pdfPath", file.path);
    await window.electronAPI.setGlobalVar("currentPDF", file.content);
    await window.electronAPI.setGlobalVar("markdownPath", null);
    await window.electronAPI.setGlobalVar("currentMarkdown", null);
  }
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
  await window.electronAPI.setGlobalVar("currentPDF", content);
  await window.electronAPI.setGlobalVar("markdownPath", null);
  await window.electronAPI.setGlobalVar("currentMarkdown", null);
  window.location.reload();
  return true;
}

function isPdf(file) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
}
