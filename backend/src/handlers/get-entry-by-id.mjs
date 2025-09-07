import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { authorizeUser } from '../utils/authorize-user.mjs';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// GET /entries/{id} -> Returns a single diary entry for the authorized user
export const getEntryByIdHandler = async (event) => {
  const tableName = process.env.DIARY_TABLE;
  if (!authorizeUser(event)) {
    return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden, begone!' }) };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ message: `Only GET pls: ${event.httpMethod}` }) };
  }

  const entryId = event.pathParameters?.id || event.pathParameters?.entryId;
  if (!entryId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing entry id' }) };
  }

  const userId = event.requestContext?.authorizer?.claims?.sub;
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing userId' }) };
  }

  try {
    const res = await ddbDocClient.send(new GetCommand({ TableName: tableName, Key: { entryId } }));
    const entry = res.Item;
    if (!entry) return { statusCode: 404, body: JSON.stringify({ message: 'Entry not found' }) };
    if (entry.userId !== userId) return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: not your entry' }) };
    return { statusCode: 200, body: JSON.stringify({ entry }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to get entry', error: err.message }) };
  }
};
