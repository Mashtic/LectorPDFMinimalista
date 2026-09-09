var pdfBytes;

document.getElementById('OpenFileBtn').addEventListener('click', async () => {
  const result = await window.electronAPI.openFile();
  if (result) {
    pdfBytes = result.content;
  }
});

document
  .getElementById('DeletePagesBtn')
  .addEventListener('click', async () => {
    //TODO: choose what pages to delete
    const result = await window.electronAPI.deletePages(pdfBytes, [0]);
    if (result) {
      pdfBytes = result;
    }
  });
