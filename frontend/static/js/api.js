// Small API client for frontend
export async function createEntry(payload) {
  const res = await fetch('/api/entry', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Create entry failed (${res.status})`);
  return res.json();
}

export async function getUploadUrl(filename, contentType) {
  const res = await fetch('/api/upload-url', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename, contentType })
  });
  if (!res.ok) throw new Error(`Get upload URL failed (${res.status})`);
  return res.json();
}

export async function putToS3(url, file, headers) {
  const res = await fetch(url, { method: 'PUT', headers, body: file });
  if (!res.ok) throw new Error(`S3 upload failed (${res.status})`);
  return true;
}
