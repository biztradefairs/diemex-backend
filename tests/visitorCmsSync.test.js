const { Op } = require('sequelize');

let mockRows = new Map();
let mockCurrentPass;
const mockSync = {
  sequelize: { transaction: jest.fn(async callback => callback({ LOCK: { UPDATE: 'UPDATE' } })) },
  sync: jest.fn(async () => {}),
  findByPk: jest.fn(async id => mockRows.get(id) || null),
  upsert: jest.fn(async values => { mockRows.set(values.visitorPassId, { ...values }); }),
  findAll: jest.fn(async () => [...mockRows.values()].filter(row => row.status === 'pending' && row.nextAttemptAt <= new Date())),
  update: jest.fn(async (values, { where }) => {
    const row = mockRows.get(where.visitorPassId);
    if (!row || row.payloadHash !== where.payloadHash) return [0];
    Object.assign(row, values); return [1];
  }),
};
const mockPasses = { findAll: jest.fn(async () => []), findByPk: jest.fn(async () => mockCurrentPass) };
jest.mock('../src/models', () => ({ init: async () => ({ VisitorPassCmsSync: mockSync, VisitorPass: mockPasses }) }));
jest.mock('../src/services/VisitorBadgeSettingsService', () => ({ getActiveBadgeDesign: async () => 'design1' }));
const sync = require('../src/services/VisitorPassCmsSyncService');
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
const pass = (overrides = {}) => (mockCurrentPass = {
  id: 'pass-1', registrationNumber: 'REG-DMX-1', publicCode: 'public-1', name: 'Test Visitor',
  company: 'Test Company', designation: 'Engineer', phone: '+919876543210',
  countryCode: '+91', nationalNumber: '9876543210', email: null, city: 'Pune',
  state: 'Maharashtra', country: 'India', area: 'Pimpri', pinCode: '411019',
  interests: ['Tooling'], channel: 'sms', status: 'issued',
  issuedAt: new Date('2026-11-06T10:00:00Z'), verifiedAt: new Date('2026-11-06T09:59:00Z'),
  updatedAt: new Date('2026-11-06T10:00:00Z'), ...overrides,
});
const succeed = () => ({ ok: true, status: 200, json: async () => ({ data: { syncVisitorPass: { id: 'cms-lead-1' } } }) });
beforeEach(() => {
  jest.clearAllMocks(); mockRows = new Map();
  process.env.CMS_GRAPHQL_ENDPOINT = 'https://cms.example.test/graphql';
  process.env.CMS_PROJECT_ID = 'diemex-project';
  process.env.FRONTEND_URL = 'https://www.diemex.in';
  process.env.PUBLIC_BACKEND_URL = 'https://api.example.test';
  delete process.env.CMS_SYNC_SECRET;
  mockPasses.findAll.mockResolvedValue([]);
  global.fetch = jest.fn(async () => succeed());
});
afterAll(() => { sync.stopWorker(); global.fetch = originalFetch; process.env = originalEnv; });
test('queues complete visitor and badge details before trying the CMS network', async () => {
  await sync.enqueue(pass(), { tracking: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'visitors' } });
  expect(global.fetch).not.toHaveBeenCalled();
  expect(mockRows.get('pass-1').payload).toMatchObject({
    projectId: 'diemex-project', registrationNumber: 'REG-DMX-1', phone: '+919876543210',
    jobTitle: 'Engineer', pinCode: '411019', interests: ['Tooling'], utmSource: 'google',
    badgeUrl: 'https://api.example.test/api/passes/public-1/badge?design=design1',
  });
  expect(mockRows.get('pass-1').payload.verificationToken).toBeUndefined();
});
test('syncs a phone-only registration without inventing an email address', async () => {
  await sync.enqueue(pass());
  process.env.CMS_SYNC_SECRET = 'test-private-key';
  expect(await sync.processPending({ backfill: false })).toEqual({ synced: 1, pending: 0 });
  const [url, options] = global.fetch.mock.calls[0];
  const input = JSON.parse(options.body).variables.input;
  expect(url).toBe('https://cms.example.test/graphql');
  expect(input.email).toBeUndefined();
  expect(options.headers['x-cms-sync-secret']).toBe('test-private-key');
  expect(mockRows.get('pass-1')).toMatchObject({ status: 'synced', leadId: 'cms-lead-1' });
});
test('keeps failed requests durable and schedules a retry', async () => {
  await sync.enqueue(pass());
  process.env.CMS_SYNC_SECRET = 'test-private-key';
  global.fetch.mockRejectedValueOnce(new Error('CMS unavailable'));
  expect(await sync.processPending({ backfill: false })).toEqual({ synced: 0, pending: 1 });
  const row = mockRows.get('pass-1');
  expect(row).toMatchObject({ status: 'pending', attempts: 1, lastError: 'CMS unavailable' });
  expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
});
test('treats GraphQL errors as failures even with an HTTP 200 response', async () => {
  await sync.enqueue(pass()); process.env.CMS_SYNC_SECRET = 'test-private-key';
  global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ errors: [{ message: 'Migration pending' }] }) });
  await sync.processPending({ backfill: false });
  expect(mockRows.get('pass-1')).toMatchObject({ status: 'pending', lastError: 'Migration pending' });
});
test('preserves campaign data when delivery or check-in queues another snapshot', async () => {
  await sync.enqueue(pass(), { tracking: { utm_source: 'google' } });
  await sync.enqueue(pass({ status: 'checked_in', checkedInAt: new Date('2026-11-06T11:00:00Z'), updatedAt: new Date('2026-11-06T11:00:00Z') }));
  expect(mockRows.size).toBe(1);
  expect(mockRows.get('pass-1').payload).toMatchObject({ status: 'checked_in', utmSource: 'google' });
});
test('uses a stable snapshot hash despite JSON key reordering in MySQL', async () => {
  await sync.enqueue(pass());
  const row = mockRows.get('pass-1');
  row.payload = Object.fromEntries(Object.entries(row.payload).reverse());
  row.status = 'synced';
  await sync.enqueue(pass());
  expect(mockSync.upsert).toHaveBeenCalledTimes(1);
  expect(row.status).toBe('synced');
});
test('does not mark a newer snapshot synced when an older network request completes', async () => {
  await sync.enqueue(pass()); process.env.CMS_SYNC_SECRET = 'test-private-key';
  global.fetch.mockImplementationOnce(async () => {
    await sync.enqueue(pass({ status: 'checked_in', updatedAt: new Date('2026-11-06T11:00:00Z') }));
    return succeed();
  });
  await sync.processPending({ backfill: false });
  expect(mockRows.get('pass-1')).toMatchObject({ status: 'pending', payload: expect.objectContaining({ status: 'checked_in' }) });
});
test('discovers existing passes that have no CMS queue record', async () => {
  mockPasses.findAll.mockResolvedValueOnce([pass()]);
  process.env.CMS_SYNC_SECRET = 'test-private-key';
  await sync.processPending();
  expect(mockPasses.findAll.mock.calls[0][0].where).toMatchObject({ '$cmsSync.visitorPassId$': null });
  expect(mockPasses.findAll.mock.calls[0][0].where[Op.or]).toEqual([{ source: null }, { source: { [Op.ne]: 'contact:delegate-registration' } }]);
  expect(mockRows.get('pass-1').status).toBe('synced');
});

test('queue versions increase even if database timestamps have only second precision', async () => {
  await sync.enqueue(pass());
  const first = mockRows.get('pass-1').payload.sourceUpdatedAt;
  await sync.enqueue(pass({ sentStatus: 'accepted' }));
  expect(Date.parse(mockRows.get('pass-1').payload.sourceUpdatedAt)).toBeGreaterThan(Date.parse(first));
});
test('does not reclassify existing delegate registrations as visitor leads', async () => {
  await sync.enqueue(pass({ source: 'contact:delegate-registration' }));
  expect(mockRows.size).toBe(0);
  expect(mockSync.upsert).not.toHaveBeenCalled();
});
