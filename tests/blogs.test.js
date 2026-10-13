const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

let mockRows = [];
let mockCounter = 0;
const mockCloudUpload = jest.fn(async () => ({ url: 'https://example.com/blog.png' }));

function mockMatches(row, where) {
  if (where.status && row.status !== where.status) return false;
  if (where.slug && row.slug !== where.slug) return false;
  if (where.publishedAt && (!row.publishedAt || row.publishedAt > where.publishedAt[Op.lte])) return false;
  if (where[Op.or]) {
    return where[Op.or].some(condition => Object.entries(condition).some(([key, value]) =>
      row[key].toLowerCase().includes(value[Op.like].slice(1, -1).toLowerCase())));
  }
  return true;
}
const mockModel = {
  async create(value) {
    if (mockRows.some(row => row.slug === value.slug)) throw Object.assign(new Error('unique'), { name: 'SequelizeUniqueConstraintError' });
    const row = {
      ...value, id: 'blog-' + (++mockCounter), createdAt: new Date(), updatedAt: new Date(),
      async update(update) {
        if (mockRows.some(other => other.id !== this.id && other.slug === update.slug)) throw Object.assign(new Error('unique'), { name: 'SequelizeUniqueConstraintError' });
        Object.assign(this, update, { updatedAt: new Date() }); return this;
      },
      async destroy() { mockRows = mockRows.filter(other => other.id !== this.id); },
    };
    mockRows.push(row); return row;
  },
  async findByPk(id) { return mockRows.find(row => row.id === id) || null; },
  async findOne({ where }) { return mockRows.find(row => mockMatches(row, where)) || null; },
  async findAndCountAll({ where, offset, limit }) {
    const rows = mockRows.filter(row => mockMatches(row, where));
    return { count: rows.length, rows: rows.slice(offset, offset + limit).map(({ content, ...summary }) => summary) };
  },
};
jest.mock('../src/models', () => ({
  getModel: name => name === 'Blog' ? mockModel : {
    findByPk: async id => ({ id, role: id, status: 'active', email: 'test@example.com', name: 'Test user' }),
  },
}));
jest.mock('../src/services/CloudinaryService', () => ({ uploadImage: (...args) => mockCloudUpload(...args) }));

process.env.JWT_SECRET = 'isolated-blog-tests-only';
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/blogs', require('../src/routes/blogs'));
const auth = role => 'Bearer ' + jwt.sign({ id: role }, process.env.JWT_SECRET);
const input = changes => ({ title: 'Precision tooling news', content: '## Tooling\n\nA manufacturing update.', ...changes });
const create = async changes => request(app).post('/api/blogs').set('Authorization', auth('admin')).send(input(changes));

beforeEach(() => { mockRows = []; mockCounter = 0; mockCloudUpload.mockClear(); });

