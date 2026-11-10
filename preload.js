const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  openDocument: () => ipcRenderer.invoke("dialog:openDocument"),
  openMarkdown: () => ipcRenderer.invoke("markdown:open"),
  openMarkdownFolder: () => ipcRenderer.invoke("markdown:folder"),
  exportMarkdownPdf: (document) => ipcRenderer.invoke("markdown:exportPdf", document),
  onOpenMarkdownDialog: (callback) => ipcRenderer.on("markdown:openDialog", callback),
  onMarkdownFolderDialog: (callback) => ipcRenderer.on("markdown:folderDialog", callback),
  onMarkdownFolderSaveDialog: (callback) => ipcRenderer.on("markdown:folderSaveDialog", callback),
  onMarkdownFolderCancelDialog: (callback) => ipcRenderer.on("markdown:folderCancelDialog", callback),
  onSaveMarkdownDialog: (callback) => ipcRenderer.on("markdown:saveDialog", callback),
  onSaveMarkdownAsDialog: (callback) => ipcRenderer.on("markdown:saveAsDialog", callback),
  onEditMarkdown: (callback) => ipcRenderer.on("markdown:edit", callback),
  onPreviewMarkdown: (callback) => ipcRenderer.on("markdown:preview", callback),
  saveMarkdown: (content) => ipcRenderer.invoke("markdown:save", content),
  saveMarkdownAs: (content) => ipcRenderer.invoke("markdown:saveAs", content),
  openPdfDialog: (callback) => {
    ipcRenderer.on("dialog:openPdfDialog", callback);
  },

  saveFile: () => ipcRenderer.invoke("dialog:saveFile"),
  saveCurrentPdf: () => ipcRenderer.invoke("pdf:saveCurrent"),
  openSaveFileDialog: (callback) => {
    ipcRenderer.on("dialog:openSaveFileDialog", callback);
  },
  openSaveCurrentPdfDialog: (callback) => {
    ipcRenderer.on("dialog:openSaveCurrentPdfDialog", callback);
  },

  setFloatingMode: (isFloating, documentSize) =>
    ipcRenderer.send("set-floating-mode", isFloating, documentSize),
  onFloatingWindowSized: (callback) => {
    ipcRenderer.on("floating-window-sized", callback);
  },

  deletePages: (pages) => ipcRenderer.invoke("pdfMod:deletePages", pages),
  reorderPages: (pages) => ipcRenderer.invoke("pdfMod:reorderPages", pages),

  appendPdf: () => ipcRenderer.invoke("dialog:appendPdf"),
  appendPdfContent: (content) =>
    ipcRenderer.invoke("pdf:append-content", content),
  openAppendDialog: (callback) => {
    ipcRenderer.on("dialog:openAppendDialog", callback);
  },

  signDocument: (pin) => ipcRenderer.invoke("sign:document", pin),
  readSignatureInfo: () => ipcRenderer.invoke("signature:read"),
  pickSignatureImage: () => ipcRenderer.invoke("signature:pickImage"),
  insertSignatureImage: (options) =>
    ipcRenderer.invoke("signature:insertImage", options),
  cancelSignatureImage: () => ipcRenderer.invoke("signature:cancelImage"),
  onInsertSignatureImage: (callback) => {
    ipcRenderer.on("signature:openImagePicker", callback);
  },
  openSignModal: (callback) => {
    ipcRenderer.on("sign:openSignModal", callback);
  },

  addHighlight: (callback) => {
    ipcRenderer.on("addHighlight", callback);
  },

  setGlobalVar: (key, value) =>
    ipcRenderer.invoke("global-var:set", key, value),
  getGlobalVar: (key) => ipcRenderer.invoke("global-var:get", key),
  onOpenComments: (callback) => {
    ipcRenderer.on("comments:open", (_event, selectedText) =>
      callback(selectedText),
    );
  },
  addPdfComment: (comment) => ipcRenderer.invoke("pdf:addComment", comment),
  setHighlightComment: (data) =>
    ipcRenderer.invoke("set-highlight-comment", data),
  deleteHighlight: (data) => ipcRenderer.invoke("delete-highlight", data),
  setAnnotationBase: (bytes) =>
    ipcRenderer.invoke("pdf:setAnnotationBase", bytes),
  applyAnnotationOps: (ops) =>
    ipcRenderer.invoke("pdf:applyAnnotationOps", ops),
});
