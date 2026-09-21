const {
  createPresentationWindow,
} = require("../windows/presentation-window.js");

function openPresentationWindow() {
  const window = createPresentationWindow();

  return window;
}

module.exports = {
  openPresentationWindow,
};
