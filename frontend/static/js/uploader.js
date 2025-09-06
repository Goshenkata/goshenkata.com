import { getUploadUrl, putToS3 } from './api.js';

export class Uploader {
    constructor(imageInput, videoInput, ui) {
        this.imageInput = imageInput;
        this.videoInput = videoInput;
        this.ui = ui;
    }

    async uploadAll() {
        const results = { images: [], videos: [] };
        try {
            const imageFiles = Array.from(this.imageInput?.files || []);
            const videoFiles = Array.from(this.videoInput?.files || []);

            // Run uploads in parallel per media type
            const imagePromises = imageFiles.map(f => this.uploadOne(f, 'image'));
            const videoPromises = videoFiles.map(f => this.uploadOne(f, 'video'));

            const [imageResults, videoResults] = await Promise.all([
                Promise.all(imagePromises),
                Promise.all(videoPromises)
            ]);

            results.images = imageResults;
            results.videos = videoResults;
            return results;
        } catch (err) {
            this.ui.warn(err.message || 'Upload failed');
            throw err;
        }
    }

    async uploadOne(file, kind) {
        const contentType = file.type || `${kind}/`;
        const { url, headers, key } = await getUploadUrl(file.name, contentType);
        this.ui.showProgress(file.name);
        await putToS3(url, file, headers);
        this.ui.markDone(file.name);
        return { key, name: file.name, type: contentType };
    }
}

export class UploadUI {
    constructor(previewContainer) {
        this.preview = previewContainer;
    }
    showProgress(name) {
        const row = document.createElement('div');
        row.className = 'upload-row d-flex align-items-center gap-2 my-1';
        row.innerHTML = `<div class="spinner-border spinner-border-sm text-primary" role="status"></div><span class="small">Uploading ${name}...</span>`;
        row.dataset.name = name;
        this.preview.appendChild(row);
    }
    markDone(name) {
        const row = this.preview.querySelector(`[data-name="${CSS.escape(name)}"]`);
        if (row) row.innerHTML = `<span class="text-success small">✔ Uploaded ${name}</span>`;
    }
    warn(msg) {
        if (window.__toast) window.__toast(msg, { title: 'Upload', variant: 'danger' });
        else alert(msg);
    }
}
