const { Menu } = require("electron");

const { getGlobalVar } = require("../services/global-var-service.js");
const {
  openPresentationWindow,
} = require("../services/presentation-mode-service.js");

function notImplementedYet() {
  console.log("Function not implemented yet");
}

function showContextMenu(window, selectionText = "") {
  const template = [
    {
      label: "Open New File",
      click: () => {
        window.webContents.send("dialog:openPdfDialog");
      },
    },
  ];

  if (getGlobalVar("currentPDF")) {
    template.push({
      label: "Comments",
      click: () => {
        window.webContents.send("comments:open", "");
      },
    });
    if (selectionText) {
      template.push({
        label: "Comment selection",
        click: () => {
          window.webContents.send("comments:open", selectionText);
        },
      });
    }
    template.push(
      {
        label: "Highlight Selection",
        click: () => {
          window.webContents.send("addHighlight");
        },
      },
      {
        label: "Save As",
        click: () => {
          window.webContents.send("dialog:openSaveFileDialog");
        },
      },
      {
        label: "Save",
        click: () => {
          window.webContents.send("dialog:openSaveCurrentPdfDialog");
        },
      },
      {
        label: "Append File",
        click: () => {
          window.webContents.send("dialog:openAppendDialog");
        },
      },
      {
        label: "Merge Files",
        click: notImplementedYet,
      },
      {
        label: "Insert Signature Image",
        click: () => {
          window.webContents.send("signature:openImagePicker");
        },
      },
      {
        label: "Sign Document",
        click: () => {
          window.webContents.send("sign:openSignModal");
        },
      },
      {
        label: "Open in Presentation Mode",
        click: () => {
          openPresentationWindow();
        },
      },
    );
  }

  template.push({
    label: "Close Application",
    click: () => {
      window.close();
    },
  });

  const menu = Menu.buildFromTemplate(template);

  menu.popup({
    window,
  });
}

module.exports = {
  showContextMenu,
};
