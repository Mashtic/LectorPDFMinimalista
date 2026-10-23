const { ipcMain } = require("electron");
const {
  pickSignatureImage,
  insertSignatureImage,
  cancelSignatureImage,
} = require("../services/signature-image-service.js");

function registerSignatureImageIpc() {
  ipcMain.handle("signature:pickImage", async () => {
    try {
      const result = await pickSignatureImage();

      if (!result) {
        return { ok: false, code: "CANCELLED" };
      }

      return { ok: true, ...result };
    } catch (error) {
      console.error("Could not read the signature image:", error.message);
      return { ok: false, code: error.code || "INSERT_ERROR" };
    }
  });

  ipcMain.handle("signature:insertImage", async (_event, options) => {
    try {
      return { ok: true, ...(await insertSignatureImage(options)) };
    } catch (error) {
      console.error("Could not insert the signature image:", error.message);
      return { ok: false, code: error.code || "INSERT_ERROR" };
    }
  });

  ipcMain.handle("signature:cancelImage", () => {
    cancelSignatureImage();
    return true;
  });
}

module.exports = { registerSignatureImageIpc };