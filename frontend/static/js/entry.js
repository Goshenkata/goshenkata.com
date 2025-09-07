import { getAccessUrl } from '/js/api.js';

(function(){
  const root = document.getElementById('entry-root');
  if (!root) return;
  const entry = JSON.parse(root.getAttribute('data-entry') || 'null');
  const media = document.getElementById('media');
  const viewer = document.getElementById('viewer');
  if (!entry) return;

  const images = Array.isArray(entry.images) ? entry.images : [];
  const videos = Array.isArray(entry.videos) ? entry.videos : [];

  const grid = document.createElement('div');
  grid.className = 'thumb-grid';
  media.appendChild(grid);

  function showInViewer(type, src, alt){
    if (!viewer) return;
    viewer.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'viewer-head';
    const title = document.createElement('div');
    title.className = 'viewer-title';
    title.textContent = type === 'image' ? 'Image preview' : 'Video preview';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-sm btn-outline-light viewer-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => viewer.classList.add('d-none'));
    head.appendChild(title);
    head.appendChild(closeBtn);
    viewer.appendChild(head);
    if (type === 'image'){
      const img = document.createElement('img');
      img.src = src; img.alt = alt || '';
      img.className = 'viewer-media';
      viewer.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.src = src; video.controls = true; video.playsInline = true;
      video.className = 'viewer-media';
      viewer.appendChild(video);
    }
    viewer.classList.remove('d-none');
    viewer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function addImage(key){
    try {
      const { url } = await getAccessUrl(key);
      const card = document.createElement('div');
      card.className = 'thumb-card';
      const img = document.createElement('img');
      img.className = 'thumb-img';
      img.src = url;
      img.alt = key;
      img.addEventListener('click', () => showInViewer('image', url, key));
      card.appendChild(img);
      grid.appendChild(card);
    } catch (e) { console.error('image load failed', key, e); }
  }

  async function addVideo(key){
    try {
      const { url } = await getAccessUrl(key);
      const card = document.createElement('div');
      card.className = 'thumb-card';
      const video = document.createElement('video');
      video.className = 'thumb-video';
      video.src = url;
      video.controls = true;
      video.playsInline = true;
      video.addEventListener('click', (e) => {
        // Avoid toggling controls in the card; show full viewer instead
        e.preventDefault();
        e.stopPropagation();
        showInViewer('video', url, key);
      });
      card.appendChild(video);
      grid.appendChild(card);
    } catch (e) { console.error('video load failed', key, e); }
  }

  Promise.all([
    ...images.map(addImage),
    ...videos.map(addVideo)
  ]);
})();
