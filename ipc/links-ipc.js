const { app, ipcMain, shell } = require("electron");

const EXTERNAL_URL = /^(https?|mailto|tel):/i;

function isExternalUrl(url) {
  if (typeof url !== "string" || !EXTERNAL_URL.test(url)) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function registerExternalLinksIpc() {
  ipcMain.handle("shell:openExternal", async (_event, url) => {
    if (!isExternalUrl(url)) return false;
    await shell.openExternal(url);
    return true;
  });

  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (isExternalUrl(url)) shell.openExternal(url);
      return { action: "deny" };
    });

    contents.on("will-navigate", (event, url) => {
      if (!EXTERNAL_URL.test(url)) return;
      event.preventDefault();
      if (isExternalUrl(url)) shell.openExternal(url);
    });
  });
}

module.exports = { registerExternalLinksIpc };
