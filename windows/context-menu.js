const { Menu } = require("electron");

const { getGlobalVar } = require("../services/global-var-service.js");
const {
  openPresentationWindow,
} = require("../services/presentation-mode-service.js");

function notImplementedYet() {
  console.log("Function not implemented yet");
}

function showContextMenu(window) {
  const template = [
    {
      label: "Open New File",
      click: () => {
        window.webContents.send("dialog:openPdfDialog");
      },
    },
  ];

  if (getGlobalVar("currentPDF")) {
    template.push(
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
        label: "Delete Pages",
        click: () => {
          window.webContents.send("pdfMod:openDeletePagesModal");
        },
      },
      {
        label: "Concatenate Files",
        click: notImplementedYet,
      },
      {
        label: "Merge Files",
        click: notImplementedYet,
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
