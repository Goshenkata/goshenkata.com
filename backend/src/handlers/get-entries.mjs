import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { authorizeUser } from '../utils/authorize-user.mjs';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// GET /entries?page=0&size=10 -> Returns paginated entries for authorized user sorted by date desc
export const getEntriesHandler = async (event) => {
  const tableName = process.env.DIARY_TABLE;

  if (!authorizeUser(event)) {
    return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden, begone!' }) };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ message: `Only GET pls: ${event.httpMethod}` }) };
  }

  const userId = event.requestContext?.authorizer?.claims?.sub;
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing userId' }) };
  }

  const qs = event.queryStringParameters || {};
  let page = parseInt(qs.page, 10);
  let size = parseInt(qs.size, 10);
  if (isNaN(page) || page < 0) page = 0;
  if (isNaN(size) || size <= 0) size = 10;
  if (size > 100) size = 100; // basic safety cap

  const params = {
    TableName: tableName,
    FilterExpression: '#u = :u',
    ExpressionAttributeNames: { '#u': 'userId' },
    ExpressionAttributeValues: { ':u': userId }
  };

  try {
    const data = await ddbDocClient.send(new ScanCommand(params));
    const all = (data.Items || [])
      .filter(it => it.date)
      .sort((a, b) => b.date.localeCompare(a.date)); // future to past

    const total = all.length;
    const start = page * size;
    const paged = start >= total ? [] : all.slice(start, start + size);

    return { statusCode: 200, body: JSON.stringify({ entries: paged, page, size, total }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to get entries', error: err.message }) };
  }
};
