import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { authorizeUser } from '../utils/authorize-user.mjs';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// GET /entry/{date} -> Returns all diary entries for the authorized user for a given date
export const getEntryHandler = async (event) => {
  const tableName = process.env.DIARY_TABLE;
  if (!authorizeUser(event)) {
    return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden, begone!' }) };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ message: `Only GET pls: ${event.httpMethod}` }) };
  }

  const date = event.pathParameters?.date;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!date || !dateRegex.test(date)) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid or missing date (expected YYYY-MM-DD)' }) };
  }

  const userId = event.requestContext?.authorizer?.claims?.sub;
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing userId' }) };
  }

  // NOTE: Table design currently uses only userId as the PK. We scan & filter by userId + date.
  // This is inefficient and would be better served by a composite key (userId + date or entryId) / GSI.
  const params = {
    TableName: tableName,
    FilterExpression: '#u = :u AND #d = :date',
    ExpressionAttributeNames: { '#u': 'userId', '#d': 'date' },
    ExpressionAttributeValues: { ':u': userId, ':date': date }
  };

  try {
    const data = await ddbDocClient.send(new ScanCommand(params));
    const entries = data.Items || [];
    return { statusCode: 200, body: JSON.stringify({ entries }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to get entries', error: err.message }) };
  }
};
