// document
//   .getElementById('DeletePagesBtn')
//   .addEventListener('click', async () => {
//     //TODO: choose what pages to delete
//
//   });

//AI-generated dialog to test the feature
//TODO: remove when integrated with final UI
const modalMarkup = `
      <div class="overlay is-open" id="overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h2 id="modal-title">Rename file</h2>
          <p>Lista de páginas para borrar</p>
          <label for="filename">Lista de Páginas</label>
          <input type="text" id="deleted-pages" value="">
          <div class="modal-actions">
            <button class="btn btn-cancel" onclick="closeModal()">Cancel</button>
            <button class="btn btn-accept" onclick="acceptModal()">Aceptar</button>
          </div>
        </div>
      </div>
    `;

function openModal() {
  // Insert the modal's HTML into the page on demand
  document.body.insertAdjacentHTML('beforeend', modalMarkup);

  const overlay = document.getElementById('overlay');
  const input = document.getElementById('deleted-pages');

  input.focus();
  input.select();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', handleEscape);
}

function closeModal() {
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.remove();
  document.removeEventListener('keydown', handleEscape);
}

async function acceptModal() {
  const input = document.getElementById('deleted-pages');
  console.log('Accepted value:', input.value);
  page_arr = input.value.split(",")
  page_arr = page_arr.map(Number)
  console.log(page_arr)
  const pdf_json = sessionStorage.getItem('currentPDF');
  if (pdf_json) {
    const currentPDF = pdf_json ? new Uint8Array(JSON.parse(pdf_json)) : null;
    if (currentPDF) {
      const result = await window.electronAPI.deletePages(currentPDF, page_arr);
      if (result) {
        pdfBytes = result;
      }
    }
  }
  closeModal();
}

function handleEscape(e) {
  if (e.key === 'Escape') closeModal();
}
