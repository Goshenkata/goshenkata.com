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
        return { statusCode: 405, body: JSON.stringify({ message: `Only POST pls: ${event.httpMethod}` }) };
    }
    if (!bucket) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Missing UPLOAD_BUCKET env' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON' }) };
    }
    const userId = event.requestContext?.authorizer?.claims?.sub;
    const { filename, contentType } = body;
    if (!userId || !filename || !contentType) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields: userId, filename, contentType' }) };
    }
    const allowed = ['image/', 'video/'];
    if (!allowed.some((p) => contentType.startsWith(p))) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Only image/* or video/* uploads are allowed' }) };
    }

    const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);

    const now = Date.now()
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const dateStr = `${yyyy}-${mm}-${dd}`;
    const key = `${userId}/${dateStr}-${safeName}`;

    const expiresIn = 300; // 5 minutes

    try {
        const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
        const url = await getSignedUrl(s3, command, { expiresIn });
        return {
            statusCode: 200,
            body: JSON.stringify({ url, method: 'PUT', key, bucket, expiresIn, headers: { 'Content-Type': contentType } })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Failed to create upload URL', error: err.message }) };
    }
};
