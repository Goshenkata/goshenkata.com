import { getUploadUrl, putToS3 } from './api.js';

export class Uploader {
    constructor(imageInput, videoInput, ui) {
        this.imageInput = imageInput;
        this.videoInput = videoInput;
        this.ui = ui;
        this.imageFiles = [];
        this.videoFiles = [];
    }

    setFiles(imageFiles = [], videoFiles = []) {
        this.imageFiles = Array.from(imageFiles);
        this.videoFiles = Array.from(videoFiles);
    }

    async uploadAll() {
        const results = { images: [], videos: [] };
        try {
            const imageFiles = this.imageFiles.length ? this.imageFiles : Array.from(this.imageInput?.files || []);
            const videoFiles = this.videoFiles.length ? this.videoFiles : Array.from(this.videoInput?.files || []);

            // Log files to be uploaded
            console.log('[Uploader] Starting uploadAll', {
                images: imageFiles.map(f => f.name),
                videos: videoFiles.map(f => f.name)
            });

            // Run uploads in parallel per media type
            const imagePromises = imageFiles.map(f => this.uploadOne(f, 'image'));
            const videoPromises = videoFiles.map(f => this.uploadOne(f, 'video'));

            const [imageResults, videoResults] = await Promise.all([
                Promise.all(imagePromises),
                Promise.all(videoPromises)
            ]);

            results.images = imageResults;
            results.videos = videoResults;
            console.log('[Uploader] All uploads finished', results);
            return results;
        } catch (err) {
            console.error('[Uploader] Upload failed', err);
            this.ui.warn(err.message || 'Upload failed');
            throw err;
        }
    }

    async uploadOne(file, kind) {
        const contentType = file.type || `${kind}/`;
        console.log(`[Uploader] Requesting upload URL for ${file.name} (${contentType})`);
    const { url, headers, key, bucket } = await getUploadUrl(file.name, contentType);
    // Avoid logging presigned URL/headers (sensitive); log only identifiers
    console.log(`[Uploader] Uploading ${file.name} to S3`, { key, bucket, contentType });
        this.ui.showProgress(file.name, kind);
        await putToS3(url, file, headers);
        this.ui.markDone(file.name, kind);
    console.log(`[Uploader] Uploaded ${file.name} successfully`, { key, bucket });
    // Only return the key; caller will send keys to backend
    return { key };
    }
}

export class UploadUI {
    constructor(previewContainer) {
        this.preview = previewContainer;
    }
    clearSelected() { this.preview.innerHTML = ''; }
    addSelected(file, kind) {
        const card = document.createElement('div');
        card.className = 'thumb-card';
        card.dataset.name = file.name;
        if ((kind || file.type).startsWith('image')) {
            const img = document.createElement('img');
            img.className = 'thumb-img';
            const url = URL.createObjectURL(file);
            img.src = url;
            img.onload = () => URL.revokeObjectURL(url);
            card.appendChild(img);
        } else {
            const vid = document.createElement('video');
            vid.className = 'thumb-video';
            vid.muted = true; vid.playsInline = true; vid.preload = 'metadata';
            const url = URL.createObjectURL(file);
            vid.src = url;
            vid.onloadeddata = () => { vid.pause(); URL.revokeObjectURL(url); };
            card.appendChild(vid);
        }
        const cap = document.createElement('div');
        cap.className = 'thumb-cap small text-truncate';
        cap.title = file.name;
        cap.textContent = file.name;
        card.appendChild(cap);
        this.preview.appendChild(card);
    }
    showProgress(name) {
        const card = this.preview.querySelector(`[data-name="${CSS.escape(name)}"]`);
        if (!card) return;
        let overlay = card.querySelector('.thumb-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'thumb-overlay';
            overlay.innerHTML = '<div class="spinner-border spinner-border-sm text-light" role="status"></div>';
            card.appendChild(overlay);
        }
    }
    markDone(name) {
        const card = this.preview.querySelector(`[data-name="${CSS.escape(name)}"]`);
        if (!card) return;
        let overlay = card.querySelector('.thumb-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'thumb-overlay';
            card.appendChild(overlay);
        }
        overlay.innerHTML = '<span class="badge bg-success">Uploaded</span>';
        setTimeout(() => overlay.remove(), 1200);
    }
    warn(msg) {
        if (window.__toast) window.__toast(msg, { title: 'Upload', variant: 'danger' });
        else alert(msg);
    }
}
