const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const ID = '11111111-1111-4111-8111-111111111111';
let mockRow;
const mockUpload = jest.fn();
const mockExhibitor = {
  findByPk: async id => id === ID ? { ...mockRow, toJSON: () => ({ ...mockRow }) } : null,
  findAndCountAll: async () => ({ count: 1, rows: [{ toJSON: () => ({ ...mockRow }) }] }),
};
jest.mock('../src/models', () => ({
  getModel: name => name === 'Exhibitor' ? mockExhibitor : {
    findByPk: async role => ({ id: role, role, status: 'active', email: 'admin@example.com' }),
  },
}));
jest.mock('../src/services/CloudinaryService', () => ({ uploadFile: (...args) => mockUpload(...args) }));
jest.mock('../src/services/ExhibitorService', () => ({}));
jest.mock('../src/config/database', () => ({
  getConnection: () => ({
    async query(sql, { replacements }) {
      const keys = [...sql.matchAll(/(\w+) = \?/g)].map(match => match[1]);
      keys.forEach((key, index) => {
        mockRow[key] = ['metadata', 'stallDetails'].includes(key) ? JSON.parse(replacements[index]) : replacements[index];
      });
    },
  }),
}));

process.env.JWT_SECRET = 'isolated-exhibitor-logo-tests';
const { authenticate, authorize } = require('../src/middleware/auth');
const controller = require('../src/controllers/ExhibitorController');
const app = express();
app.use(express.json());
app.use('/api/exhibitors/:id/logo', require('../src/routes/exhibitorLogo'));
app.get('/api/exhibitors', controller.getAllExhibitors);
app.get('/api/exhibitors/:id', controller.getExhibitor);
app.put('/api/exhibitors/:id', authenticate, authorize(['admin']), controller.updateExhibitor);
const auth = role => 'Bearer ' + jwt.sign({ id: role }, process.env.JWT_SECRET);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n1sAAAAASUVORK5CYII=', 'base64');
const upload = (id = ID, role = 'admin') => request(app).post('/api/exhibitors/' + id + '/logo').set('Authorization', auth(role));

