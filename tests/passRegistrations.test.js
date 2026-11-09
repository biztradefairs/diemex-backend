const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

const mockPassModel = { findAndCountAll: jest.fn() };
const mockSyncModel = { findAll: jest.fn() };
const mockActiveDesign = jest.fn();
const mockCmsConfigured = jest.fn();

jest.mock('../src/models', () => ({
  init: async () => ({ VisitorPass: mockPassModel, VisitorPassCmsSync: mockSyncModel }),
  getModel: () => ({
    findByPk: async id => id === 'missing' ? null : {
      id, role: id, status: id === 'inactive' ? 'inactive' : 'active',
    },
  }),
}));
jest.mock('../src/services/PassService', () => ({}));
jest.mock('../src/services/VisitorPassCmsSyncService', () => ({ isConfigured: mockCmsConfigured }));
jest.mock('../src/services/VisitorBadgeSettingsService', () => ({ getActiveBadgeDesign: mockActiveDesign }));
jest.mock('../src/services/VisitorBadgePreview', () => ({ renderBadgePreview: jest.fn() }));

const registrations = require('../src/services/PassRegistrationAdminService');
const app = express();
app.use('/api/passes', require('../src/routes/passRoutes'));
const endpoint = '/api/passes/admin/registrations';
const originalEnv = { ...process.env };
const token = (role = 'admin') => 'Bearer ' + jwt.sign({ id: role }, process.env.JWT_SECRET);
const get = query => request(app).get(endpoint).set('Authorization', token()).query(query || {});
const pass = overrides => ({
  id: 'pass-1', registrationNumber: 'REG-DMX-1', publicCode: 'public-1',
  name: 'Visitor One', company: 'Example Company', phone: '+919876543210',
  interests: ['Tooling'], status: 'issued', createdAt: new Date('2026-11-06T10:00:00Z'),
  ...overrides,
});

beforeEach(() => {
  jest.resetAllMocks();
  process.env.JWT_SECRET = 'pass-registration-admin-tests';
  process.env.FRONTEND_URL = 'https://visitors.example.test/';
  process.env.PUBLIC_BACKEND_URL = 'https://api.example.test/api/';
  mockPassModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });
  mockSyncModel.findAll.mockResolvedValue([]);
  mockActiveDesign.mockResolvedValue('design1');
  mockCmsConfigured.mockReturnValue(true);
});
afterAll(() => { process.env = originalEnv; });

test('only active admins can read visitor registrations', async () => {
  expect((await request(app).get(endpoint)).status).toBe(401);
  for (const role of ['editor', 'viewer', 'exhibitor', 'inactive', 'missing']) {
    const response = await request(app).get(endpoint).set('Authorization', token(role));
    expect(response.status).toBe(['missing'].includes(role) ? 401 : 403);
  }
  expect(mockPassModel.findAndCountAll).not.toHaveBeenCalled();
});

test('returns default pagination without caching personal data', async () => {
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body).toEqual({
    success: true, registrations: [], total: 0, page: 1, limit: 25,
    totalPages: 1, cmsConfigured: true,
  });
  expect(mockPassModel.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 25, offset: 0 }));
});

test('applies pagination, status, trimmed search, and the visitor-only restriction together', async () => {
  mockPassModel.findAndCountAll.mockResolvedValue({ rows: [], count: 21 });
  const response = await get({ page: '2', limit: '10', status: 'checked_in', search: '  Visitor  ' });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ total: 21, page: 2, limit: 10, totalPages: 3 });
  const options = mockPassModel.findAndCountAll.mock.calls[0][0];
  expect(options).toMatchObject({ limit: 10, offset: 10, order: [['createdAt', 'DESC'], ['id', 'DESC']] });
  expect(options.where[Op.and]).toEqual([
    { [Op.or]: [{ source: null }, { source: { [Op.ne]: 'contact:delegate-registration' } }] },
    { status: 'checked_in' },
    { [Op.or]: ['name', 'company', 'email', 'phone', 'registrationNumber'].map(field => ({
      [field]: { [Op.substring]: 'Visitor' },
    })) },
  ]);
});

