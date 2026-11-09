const { ipcMain } = require("electron");
const {
  getAppearance,
  saveAppearance,
  chooseAppearanceImage,
  clearAppearance,
} = require("../services/signature-appearance-service.js");

function registerSignatureAppearanceIpc() {
  ipcMain.handle("appearance:get", () => getAppearance());

  ipcMain.handle("appearance:save", (_event, values) => saveAppearance(values));

  ipcMain.handle("appearance:chooseImage", async () => {
    try {
      const appearance = await chooseAppearanceImage();

      if (!appearance) {
        return { ok: false, code: "CANCELLED" };
      }

      return { ok: true, ...appearance };
    } catch (error) {
      console.error("Could not read the signature image:", error.message);
      return { ok: false, code: error.code || "SAVE_ERROR" };
    }
  });

  ipcMain.handle("appearance:clear", () => clearAppearance());
}

module.exports = { registerSignatureAppearanceIpc };
