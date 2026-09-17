import { openFile } from "./open-file/open-file.js";
import { openDeletePagesModal } from "./delete-pages/delete-pages-renderer.js";

document.getElementById("OpenFileBtn").addEventListener("click", openFile)

document.getElementById('DeletePagesBtn').addEventListener('click', openDeletePagesModal);
