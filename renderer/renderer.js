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

//debug
// console.log(await window.electronAPI.getGlobalVar("currentPDF"))
// window.electronAPI.setGlobalVar("currentPDF", "hola")
// console.log(await window.electronAPI.getGlobalVar("currentPDF"))

