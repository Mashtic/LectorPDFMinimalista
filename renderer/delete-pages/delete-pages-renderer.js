
const modalMarkup = `
      <div class="overlay is-open" id="overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h2 class="" id="modal-title">Delete Pages</h2>
          <label for="filename">List of pages:</label>
          <input type="text" id="deleted-pages" value="" class="delete-input">
          <div class="modal-actions">
            <button id="modal-cancel-btn" class="btn btn-cancel">Cancel</button>
            <button id="modal-accept-btn" class="btn btn-accept">Accept</button>
          </div>
        </div>
      </div>
    `;

export function openDeletePagesModal() {
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
  closeModal();

  let pageList = input.value.split(',');
  pageList = pageList.map(Number);

  if (!(await window.electronAPI.deletePages(pageList))) {
    return;
  }

  location.reload();
}

function handleEscape(e) {
  if (e.key === 'Escape') closeModal();
}
