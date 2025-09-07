import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { authorizeUser } from '../utils/authorize-user.mjs';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// GET /entries?page=0&size=10&before=YYYY-MM-DD&after=YYYY-MM-DD
// Returns paginated entries for authorized user sorted by date desc with optional date range filters
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

  // Optional date filters
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  let before = typeof qs.before === 'string' && dateRe.test(qs.before) ? qs.before : undefined;
  let after = typeof qs.after === 'string' && dateRe.test(qs.after) ? qs.after : undefined;
  // If both present and inverted, swap to be forgiving
  if (before && after && after > before) { const tmp = before; before = after; after = tmp; }

  // Build Scan filter
  let FilterExpression = '#u = :u';
  const ExpressionAttributeNames = { '#u': 'userId' };
  const ExpressionAttributeValues = { ':u': userId };
  if (before) {
    FilterExpression += ' AND #d <= :before';
    ExpressionAttributeNames['#d'] = 'date';
    ExpressionAttributeValues[':before'] = before;
  }
  if (after) {
    FilterExpression += ' AND #d >= :after';
    ExpressionAttributeNames['#d'] = 'date';
    ExpressionAttributeValues[':after'] = after;
  }

  const params = { TableName: tableName, FilterExpression, ExpressionAttributeNames, ExpressionAttributeValues };

  try {
    const data = await ddbDocClient.send(new ScanCommand(params));
    const all = (data.Items || [])
      .filter(it => it.date && (!after || it.date >= after) && (!before || it.date <= before))
      .sort((a, b) => b.date.localeCompare(a.date)); // future to past

    const total = all.length;
    const start = page * size;
    const paged = start >= total ? [] : all.slice(start, start + size);

    return { statusCode: 200, body: JSON.stringify({ entries: paged, page, size, total }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to get entries', error: err.message }) };
  }
};
