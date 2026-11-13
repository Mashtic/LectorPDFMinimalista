const { ipcMain } = require("electron");
const {
  signCurrentPdfWithCard,
  applyPendingSignature,
  discardPendingSignature,
} = require("../services/pdf-sign-service.js");

function registerSignDocumentIpc() {
  ipcMain.handle("sign:document", async (_event, pin, options) => {
    try {
      const result = await signCurrentPdfWithCard(pin, options);
      return { ok: true, ...result };
    } catch (error) {
      // The PIN is never logged, only the failure code
      console.error("Document signature failed:", error.code || error.message);
      return { ok: false, code: error.code || "SIGN_ERROR" };
    }
  });

  // Answers to "the timestamp service did not respond": keep or drop the
  // signature that was already made
  ipcMain.handle("sign:keepWithoutTimestamp", () => {
    try {
      return { ok: true, ...applyPendingSignature() };
    } catch (error) {
      return { ok: false, code: error.code || "SIGN_ERROR" };
    }
  });

  ipcMain.handle("sign:discardWithoutTimestamp", () => {
    discardPendingSignature();
  });
}

module.exports = { registerSignDocumentIpc };
