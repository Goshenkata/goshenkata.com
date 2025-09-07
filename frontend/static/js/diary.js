/** Diary page client logic with date-grouped rendering and uploads */
import { createEntry, getAccessUrl, deleteEntry } from './api.js';
import { Uploader, UploadUI } from './uploader.js';

(function () {
  let page = 0;               // current page index
  const size = 10;            // page size
  let loading = false;        // loading flag
  let done = false;           // no more pages

  const root = document.getElementById('diary-root');
  if (!root) return;
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
      dateGroups[date] = { wrapper, list, countEl, count: 0 };
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
      if (window.__toast) window.__toast('Could not load entries', { title: 'Error', variant: 'danger' });
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
      const images = entry.images || entry.Images || [];
      const videos = entry.videos || entry.Videos || [];
      const entryId = entry.entryId || entry.id || Math.random().toString(36).slice(2);
      const gridId = `thumbs-${entryId}`;
      const gridVidId = `vids-${entryId}`;
      col.innerHTML = `
        <div class="entry-card" data-entry-id="${entryId}" style="cursor:pointer">
          <div class="d-flex justify-content-end mb-2">
            <button class="btn btn-sm btn-outline-danger" data-role="delete-entry" title="Delete entry">✖</button>
          </div>
          <pre class="mb-2">${escapeHtml(text)}</pre>
          ${images.length ? `<button class="btn btn-sm btn-outline-light me-2" data-toggle="thumbs" data-target="${gridId}">Show images (${images.length})</button>` : ''}
          ${videos.length ? `<button class="btn btn-sm btn-outline-light" data-toggle="vids" data-target="${gridVidId}">Show videos (${videos.length})</button>` : ''}
          <div id="${gridId}" class="thumb-grid mt-2 d-none"></div>
          <div id="${gridVidId}" class="thumb-grid mt-2 d-none"></div>
        </div>`;
      // Card click -> navigate to entry page (ignore clicks on internal buttons)
      const card = col.querySelector('.entry-card');
      card.addEventListener('click', (e) => {
        const t = e.target;
        if (t.closest('button')) return; // let buttons handle their own clicks
        window.location.href = `/entry/${encodeURIComponent(entryId)}`;
      });
      // Hook delete button
      const delBtn = col.querySelector('[data-role="delete-entry"]');
      if (delBtn && entryId) {
        delBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          const ok = window.confirm('Delete this entry? Attached files will also be removed.');
          if (!ok) return;
          delBtn.disabled = true;
          try {
            await deleteEntry(entryId);
            // Remove from DOM and update counts
            if (col.parentElement) {
              group.list.removeChild(col);
              group.count = Math.max(0, group.count - 1);
              group.countEl.textContent = group.count;
              // If group empty, remove wrapper
              if (group.count === 0 && group.wrapper?.parentElement) {
                group.wrapper.parentElement.removeChild(group.wrapper);
                delete dateGroups[date];
              }
            }
            window.__toast && window.__toast('Entry deleted', { title: 'Diary', variant: 'success' });
          } catch (err) {
            console.error(err);
            window.__toast && window.__toast('Failed to delete entry', { title: 'Diary', variant: 'danger' });
            delBtn.disabled = false;
          }
        });
      }
      if (images.length) {
        const btn = col.querySelector('[data-toggle="thumbs"]');
        const grid = col.querySelector(`#${CSS.escape(gridId)}`);
        btn.addEventListener('click', async () => {
          const isHidden = grid.classList.contains('d-none');
          if (isHidden && !grid.dataset.loaded) {
            try {
              const urls = await Promise.all(images.map(async (key) => {
                const { url } = await getAccessUrl(key);
                return { key, url };
              }));
              grid.innerHTML = '';
              for (const { key, url } of urls) {
                const card = document.createElement('div');
                card.className = 'thumb-card';
                const img = document.createElement('img');
                img.className = 'thumb-img';
                img.src = url;
                img.alt = key;
                card.appendChild(img);
                grid.appendChild(card);
              }
              grid.dataset.loaded = '1';
            } catch (err) {
              console.error(err);
              window.__toast && window.__toast('Failed to load images', { title: 'Entry', variant: 'danger' });
            }
          }
          grid.classList.toggle('d-none');
          btn.textContent = grid.classList.contains('d-none') ? `Show images (${images.length})` : 'Hide images';
        });
      }
      if (videos.length) {
        const vbtn = col.querySelector('[data-toggle="vids"]');
        const vgrid = col.querySelector(`#${CSS.escape(gridVidId)}`);
        vbtn.addEventListener('click', async () => {
          const isHidden = vgrid.classList.contains('d-none');
          if (isHidden && !vgrid.dataset.loaded) {
            try {
              const urls = await Promise.all(videos.map(async (key) => {
                const { url } = await getAccessUrl(key);
                return { key, url };
              }));
              vgrid.innerHTML = '';
              for (const { key, url } of urls) {
                const card = document.createElement('div');
                card.className = 'thumb-card';
                const video = document.createElement('video');
                video.className = 'thumb-video';
                video.src = url;
                video.muted = true;
                video.playsInline = true;
                video.controls = true;
                card.appendChild(video);
                vgrid.appendChild(card);
              }
              vgrid.dataset.loaded = '1';
            } catch (err) {
              console.error(err);
              window.__toast && window.__toast('Failed to load videos', { title: 'Entry', variant: 'danger' });
            }
          }
          vgrid.classList.toggle('d-none');
          vbtn.textContent = vgrid.classList.contains('d-none') ? `Show videos (${videos.length})` : 'Hide videos';
        });
      }
    group.list.appendChild(col);
    group.count += 1;
    group.countEl.textContent = group.count;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[c]));
  }

  window.addEventListener('scroll', () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
      fetchEntries();
    }
  });

  const newEntryBtn = document.getElementById('newEntryBtn');
  const entryForm = document.getElementById('entryForm');
  const dateInput = document.getElementById('date');
  const imagesInput = document.getElementById('images');
  const videosInput = document.getElementById('videos');
  const imagesPreview = document.getElementById('imagesPreview');
  const videosPreview = document.getElementById('videosPreview');
  const imagesUI = new UploadUI(imagesPreview);
  const videosUI = new UploadUI(videosPreview);
  let selectedImages = [];
  let selectedVideos = [];
  // Render thumbnails on selection
  function renderAllThumbs() {
    imagesUI.clearSelected?.();
    videosUI.clearSelected?.();
    selectedImages.forEach(f => imagesUI.addSelected?.(f, 'image'));
    selectedVideos.forEach(f => videosUI.addSelected?.(f, 'video'));
  }
  imagesInput?.addEventListener('change', () => {
    const files = Array.from(imagesInput.files || []);
    selectedImages = selectedImages.concat(files);
    renderAllThumbs();
  });
  videosInput?.addEventListener('change', () => {
    const files = Array.from(videosInput.files || []);
    selectedVideos = selectedVideos.concat(files);
    renderAllThumbs();
  });
  const uploader = new Uploader(imagesInput, videosInput, {
    showProgress: (name) => { imagesUI.showProgress(name); },
    markDone: (name) => { imagesUI.markDone(name); videosUI.markDone(name); },
  warn: (msg) => { if (window.__toast) window.__toast(msg, { title: 'Upload', variant: 'danger' }); else alert(msg); }
  });

  function today() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
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
    try {
      // Disable submit button during requests
      const submitBtn = entryForm.querySelector('button[type="submit"]');
      submitBtn && (submitBtn.disabled = true);
  // 1) Upload files first and gather S3 object KEYS
  uploader.setFiles(selectedImages, selectedVideos);
  const results = await uploader.uploadAll();
  const imageKeys = (results.images || []).map(i => i.key).filter(Boolean);
  const videoKeys = (results.videos || []).map(v => v.key).filter(Boolean);
  console.log('[Diary] Uploads complete, creating entry with KEYS', { imageCount: imageKeys.length, videoCount: videoKeys.length });

      // 2) Create entry with uploaded URLs
      const payload = {
        date: dateInput.value,
        text: document.getElementById('text').value,
        images: imageKeys,
        videos: videoKeys
      };
      const created = await createEntry(payload);
      console.log('[Diary] Entry created', created);

      // 3) Reset UI & reload entries
      entriesEl.innerHTML = '';
      Object.keys(dateGroups).forEach(k => delete dateGroups[k]);
      page = 0; done = false; endEl.classList.add('d-none');
      if (modal) modal.hide();
      fetchEntries();
      entryForm.reset();
      dateInput.value = today();
  selectedImages = [];
  selectedVideos = [];
  renderAllThumbs();
      if (window.__toast) window.__toast('Entry saved', { title: 'Diary', variant: 'success' });
    } catch (err) {
      console.error(err);
      if (window.__toast) window.__toast('Error uploading files or saving entry', { title: 'Diary', variant: 'danger' });
      else alert('Error uploading files or saving entry');
    } finally {
      const submitBtn = entryForm.querySelector('button[type="submit"]');
      submitBtn && (submitBtn.disabled = false);
    }
  });
})();
