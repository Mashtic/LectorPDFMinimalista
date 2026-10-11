const { ipcMain } = require("electron");
const {
  setHighlightComment,
  deleteHighlight,
} = require("../services/pdf-comments-service.js");

function registerCommentsIpc() {
  ipcMain.handle(
    "set-highlight-comment",
    (event, { dataPDF, pageNumber, annotationId, text }) => {
      return setHighlightComment(dataPDF, pageNumber, annotationId, text);
    },
  );

  ipcMain.handle(
    "delete-highlight",
    (event, { dataPDF, pageNumber, annotationId }) => {
      return deleteHighlight(dataPDF, pageNumber, annotationId);
    },
  );
}

module.exports = { registerCommentsIpc };
