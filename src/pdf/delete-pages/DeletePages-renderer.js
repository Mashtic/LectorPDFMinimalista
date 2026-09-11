
document
  .getElementById('DeletePagesBtn')
  .addEventListener('click', async () => {
    //TODO: choose what pages to delete
    const result = await window.electronAPI.deletePages(pdfBytes, [0]);
    if (result) {
      pdfBytes = result;
    }
  });


