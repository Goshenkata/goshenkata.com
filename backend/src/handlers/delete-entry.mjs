import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { authorizeUser } from '../utils/authorize-user.mjs';

const ddb = new DynamoDBClient({});
const ddbDoc = DynamoDBDocumentClient.from(ddb);
const s3 = new S3Client({});

export const deleteEntryHandler = async (event) => {
  const tableName = process.env.DIARY_TABLE;
  const bucket = process.env.UPLOAD_BUCKET;
  console.log('DeleteEntry event:', JSON.stringify({ path: event.path, params: event.pathParameters }, null, 2));

  if (!authorizeUser(event)) {
    return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden, begone!' }) };
  }
  if (event.httpMethod !== 'DELETE') {
    return { statusCode: 405, body: JSON.stringify({ message: `Only DELETE pls: ${event.httpMethod}` }) };
  }

  const entryId = event.pathParameters?.id || event.pathParameters?.entryId;
  if (!entryId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing entry id' }) };
  }

  const userId = event.requestContext?.authorizer?.claims?.sub;
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing user context' }) };
  }

  // 1) Load entry to validate ownership and get attachment keys
  let item;
  try {
    const res = await ddbDoc.send(new GetCommand({ TableName: tableName, Key: { entryId } }));
    item = res.Item;
  } catch (err) {
    console.error('DDB Get error', err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to read entry', error: err.message }) };
  }
  if (!item) {
    return { statusCode: 404, body: JSON.stringify({ message: 'Entry not found' }) };
  }
  if (item.userId !== userId) {
    return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: not your entry' }) };
  }

  const images = Array.isArray(item.images) ? item.images : [];
  const videos = Array.isArray(item.videos) ? item.videos : [];
  // Only allow deleting objects owned by user (prefix check)
  const allKeys = [...images, ...videos].filter(k => typeof k === 'string' && k.startsWith(`${userId}/`));

  // 2) Delete S3 objects (if any)
  if (allKeys.length) {
    const objects = allKeys.map(Key => ({ Key }));
    try {
      const delRes = await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects, Quiet: true } }));
      const errors = (delRes.Errors || []).map(e => ({ key: e.Key, code: e.Code, msg: e.Message }));
      if (errors.length) {
        console.error('S3 delete errors:', errors);
        return { statusCode: 502, body: JSON.stringify({ message: 'Failed to delete some attachments', errors }) };
      }
    } catch (err) {
      console.error('S3 delete error', err);
      return { statusCode: 502, body: JSON.stringify({ message: 'Failed to delete attachments', error: err.message }) };
    }
  }

  // 3) Delete DynamoDB row (condition on owner)
  try {
    await ddbDoc.send(new DeleteCommand({
      TableName: tableName,
      Key: { entryId },
      ConditionExpression: '#u = :uid',
      ExpressionAttributeNames: { '#u': 'userId' },
      ExpressionAttributeValues: { ':uid': userId },
    }));
  } catch (err) {
    console.error('DDB Delete error', err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to delete entry', error: err.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ message: 'Entry deleted', entryId, deletedObjects: allKeys.length }) };
};