test('requires authentication before creating blogs', async () => {
  expect((await request(app).post('/api/blogs').send(input())).status).toBe(401);
});
test('rejects viewers but allows editors', async () => {
  expect((await request(app).post('/api/blogs').set('Authorization', auth('viewer')).send(input())).status).toBe(403);
  expect((await request(app).post('/api/blogs').set('Authorization', auth('editor')).send(input())).status).toBe(201);
});
test('creates drafts with a generated slug and no publication date', async () => {
  const response = await create();
  expect(response.status).toBe(201);
  expect(response.body.data).toMatchObject({ slug: 'precision-tooling-news', status: 'draft', publishedAt: null });
});
test('public list cannot expose drafts through a supplied status filter', async () => {
  await create();
  await create({ title: 'Published update', status: 'published' });
  const response = await request(app).get('/api/blogs?status=draft');
  expect(response.body.data.total).toBe(1);
  expect(response.body.data.blogs[0].status).toBe('published');
  expect(response.body.data.blogs[0].content).toBeUndefined();
});
test('draft slugs return 404 publicly but are available to admin by id', async () => {
  const { body } = await create();
  expect((await request(app).get('/api/blogs/slug/' + body.data.slug)).status).toBe(404);
  const response = await request(app).get('/api/blogs/admin/' + body.data.id).set('Authorization', auth('admin'));
  expect(response.body.data.content).toContain('manufacturing');
});
test('admin list requires authorization and can filter drafts', async () => {
  await create();
  await create({ title: 'Published', status: 'published' });
  expect((await request(app).get('/api/blogs/admin')).status).toBe(401);
  const response = await request(app).get('/api/blogs/admin?status=draft').set('Authorization', auth('admin'));
  expect(response.body.data.total).toBe(1);
  expect(response.body.data.blogs[0].status).toBe('draft');
});
test('publishes a draft and preserves publication date on edits', async () => {
  const draft = (await create()).body.data;
  const first = await request(app).put('/api/blogs/' + draft.id).set('Authorization', auth('admin')).send(input({ slug: draft.slug, status: 'published' }));
  expect(first.status).toBe(200);
  expect(first.body.data.publishedAt).toBeTruthy();
  const second = await request(app).put('/api/blogs/' + draft.id).set('Authorization', auth('admin')).send(input({ slug: draft.slug, status: 'published', content: 'Updated content' }));
  expect(second.body.data.publishedAt).toBe(first.body.data.publishedAt);
  expect((await request(app).get('/api/blogs/slug/' + draft.slug)).body.data.content).toBe('Updated content');
});
test('moving a post back to draft removes it from public routes', async () => {
  const blog = (await create({ status: 'published' })).body.data;
  await request(app).put('/api/blogs/' + blog.id).set('Authorization', auth('admin')).send(input({ slug: blog.slug, status: 'draft' }));
  expect((await request(app).get('/api/blogs/slug/' + blog.slug)).status).toBe(404);
  expect((await request(app).get('/api/blogs')).body.data.total).toBe(0);
});
test('protects publication timestamps from mass assignment', async () => {
  expect((await create({ publishedAt: '2099-01-01' })).status).toBe(400);
});
test('rejects duplicate slugs without overwriting another blog', async () => {
  await create();
  expect((await create()).status).toBe(409);
  expect(mockRows.length).toBe(1);
});
test('validates required fields, URL slugs and image protocols', async () => {
  expect((await create({ content: ' ' })).status).toBe(400);
  expect((await create({ slug: '../unsafe' })).status).toBe(400);
  expect((await create({ image: 'javascript:alert(1)' })).status).toBe(400);
});
test('validates pagination and supports search', async () => {
  await create({ title: 'CNC news', status: 'published' });
  await create({ title: 'Mould update', status: 'published' });
  expect((await request(app).get('/api/blogs?limit=-1')).status).toBe(400);
  expect((await request(app).get('/api/blogs?page=1.5')).status).toBe(400);
  const response = await request(app).get('/api/blogs?search=CNC&limit=1');
  expect(response.body.data.total).toBe(1);
  expect(response.body.data.blogs[0].title).toBe('CNC news');
});
test('deletion is protected and removes the published post', async () => {
  const blog = (await create({ status: 'published' })).body.data;
  expect((await request(app).delete('/api/blogs/' + blog.id)).status).toBe(401);
  expect((await request(app).delete('/api/blogs/' + blog.id).set('Authorization', auth('admin'))).status).toBe(200);
  expect((await request(app).get('/api/blogs/slug/' + blog.slug)).status).toBe(404);
});
test('returns 404 when editing a nonexistent post', async () => {
  expect((await request(app).put('/api/blogs/missing').set('Authorization', auth('admin')).send(input())).status).toBe(404);
});
test('uploads cover images through Cloudinary only for authorized admins', async () => {
  expect((await request(app).post('/api/blogs/upload')).status).toBe(401);
  const response = await request(app).post('/api/blogs/upload').set('Authorization', auth('admin')).attach('image', Buffer.from('image'), { filename: 'cover.png', contentType: 'image/png' });
  expect(response.status).toBe(200);
  expect(response.body.data.url).toBe('https://example.com/blog.png');
  expect(mockCloudUpload).toHaveBeenCalledTimes(1);
});
test('rejects missing files, SVG files and oversized images', async () => {
  expect((await request(app).post('/api/blogs/upload').set('Authorization', auth('admin'))).status).toBe(400);
  expect((await request(app).post('/api/blogs/upload').set('Authorization', auth('admin')).attach('image', Buffer.from('<svg/>'), { filename: 'cover.svg', contentType: 'image/svg+xml' })).status).toBe(400);
  expect((await request(app).post('/api/blogs/upload').set('Authorization', auth('admin')).attach('image', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' })).status).toBe(400);
  expect(mockCloudUpload).not.toHaveBeenCalled();
});
