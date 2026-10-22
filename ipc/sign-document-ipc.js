const { ipcMain } = require("electron");
const { signCurrentPdfWithCard } = require("../services/pdf-sign-service.js");

function registerSignDocumentIpc() {
  ipcMain.handle("sign:document", async (_event, pin) => {
    try {
      const result = await signCurrentPdfWithCard(pin);
      return { ok: true, ...result };
    } catch (error) {
      // The PIN is never logged, only the failure code
      console.error("Document signature failed:", error.code || error.message);
      return { ok: false, code: error.code || "SIGN_ERROR" };
    }
  });
}

module.exports = { registerSignDocumentIpc };
