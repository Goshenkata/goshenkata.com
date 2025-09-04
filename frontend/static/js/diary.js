/** Diary page client logic with date-grouped rendering */
(function(){
  let page = 0;               // current page index
  const size = 10;            // page size
  let loading = false;        // loading flag
  let done = false;           // no more pages

  const root = document.getElementById('diary-root');
  if(!root) return;
  const entriesEl = document.getElementById('entries');
  const loadingEl = document.getElementById('loading');
  const endEl = document.getElementById('endOfList');
  const backendApiUrl = root.getAttribute('data-backend-url') || '';

  // Keep created date group containers
  const dateGroups = {}; // date -> { wrapper, list }

  function getDateGroup(date) {
    if (!dateGroups[date]) {
      const wrapper = document.createElement('div');
      wrapper.className = 'date-group';
      wrapper.setAttribute('data-date', date);
      wrapper.innerHTML = `\n        <div class="date-label-wrap">\n          <div class="date-label">${date}<span class="date-count" data-count>0</span></div>\n        </div>\n        <span class="divider-fade"></span>\n        <div class="date-entries"></div>`;
      const list = wrapper.querySelector('.date-entries');
      const countEl = wrapper.querySelector('[data-count]');
      dateGroups[date] = { wrapper, list, countEl, count:0 };
      entriesEl.appendChild(wrapper);
    }
    return dateGroups[date];
  }

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
    const date = entry.date || entry.Date || entry.createdAt || 'Unknown';
  const group = getDateGroup(date);
  const col = document.createElement('div');
    const text = entry.text || entry.Text || '';
  col.innerHTML = `\n      <div class="entry-card">\n        <pre>${escapeHtml(text)}</pre>\n      </div>`;
  group.list.appendChild(col);
  group.count += 1;
  group.countEl.textContent = group.count;
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
  // Reset UI & cache for fresh load
  entriesEl.innerHTML = '';
  Object.keys(dateGroups).forEach(k => delete dateGroups[k]);
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
