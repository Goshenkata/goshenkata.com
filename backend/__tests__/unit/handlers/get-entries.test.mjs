import { mockClient } from 'aws-sdk-client-mock';
import { ScanCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { jest } from '@jest/globals';

let getEntriesHandler;
let ddbMock;

beforeAll(async () => {
  ddbMock = mockClient(DynamoDBDocumentClient);
  ({ getEntriesHandler } = await import('../../../src/handlers/get-entries.mjs'));
  process.env.ALLOWED_USER_EMAIL = 'goshenkataklev@gmail.com';
  process.env.DIARY_TABLE = 'DiaryTable';
});

describe('getEntriesHandler', () => {
  beforeEach(() => ddbMock.reset());

  function baseEvent(overrides = {}) {
    return {
      httpMethod: 'GET',
      queryStringParameters: {},
      requestContext: { authorizer: { claims: { sub: 'user-1', email: 'goshenkataklev@gmail.com' } } },
      ...overrides
    };
  }

  it('returns 403 when unauthorized', async () => {
    const event = baseEvent({ requestContext: { authorizer: { claims: { sub: 'user-1', email: 'nope@example.com' } } } });
    const res = await getEntriesHandler(event);
    expect(res.statusCode).toBe(403);
  });

  it('returns 405 for non-GET', async () => {
    const event = baseEvent({ httpMethod: 'POST' });
    const res = await getEntriesHandler(event);
    expect(res.statusCode).toBe(405);
  });

  it('returns default first page (size 10) sorted desc', async () => {
    // Create 15 items with ascending dates
    const items = Array.from({ length: 15 }).map((_, i) => ({
      userId: 'user-1',
      entryId: `e${i}`,
      date: `2026-09-${(i+1).toString().padStart(2,'0')}`,
      text: `Entry ${i}`
    }));
    ddbMock.on(ScanCommand).resolves({ Items: items });
    const res = await getEntriesHandler(baseEvent());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.entries.length).toBe(10); // page size default
    // First entry should be latest date (2026-09-15)
    expect(body.entries[0].date).toBe('2026-09-15');
    // Last entry on page should be 2026-09-06 (descending)
    expect(body.entries[9].date).toBe('2026-09-06');
    expect(body.total).toBe(15);
  });

  it('returns second page with custom size', async () => {
    const items = Array.from({ length: 12 }).map((_, i) => ({ userId: 'user-1', entryId: `e${i}`, date: `2026-08-${(i+1).toString().padStart(2,'0')}` }));
    ddbMock.on(ScanCommand).resolves({ Items: items });
    const event = baseEvent({ queryStringParameters: { page: '1', size: '5' } });
    const res = await getEntriesHandler(event);
    const body = JSON.parse(res.body);
    expect(body.entries.length).toBe(5);
    // Entries are sorted desc; page1 (0-based) size5 -> items index 5..9 in sorted list
    // Highest date is 2026-08-12; second page first item should thus be 2026-08-07
    expect(body.entries[0].date).toBe('2026-08-07');
  });

  it('returns empty array if page out of range', async () => {
    const items = Array.from({ length: 3 }).map((_, i) => ({ userId: 'user-1', entryId: `e${i}`, date: `2026-07-0${i+1}` }));
    ddbMock.on(ScanCommand).resolves({ Items: items });
    const event = baseEvent({ queryStringParameters: { page: '5', size: '2' } });
    const res = await getEntriesHandler(event);
    const body = JSON.parse(res.body);
    expect(body.entries).toEqual([]);
  });

  it('returns 500 on DDB error', async () => {
    ddbMock.on(ScanCommand).rejects(new Error('boom'));
    const res = await getEntriesHandler(baseEvent());
    expect(res.statusCode).toBe(500);
  });
});
