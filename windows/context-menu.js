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
      label: "Open PDF",
      click: () => {
        window.webContents.send("dialog:openPdfDialog");
      },
    },
    {
      label: "Open Markdown File",
      click: () => window.webContents.send("markdown:openDialog"),
    },
    {
      label: "Preview Markdown Folder as PDF",
      click: () => window.webContents.send("markdown:folderDialog"),
    },
  ];

  if (getGlobalVar("markdownFolderPreviewActive")) {
    template.push({
      label: "Save Folder Preview as PDF…",
      click: () => window.webContents.send("markdown:folderSaveDialog"),
    }, {
      label: "Close Folder Preview",
      click: () => window.webContents.send("markdown:folderCancelDialog"),
    });
  }

  if (getGlobalVar("currentPDF")) {
    template.push({
      label: "Comments",
      click: () => {
        window.webContents.send("comments:open", "");
      },
    });
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
        label: "Append File",
        click: () => {
          window.webContents.send("dialog:openAppendDialog");
        },
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

  if (typeof getGlobalVar("currentMarkdown") === "string") {
    template.push(
      {
        label: "Edit Markdown",
        click: () => window.webContents.send("markdown:edit"),
      },
      {
        label: "Preview Markdown",
        click: () => window.webContents.send("markdown:preview"),
      },
      {
        label: "Save As",
        click: () => window.webContents.send("markdown:saveAsDialog"),
      },
      {
        label: "Save",
        click: () => window.webContents.send("markdown:saveDialog"),
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