beforeEach(() => {
  mockRow = { id: ID, name: 'Existing contact', company: 'Existing company', email: 'company@example.com',
    phone: '9876543210', boothNumber: 'A4', sector: '', status: 'approved', password: 'existing-hash',
    metadata: { originalPassword: 'ExistingPassword', address_city: 'Pune', assignedEmployee: 'Sathish', logoUrl: 'https://res.cloudinary.com/demo/image/upload/old.png' },
    stallDetails: { size: '15 sqm' } };
  mockUpload.mockReset().mockResolvedValue({ url: 'https://res.cloudinary.com/demo/image/upload/new.png', publicId: 'exhibitor-logos/new' });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('anonymous callers and non-admin accounts cannot upload logos', async () => {
  expect((await request(app).post('/api/exhibitors/' + ID + '/logo').attach('logo', png, 'logo.png')).status).toBe(401);
  expect((await upload(ID, 'editor').attach('logo', png, 'logo.png')).status).toBe(403);
  expect(mockUpload).not.toHaveBeenCalled();
});

test('uploads an image to the existing Cloudinary logo folder without saving before the edit is submitted', async () => {
  const original = JSON.stringify(mockRow);
  const response = await upload().field('folder', 'untrusted-folder').attach('logo', png, 'logo.png');
  expect(response.status).toBe(201);
  expect(response.body.data).toEqual({ url: 'https://res.cloudinary.com/demo/image/upload/new.png', publicId: 'exhibitor-logos/new' });
  expect(mockUpload).toHaveBeenCalledWith(expect.any(Buffer), { folder: 'exhibitor-logos', resource_type: 'image' });
  expect(JSON.stringify(mockRow)).toBe(original);
});

test('rejects missing files and unsupported or disguised files', async () => {
  expect((await upload()).status).toBe(400);
  expect((await upload().attach('logo', Buffer.from('pdf'), { filename: 'file.pdf', contentType: 'application/pdf' })).status).toBe(400);
  expect((await upload().attach('logo', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' })).status).toBe(400);
  expect(mockUpload).not.toHaveBeenCalled();
});

test('rejects images larger than 5 MB before sending anything to Cloudinary', async () => {
  const response = await upload().attach('logo', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'big.png', contentType: 'image/png' });
  expect(response.status).toBe(400);
  expect(response.body.error).toMatch(/5 MB/);
  expect(mockUpload).not.toHaveBeenCalled();
});

test('missing exhibitors return 404 without uploading', async () => {
  expect((await upload('missing').attach('logo', png, 'logo.png')).status).toBe(404);
  expect(mockUpload).not.toHaveBeenCalled();
});

test('Cloudinary failure leaves the stored exhibitor unchanged', async () => {
  const original = JSON.stringify(mockRow);
  mockUpload.mockRejectedValueOnce(new Error('Cloudinary unavailable'));
  expect((await upload().attach('logo', png, 'logo.png')).status).toBe(502);
  expect(JSON.stringify(mockRow)).toBe(original);
});

test('saving the logo preserves passwords, employee, location and stall details and exposes the logo in list/detail responses', async () => {
  const uploaded = await upload().attach('logo', png, 'logo.png');
  const response = await request(app).put('/api/exhibitors/' + ID).set('Authorization', auth('admin'))
    .send({ metadata: { logoUrl: uploaded.body.data.url, logoPublicId: uploaded.body.data.publicId } });
  expect(response.status).toBe(200);
  expect(mockRow.password).toBe('existing-hash');
  expect(mockRow.metadata).toMatchObject({ originalPassword: 'ExistingPassword', address_city: 'Pune', assignedEmployee: 'Sathish', logoPublicId: 'exhibitor-logos/new' });
  expect(mockRow.stallDetails.size).toBe('15 sqm');
  const list = await request(app).get('/api/exhibitors');
  expect(list.body.data[0].logoUrl).toBe(uploaded.body.data.url);
  expect(list.body.data[0].metadata).toBeUndefined();
  const detail = await request(app).get('/api/exhibitors/' + ID);
  expect(detail.body.data.metadata.logoUrl).toBe(uploaded.body.data.url);
});

test('a logo and password saved together retain the new password and logo metadata', async () => {
  const response = await request(app).put('/api/exhibitors/' + ID).set('Authorization', auth('admin'))
    .send({ password: 'NewPassword123!', metadata: { logoUrl: 'https://res.cloudinary.com/demo/image/upload/new.png' } });
  expect(response.status).toBe(200);
  expect(await bcrypt.compare('NewPassword123!', mockRow.password)).toBe(true);
  expect(mockRow.metadata.originalPassword).toBe('NewPassword123!');
  expect(mockRow.metadata.logoUrl).toContain('/new.png');
  expect(mockRow.metadata.address_city).toBe('Pune');
});

test.each(['active', 'approved'])('the %s directory filter includes both public database states', async status => {
  const { Op } = require('sequelize');
  const find = jest.spyOn(mockExhibitor, 'findAndCountAll');
  const response = await request(app).get('/api/exhibitors?status=' + status);
  expect(response.status).toBe(200);
  expect(find.mock.calls[0][0].where.status[Op.in]).toEqual(['active', 'approved']);
});
test('non-public status filters stay exact and company initials apply before pagination', async () => {
  const { Op } = require('sequelize');
  const find = jest.spyOn(mockExhibitor, 'findAndCountAll');
  expect((await request(app).get('/api/exhibitors?status=inactive&letter=s')).status).toBe(200);
  expect(find.mock.calls[0][0].where.status).toBe('inactive');
  expect(find.mock.calls[0][0].where.company[Op.like]).toBe('S%');
  expect((await request(app).get('/api/exhibitors?letter=invalid')).status).toBe(400);
});
