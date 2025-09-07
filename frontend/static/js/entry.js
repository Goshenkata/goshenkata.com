import { getAccessUrl } from '/js/api.js';

(function(){
  const root = document.getElementById('entry-root');
  if (!root) return;
  const entry = JSON.parse(root.getAttribute('data-entry') || 'null');
  const media = document.getElementById('media');
  if (!entry) return;

  const images = Array.isArray(entry.images) ? entry.images : [];
  const videos = Array.isArray(entry.videos) ? entry.videos : [];

  const grid = document.createElement('div');
  grid.className = 'thumb-grid';
  media.appendChild(grid);

  async function addImage(key){
    try {
      const { url } = await getAccessUrl(key);
      const card = document.createElement('div');
      card.className = 'thumb-card';
      const img = document.createElement('img');
      img.className = 'thumb-img';
      img.src = url;
      img.alt = key;
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
      card.appendChild(video);
      grid.appendChild(card);
    } catch (e) { console.error('video load failed', key, e); }
  }

  Promise.all([
    ...images.map(addImage),
    ...videos.map(addVideo)
  ]);
})();
