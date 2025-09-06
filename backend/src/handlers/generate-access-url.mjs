import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authorizeUser } from '../utils/authorize-user.mjs';

const s3 = new S3Client({});

// POST /access-url -> body: { key }
export const getAccessUrlHandler = async (event) => {
  const bucket = process.env.UPLOAD_BUCKET;

  if (!authorizeUser(event)) {
    return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden, begone!' }) };
  }

  if (event.httpMethod !== 'POST') {
    console.warn('[generate-access-url] Invalid method:', event.httpMethod);
    return { statusCode: 405, body: JSON.stringify({ message: `Only POST pls: ${event.httpMethod}` }) };
  }

  if (!bucket) {
    console.error('[generate-access-url] Missing UPLOAD_BUCKET env');
    return { statusCode: 500, body: JSON.stringify({ message: 'Missing UPLOAD_BUCKET env' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    console.warn('[generate-access-url] Invalid JSON body');
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON' }) };
  }

  const requesterId = event.requestContext?.authorizer?.claims?.sub;
  const key = String(body?.key || '').trim();

  if (!requesterId || !key) {
    console.warn('[generate-access-url] Missing required fields', { requesterId: !!requesterId, hasKey: !!key });
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields: userId, key' }) };
  }

  // Basic validation: ensure key has an owner segment and matches requester
  const firstSlash = key.indexOf('/');
  if (firstSlash <= 0) {
    console.warn('[generate-access-url] Invalid key format (no owner prefix)', { key });
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid key format' }) };
  }
  const ownerId = key.slice(0, firstSlash);
  if (ownerId !== requesterId) {
    console.warn('[generate-access-url] Ownership mismatch', { ownerId, requesterId });
    return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden' }) };
  }

  const expiresIn = 500; // 500 seconds

  try {
    console.log('[generate-access-url] Generating presigned GET URL', { bucket, key, expiresIn });
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(s3, command, { expiresIn });
    console.log('[generate-access-url] Presigned GET URL generated');
    return {
      statusCode: 200,
      body: JSON.stringify({ url, method: 'GET', key, bucket, expiresIn })
    };
  } catch (err) {
    console.error('[generate-access-url] Failed to create access URL', err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to create access URL', error: err.message }) };
  }
};
