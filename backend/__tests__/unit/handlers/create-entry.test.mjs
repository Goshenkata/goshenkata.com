

import { mockClient } from 'aws-sdk-client-mock';
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { jest } from '@jest/globals';

let createEntryHandler;
let ddbMock;

beforeAll(async () => {
    // Mock DynamoDBDocumentClient before importing the handler
    ddbMock = mockClient(DynamoDBDocumentClient);
    ({ createEntryHandler } = await import('../../../src/handlers/create-entry.mjs'));
    process.env.ALLOWED_USER_EMAIL = 'goshenkataklev@gmail.com';
    process.env.DIARY_TABLE = 'DiaryTable';
});

describe('createEntryHandler', () => {
    beforeEach(() => {
        ddbMock.reset();
    });

    it('should return 403 if user is not authorized', async () => {
        // Pass a different email to simulate unauthorized user
        const event = {
            httpMethod: 'POST',
            body: '{}',
            requestContext: { authorizer: { claims: { sub: 'test-user-id', email: 'notyou@example.com' } } }
        };
        const result = await createEntryHandler(event);
        expect(result.statusCode).toBe(403);
    });

    it('should return 405 if not POST', async () => {
        const event = {
            httpMethod: 'GET',
            body: '{}',
            requestContext: { authorizer: { claims: { sub: 'test-user-id', email: 'goshenkataklev@gmail.com' } } }
        };
        const result = await createEntryHandler(event);
        expect(result.statusCode).toBe(405);
    });

    it('should return 400 for invalid JSON', async () => {
        const event = {
            httpMethod: 'POST',
            body: '{invalid}',
            requestContext: { authorizer: { claims: { sub: 'test-user-id', email: 'goshenkataklev@gmail.com' } } }
        };
        const result = await createEntryHandler(event);
        expect(result.statusCode).toBe(400);
    });

    it('should return 400 for missing required fields', async () => {
        const event = {
            httpMethod: 'POST',
            body: '{}',
            requestContext: { authorizer: { claims: { sub: 'test-user-id', email: 'goshenkataklev@gmail.com' } } }
        };
        const result = await createEntryHandler(event);
        expect(result.statusCode).toBe(400);
    });

    it('should return 201 and create entry', async () => {
        ddbMock.on(PutCommand).resolves({});
        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({ date: '2026-08-31', text: 'My diary entry', images: [], videos: [] }),
            requestContext: { authorizer: { claims: { sub: 'test-user-id', email: 'goshenkataklev@gmail.com' } } }
        };
        const result = await createEntryHandler(event);
        expect(result.statusCode).toBe(201);
        expect(JSON.parse(result.body).message).toBe('Entry created');
    });

    it('should return 500 on DynamoDB error', async () => {
        ddbMock.on(PutCommand).rejects(new Error('DDB error'));
        const event = {
            httpMethod: 'POST',
            body: JSON.stringify({ date: '2026-08-31', text: 'My diary entry', images: [], videos: [] }),
            requestContext: { authorizer: { claims: { sub: 'test-user-id', email: 'goshenkataklev@gmail.com' } } }
        };
        const result = await createEntryHandler(event);
        expect(result.statusCode).toBe(500);
    });
});