test.each([
  { page: '0' }, { page: '1.5' }, { page: '1000001' },
  { limit: '0' }, { limit: '101' }, { status: 'unknown' },
  { search: 'x'.repeat(121) }, { search: ['one', 'two'] },
  { page: ['1', '2'] }, { limit: ['10', '25'] }, { status: ['issued', 'cancelled'] },
])('rejects invalid list parameters before querying visitor data: %j', async query => {
  const response = await get(query);
  expect(response.status).toBe(400);
  expect(mockPassModel.findAndCountAll).not.toHaveBeenCalled();
});

test('returns visitor details, sync progress, and the badge design saved at delivery', async () => {
  mockPassModel.findAndCountAll.mockResolvedValue({ rows: [pass({ qrPayload: 'private-qr', unexpected: 'private' })], count: 1 });
  mockActiveDesign.mockResolvedValue('design2');
  mockSyncModel.findAll.mockResolvedValue([{
    visitorPassId: 'pass-1', status: 'pending', leadId: 'lead-1',
    attempts: 2, lastError: 'CMS unavailable', nextAttemptAt: new Date('2026-11-09T10:00:00Z'),
    payload: JSON.stringify({ badgeDesign: 'design1', verificationToken: 'private-token' }),
  }]);
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.body.registrations[0]).toMatchObject({
    id: 'pass-1', name: 'Visitor One', email: null, interests: ['Tooling'], badgeDesign: 'design1',
    passUrl: 'https://visitors.example.test/passes/view/public-1',
    badgeUrl: 'https://api.example.test/api/passes/public-1/badge?design=design1',
    cmsSync: { status: 'pending', leadId: 'lead-1', attempts: 2, lastError: 'CMS unavailable' },
  });
  for (const field of ['qrPayload', 'unexpected', 'verificationToken', 'payload']) {
    expect(response.body.registrations[0]).not.toHaveProperty(field);
  }
  expect(mockSyncModel.findAll.mock.calls[0][0].where.visitorPassId[Op.in]).toEqual(['pass-1']);
});

test('uses the active badge design for visitors with no queue record', async () => {
  mockPassModel.findAndCountAll.mockResolvedValue({ rows: [pass({ interests: null })], count: 1 });
  mockActiveDesign.mockResolvedValue('design2');
  mockCmsConfigured.mockReturnValue(false);
  const result = await registrations.listRegistrations();
  expect(result.cmsConfigured).toBe(false);
  expect(result.registrations[0]).toMatchObject({
    interests: [], badgeDesign: 'design2', cmsSync: {
      status: 'not_queued', leadId: null, syncedAt: null, attempts: 0,
      lastError: null, nextAttemptAt: null,
    },
  });
});

test.each(['null', '[]', '123', 'broken-json', '{"badgeDesign":"invalid"}'])(
  'a malformed or outdated sync snapshot does not hide the saved visitor: %s', async payload => {
    mockPassModel.findAndCountAll.mockResolvedValue({ rows: [pass()], count: 1 });
    mockSyncModel.findAll.mockResolvedValue([{ visitorPassId: 'pass-1', payload, status: 'pending' }]);
    const result = await registrations.listRegistrations();
    expect(result.registrations[0].badgeDesign).toBe('design1');
  },
);

test('keeps saved registrations accessible before the CMS queue table is created', async () => {
  mockPassModel.findAndCountAll.mockResolvedValue({ rows: [pass()], count: 1 });
  mockSyncModel.findAll.mockRejectedValue({ original: { code: 'ER_NO_SUCH_TABLE' } });
  const result = await registrations.listRegistrations();
  expect(result.registrations[0].cmsSync.status).toBe('not_queued');
});

test('reports database failures instead of reporting an empty list', async () => {
  mockPassModel.findAndCountAll.mockRejectedValue(new Error('Visitor storage unavailable'));
  const response = await get();
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ success: false, error: 'Visitor storage unavailable' });
});

test('does not silently hide unrelated CMS queue database errors', async () => {
  mockPassModel.findAndCountAll.mockResolvedValue({ rows: [pass()], count: 1 });
  mockSyncModel.findAll.mockRejectedValue(new Error('CMS queue permission denied'));
  await expect(registrations.listRegistrations()).rejects.toThrow('CMS queue permission denied');
});

test('empty lists do not need CMS queue queries or badge settings', async () => {
  await registrations.listRegistrations();
  expect(mockSyncModel.findAll).not.toHaveBeenCalled();
  expect(mockActiveDesign).not.toHaveBeenCalled();
});
