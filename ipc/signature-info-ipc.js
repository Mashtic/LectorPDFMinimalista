const { ipcMain } = require("electron");
const {
  readSignatureInfo,
} = require("../services/signature-info-service.js");
const { getGlobalVar } = require("../services/global-var-service.js");

function registerSignatureInfoIpc() {
  ipcMain.handle("signature:read", () => {
    const currentPDF = getGlobalVar("currentPDF");
    if (!currentPDF) {
      return [];
    }

    try {
      return readSignatureInfo(currentPDF);
    } catch (error) {
      console.error("Could not read the document signatures:", error.message);
      return [];
    }
  });
}

module.exports = { registerSignatureInfoIpc };
