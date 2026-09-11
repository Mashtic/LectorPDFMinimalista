document.getElementById('DeletePagesBtn').addEventListener('click', openModal);

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
            <button id="modal-cancel-btn" class="btn btn-cancel">Cancel</button>
            <button id="modal-accept-btn" class="btn btn-accept">Aceptar</button>
          </div>
        </div>
      </div>
    `;

function openModal() {
  // Insert the modal's HTML into the page on demand
  document.body.insertAdjacentHTML('beforeend', modalMarkup);

  document
    .getElementById('modal-accept-btn')
    .addEventListener('click', acceptModal);
  document
    .getElementById('modal-cancel-btn')
    .addEventListener('click', closeModal);

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
  if (!input) {
    return;
  }
  console.log('Accepted value:', input.value);

  let page_arr = input.value.split(',');
  page_arr = page_arr.map(Number);
  console.log(page_arr);

  const pdf_json = sessionStorage.getItem('currentPDF');
  if (!pdf_json) {
    return;
  }

  const currentPDF = pdf_json ? new Uint8Array(JSON.parse(pdf_json)) : null;
  if (!currentPDF) {
    return;
  }

  const result = await window.electronAPI.deletePages(currentPDF, page_arr);
  if (!result) {
    return;
  }
  console.log(result);

  sessionStorage.setItem(
    'currentPDF',
    JSON.stringify(Array.from(result)),
  );

  closeModal();
  location.reload();
}

function handleEscape(e) {
  if (e.key === 'Escape') closeModal();
}
