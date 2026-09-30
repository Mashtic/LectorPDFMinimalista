const { ipcMain } = require("electron");
const {getGlobalVar, setGlobalVar} = require("../services/global-var-service.js");

function registerGlobalVarIpc() {
  ipcMain.handle("global-var:set", (_event, key, value) => {
    return setGlobalVar(key, value)
  });
  ipcMain.handle("global-var:get", (_event, key) => {
    return getGlobalVar(key)
  });
}

module.exports = {
  registerGlobalVarIpc,
};
