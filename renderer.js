var pdfBytes;

document.getElementById('OpenFileBtn').addEventListener('click', async () => {
  const result = await window.electronAPI.openFile();
  if (result) {
    pdfBytes = result.content;
  }
});


