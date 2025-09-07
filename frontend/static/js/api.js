// Small API client for frontend
export async function createEntry(payload) {
  const res = await fetch('/api/entry', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Create entry failed (${res.status})`);
  return res.json();
}

export async function getUploadUrl(filename, contentType) {
    console.log(`[API] Requesting presigned URL for ${filename} (${contentType})`);
    const res = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, contentType })
    });
    const data = await res.json();
    console.log(`[API] Received presigned URL for ${filename}:`, data);
    return data;
}

export async function putToS3(url, file, headers = {}) {
    console.log(`[API] Uploading file to S3: ${file.name}, url: ${url}`);
    const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: file
    });
    if (!res.ok) {
        console.error(`[API] S3 upload failed for ${file.name}:`, res.status, await res.text());
        throw new Error(`S3 upload failed for ${file.name}: ${res.status}`);
    }
    console.log(`[API] S3 upload succeeded for ${file.name}`);
    return res;
}

export async function getAccessUrl(key) {
    const res = await fetch('/api/access-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
    });
    if (!res.ok) throw new Error(`Access URL failed (${res.status})`);
    return res.json();
}

export async function deleteEntry(id) {
    const res = await fetch(`/api/entry/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error(`Delete entry failed (${res.status})`);
    return res.json();
}
