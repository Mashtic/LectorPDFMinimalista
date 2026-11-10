const globalVars = {
  pdfPath: null,
  currentPDF: null,
  currentPage: 1,
  markdownPath: null,
  currentMarkdown: null,
  markdownFolderPreviewActive: false,
};

function getGlobalVar(key) {
  return globalVars[key];
}

function setGlobalVar(key, value) {
  if (globalVars[key] === undefined) {
    throw `Error: Setting non-existing global variable:${key}`;
  }

  globalVars[key] = value;
}

module.exports = { getGlobalVar, setGlobalVar };
