// Modal shown when the user tries to close the app (or open another PDF)
// while the current document has changes that were not saved.
//
// showUnsavedChangesDialog() resolves with "save" | "discard" | "cancel".

const STYLE_ID = "unsaved-changes-style";

const CSS = `
#unsaved-changes-overlay {
  position: fixed; inset: 0; z-index: 10000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}
#unsaved-changes-dialog {
  width: min(420px, calc(100vw - 32px));
  padding: 20px 22px 16px;
  border-radius: 10px;
  background: var(--dialog-bg, #fff);
  color: var(--dialog-fg, #1f1f1f);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  font: 14px/1.45 system-ui, sans-serif;
}
#unsaved-changes-dialog h2 { margin: 0 0 8px; font-size: 16px; }
#unsaved-changes-dialog p { margin: 0 0 18px; opacity: 0.85; }
#unsaved-changes-actions {
  display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px;
}
#unsaved-changes-actions button {
  padding: 7px 14px; border-radius: 6px; cursor: pointer;
  border: 1px solid rgba(128, 128, 128, 0.5);
  background: transparent; color: inherit; font: inherit;
}
#unsaved-changes-actions button:hover { background: rgba(128, 128, 128, 0.15); }
#unsaved-changes-actions button:focus-visible { outline: 2px solid #4c8bf5; outline-offset: 2px; }
#unsaved-changes-actions .primary {
  background: #2f6fed; border-color: #2f6fed; color: #fff;
}
#unsaved-changes-actions .primary:hover { background: #2559c4; }
#unsaved-changes-actions .danger { color: #d93025; border-color: #d93025; }
`;

let openDialog = null; // shared promise so two requests never stack dialogs

export function showUnsavedChangesDialog() {
  if (openDialog) return openDialog;

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const previouslyFocused = document.activeElement;

  openDialog = new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "unsaved-changes-overlay";

    const dialog = document.createElement("div");
    dialog.id = "unsaved-changes-dialog";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "unsaved-changes-title");
    dialog.setAttribute("aria-describedby", "unsaved-changes-text");

    const title = document.createElement("h2");
    title.id = "unsaved-changes-title";
    title.textContent = "Unsaved changes";

    const text = document.createElement("p");
    text.id = "unsaved-changes-text";
    text.textContent =
      "You have made changes to this PDF that haven't been saved. " +
      "Do you want to save them first?";

    const actions = document.createElement("div");
    actions.id = "unsaved-changes-actions";

    const makeButton = (label, choice, className = "") => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (className) button.className = className;
      button.addEventListener("click", () => finish(choice));
      return button;
    };

    const cancelButton = makeButton("Cancel", "cancel");
    const discardButton = makeButton("Close anyway", "discard", "danger");
    const saveButton = makeButton("Save changes", "save", "primary");
    actions.append(cancelButton, discardButton, saveButton);

    dialog.append(title, text, actions);
    overlay.appendChild(dialog);

    const buttons = [cancelButton, discardButton, saveButton];

    const onKeyDown = (event) => {
      // Capture phase + stopPropagation so viewer shortcuts (j/k/c...) stay quiet
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        finish("cancel");
      } else if (event.key === "Tab") {
        // Keep focus trapped inside the dialog
        const index = buttons.indexOf(document.activeElement);
        const next = event.shiftKey
          ? index <= 0
            ? buttons.length - 1
            : index - 1
          : (index + 1) % buttons.length;
        event.preventDefault();
        buttons[next].focus();
      }
    };

    function finish(choice) {
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      openDialog = null;
      previouslyFocused?.focus?.();
      resolve(choice);
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.body.appendChild(overlay);
    saveButton.focus();
  });

  return openDialog;
}
