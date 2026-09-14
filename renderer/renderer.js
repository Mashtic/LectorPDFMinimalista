document.getElementById("OpenFileBtn").addEventListener("click", async () => {
  const result = await window.electronAPI.openFile();
  if (result) {
    sessionStorage.setItem(
      "currentPDF",
      JSON.stringify(Array.from(result.content)),
    );
    window.location.reload();
  }
});
