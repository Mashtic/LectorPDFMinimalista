const DEBOUNCE_MS = 250;

export function initializeSearchBar(searchController) {
  const bar = document.getElementById("pdf-search-bar");
  const input = document.getElementById("pdf-search-input");
  const count = document.getElementById("pdf-search-count");

  let debounceTimer;

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openBar();
    } else if (event.key === "Escape" && bar.style.display !== "none") {
      closeBar();
    }
  });

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, DEBOUNCE_MS);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.shiftKey ? searchController.previousMatch() : searchController.nextMatch();
    updateCount();
  });

  document.getElementById("pdf-search-next-btn").addEventListener("click", async () => {
    await searchController.nextMatch();
    updateCount();
  });

  document.getElementById("pdf-search-prev-btn").addEventListener("click", async () => {
    await searchController.previousMatch();
    updateCount();
  });

  document.getElementById("pdf-search-close-btn").addEventListener("click", closeBar);

  function openBar() {
    bar.style.display = "flex";
    input.focus();
    input.select();
    if (input.value) runSearch();
  }

  function closeBar() {
    bar.style.display = "none";
    searchController.clear();
    updateCount();
  }

  async function runSearch() {
    await searchController.search(input.value);
    updateCount();
  }

  function updateCount() {
    const { matches, activeIndex } = searchController.state;
    count.textContent = matches.length ? `${activeIndex + 1}/${matches.length}` : "0/0";
  }
}
