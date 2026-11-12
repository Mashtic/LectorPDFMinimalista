const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
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

  showContextMenu: () => ipcRenderer.send("context-menu:show"),

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

  signDocument: (pin, options) =>
    ipcRenderer.invoke("sign:document", pin, options),
  keepSignatureWithoutTimestamp: () =>
    ipcRenderer.invoke("sign:keepWithoutTimestamp"),
  discardSignatureWithoutTimestamp: () =>
    ipcRenderer.invoke("sign:discardWithoutTimestamp"),
  readSignatureInfo: () => ipcRenderer.invoke("signature:read"),
  getSignatureAppearance: () => ipcRenderer.invoke("appearance:get"),
  saveSignatureAppearance: (values) =>
    ipcRenderer.invoke("appearance:save", values),
  chooseSignatureAppearanceImage: () =>
    ipcRenderer.invoke("appearance:chooseImage"),
  clearSignatureAppearance: () => ipcRenderer.invoke("appearance:clear"),
  onOpenSignatureAppearance: (callback) => {
    ipcRenderer.on("signature:openAppearance", callback);
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
  onStartTextBox: (callback) => {
    ipcRenderer.on("text-box:start", callback);
  },
  addPdfComment: (comment) => ipcRenderer.invoke("pdf:addComment", comment),
  setHighlightComment: (data) =>
    ipcRenderer.invoke("set-highlight-comment", data),
  deleteHighlight: (data) => ipcRenderer.invoke("delete-highlight", data),
  setAnnotationBase: (bytes) =>
    ipcRenderer.invoke("pdf:setAnnotationBase", bytes),
  applyAnnotationOps: (ops) =>
    ipcRenderer.invoke("pdf:applyAnnotationOps", ops),

  setTextInputFocus: (focused) => ipcRenderer.send("text-input-focus", focused),

  onFlushPdf: (cb) =>
    ipcRenderer.on("flush-pdf", (_e, requestId) => cb(requestId)),
  respondFlushPdf: (requestId) =>
    ipcRenderer.send("flush-pdf-response", requestId),
  onPdfSaved: (cb) => ipcRenderer.on("pdf-saved", () => cb()),

  onCheckUnsavedChanges: (cb) =>
    ipcRenderer.on("check-unsaved-changes", (_e, requestId) => cb(requestId)),
  respondUnsavedChanges: (requestId, ok) =>
    ipcRenderer.send("unsaved-changes-response", requestId, ok),
});
