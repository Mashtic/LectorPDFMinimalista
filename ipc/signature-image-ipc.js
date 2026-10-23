const { ipcMain } = require("electron");
const {
  insertSignatureImage,
} = require("../services/signature-image-service.js");

function registerSignatureImageIpc() {
  ipcMain.handle("signature:insertImage", async (_event, options) => {
    try {
      const result = await insertSignatureImage(options);

      if (!result) {
        return { ok: false, code: "CANCELLED" };
      }

      return { ok: true, ...result };
    } catch (error) {
      console.error("Could not insert the signature image:", error.message);
      return { ok: false, code: error.code || "INSERT_ERROR" };
    }
  });
}

module.exports = { registerSignatureImageIpc };
