import { mockClient } from 'aws-sdk-client-mock';
import { ScanCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { jest } from '@jest/globals';

let getEntryHandler;
let ddbMock;

beforeAll(async () => {
  ddbMock = mockClient(DynamoDBDocumentClient);
  ({ getEntryHandler } = await import('../../../src/handlers/get-entry.mjs'));
  process.env.ALLOWED_USER_EMAIL = 'goshenkataklev@gmail.com';
  process.env.DIARY_TABLE = 'DiaryTable';
});

describe('getEntryHandler', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('should return 403 if user is not authorized', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: { date: '2026-08-31' },
      requestContext: { authorizer: { claims: { sub: 'id', email: 'notyou@example.com' } } }
    };
    const result = await getEntryHandler(event);
    expect(result.statusCode).toBe(403);
  });

  it('should return 405 if not GET', async () => {
    const event = {
      httpMethod: 'POST',
      pathParameters: { date: '2026-08-31' },
      requestContext: { authorizer: { claims: { sub: 'id', email: 'goshenkataklev@gmail.com' } } }
    };
    const result = await getEntryHandler(event);
    expect(result.statusCode).toBe(405);
  });

  it('should return 400 for invalid date', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: { date: 'bad-date' },
      requestContext: { authorizer: { claims: { sub: 'id', email: 'goshenkataklev@gmail.com' } } }
    };
    const result = await getEntryHandler(event);
    expect(result.statusCode).toBe(400);
  });

  it('should return 200 with empty array when no entries', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    const event = {
      httpMethod: 'GET',
      pathParameters: { date: '2026-08-31' },
      requestContext: { authorizer: { claims: { sub: 'id', email: 'goshenkataklev@gmail.com' } } }
    };
    const result = await getEntryHandler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).entries).toEqual([]);
  });

  it('should return 200 with entries when found', async () => {
    const items = [{ userId: 'id', entryId: 'abc', date: '2026-08-31', text: 'Hi', images: [], videos: [] }];
    ddbMock.on(ScanCommand).resolves({ Items: items });
    const event = {
      httpMethod: 'GET',
      pathParameters: { date: '2026-08-31' },
      requestContext: { authorizer: { claims: { sub: 'id', email: 'goshenkataklev@gmail.com' } } }
    };
    const result = await getEntryHandler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).entries).toEqual(items);
  });

  it('should return 500 on DynamoDB error', async () => {
    ddbMock.on(ScanCommand).rejects(new Error('DDB error'));
    const event = {
      httpMethod: 'GET',
      pathParameters: { date: '2026-08-31' },
      requestContext: { authorizer: { claims: { sub: 'id', email: 'goshenkataklev@gmail.com' } } }
    };
    const result = await getEntryHandler(event);
    expect(result.statusCode).toBe(500);
  });
});
