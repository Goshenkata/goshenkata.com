import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authorizeUser } from '../utils/authorize-user.mjs';

const s3 = new S3Client({});

// POST /upload-url -> body: { filename, contentType }
export const getUploadUrlHandler = async (event) => {
    const bucket = process.env.UPLOAD_BUCKET;

    if (!authorizeUser(event)) {
        return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden, begone!' }) };
    }
    if (event.httpMethod !== 'POST') {
        console.warn(`[generate-upload-url] Invalid method: ${event.httpMethod}`);
        return { statusCode: 405, body: JSON.stringify({ message: `Only POST pls: ${event.httpMethod}` }) };
    }
    if (!bucket) {
        console.error(`[generate-upload-url] Missing UPLOAD_BUCKET env`);
        return { statusCode: 500, body: JSON.stringify({ message: 'Missing UPLOAD_BUCKET env' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        console.warn(`[generate-upload-url] Invalid JSON body`);
        return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON' }) };
    }
    const userId = event.requestContext?.authorizer?.claims?.sub;
    const { filename, contentType } = body;
    if (!userId || !filename || !contentType) {
        console.warn(`[generate-upload-url] Missing required fields`, { userId, filename, contentType });
        return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields: userId, filename, contentType' }) };
    }
    const allowed = ['image/', 'video/'];
    if (!allowed.some((p) => contentType.startsWith(p))) {
        console.warn(`[generate-upload-url] Disallowed contentType: ${contentType}`);
        return { statusCode: 400, body: JSON.stringify({ message: 'Only image/* or video/* uploads are allowed' }) };
    }

    const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const dateStr = `${yyyy}-${mm}-${dd}`;
    const key = `${userId}/${dateStr}-${safeName}`;

    const expiresIn = 300; // 5 minutes

    try {
        console.log(`[generate-upload-url] Generating presigned URL`, { bucket, key, contentType, expiresIn });
        const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
        const url = await getSignedUrl(s3, command, { expiresIn });
        console.log(`[generate-upload-url] Presigned URL generated`, { url });
        return {
            statusCode: 200,
            body: JSON.stringify({ url, method: 'PUT', key, bucket, expiresIn, headers: { 'Content-Type': contentType } })
        };
    } catch (err) {
        console.error(`[generate-upload-url] Failed to create upload URL`, err);
        return { statusCode: 500, body: JSON.stringify({ message: 'Failed to create upload URL', error: err.message }) };
    }
};
