(function(){
  let page = 0;
  const size = 10;
  let loading = false;
  let done = false;

  const root = document.getElementById('diary-root');
  if(!root) return;
  const entriesEl = document.getElementById('entries');
  const loadingEl = document.getElementById('loading');
  const endEl = document.getElementById('endOfList');
  const backendApiUrl = root.getAttribute('data-backend-url') || '';

  async function fetchEntries() {
    if (loading || done) return;
    loading = true;
    loadingEl.classList.remove('d-none');
    try {
      const res = await fetch(`/api/entries?page=${page}&size=${size}`);
      if (!res.ok) throw new Error('Failed to load entries');
      const data = await res.json();
      const items = data.entries || [];
      if (!items.length) {
        done = true;
        endEl.classList.remove('d-none');
      } else {
        for (const entry of items) addEntryCard(entry);
        page += 1;
      }
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
      loadingEl.classList.add('d-none');
    }
  }

  function addEntryCard(entry) {
    const col = document.createElement('div');
    col.className = 'col-12';
    const date = entry.date || entry.Date || entry.createdAt || 'Unknown';
    const text = entry.text || entry.Text || '';
    col.innerHTML = `\n      <div class="p-3 rounded entry-card">\n        <div class="d-flex justify-content-between align-items-center mb-2">\n          <h5 class="mb-0">${date}</h5>\n        </div>\n        <pre class="mb-0">${escapeHtml(text)}</pre>\n      </div>`;
    entriesEl.appendChild(col);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[c]));
  }

  window.addEventListener('scroll', () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
      fetchEntries();
    }
  });

  const newEntryBtn = document.getElementById('newEntryBtn');
  const entryForm = document.getElementById('entryForm');
  const dateInput = document.getElementById('date');

  function today() {
    const d = new Date();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  if (dateInput) dateInput.value = today();

  let modal;
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof bootstrap !== 'undefined') {
      modal = new bootstrap.Modal(document.getElementById('newEntryModal'));
    }
    fetchEntries();
  });

  if (newEntryBtn) newEntryBtn.addEventListener('click', () => modal && modal.show());

  if (entryForm) entryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      date: dateInput.value,
      text: document.getElementById('text').value,
      images: [],
      videos: []
    };
    try {
      const res = await fetch('/api/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to create entry');
      entriesEl.innerHTML = '';
      page = 0; done = false; endEl.classList.add('d-none');
      if (modal) modal.hide();
      fetchEntries();
      entryForm.reset();
      dateInput.value = today();
    } catch(err) {
      console.error(err);
      alert('Error creating entry');
    }
  });
})();
