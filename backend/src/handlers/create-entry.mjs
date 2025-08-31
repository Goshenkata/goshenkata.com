import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { authorizeUser } from '../utils/authorize-user.mjs';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

/**
 * A simple example includes a HTTP post method to add one item to a DynamoDB table.
 */
export const createEntryHandler = async (event) => {
    const tableName = process.env.DIARY_TABLE;
    console.log('Received event:', JSON.stringify(event, null, 2));
    if (!authorizeUser(event)) {
        return {
            statusCode: 403,
            body: JSON.stringify({ message: "Forbidden, begone!" }),
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: `Only POST pls: ${event.httpMethod}` }),
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (err) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'JSON broke' }),
        };
    }

    // Get userId from Cognito claims
    const userId = event.requestContext?.authorizer?.claims?.sub;
    const { date, text, images = [], videos = [] } = body;
    const entryId = uuidv4();

    if (!userId || !entryId || !date) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Missing required fields: userId, entryId, date' }),
        };
    }

    var params = {
        TableName: tableName,
        Item: { userId, entryId, date, text, images, videos }
    };

    try {
        await ddbDocClient.send(new PutCommand(params));
        return {
            statusCode: 201,
            body: JSON.stringify({ message: 'Entry created', entry: params.Item }),
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Failed to create entry', error: err.message }),
        };
    }
};
