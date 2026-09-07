document.getElementById('OpenFileBtn').addEventListener('click', async () => {
    const result = await window.electronAPI.openFile()
    if (result) {
        console.log('Path:', result.path)
        console.log('Content:', result.content)
    }
})
