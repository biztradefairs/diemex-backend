const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

let mockPasses = [];
let mockScans = [];
let mockContacts = [];
let mockTransactionTail = Promise.resolve();
let mockPhoneCounter = 0;
const mockMessaging = {
  verifyReady: jest.fn(() => true), verifyCodeLength: jest.fn(() => 6),
  isConfigured: jest.fn(() => true),
  sendOtp: jest.fn(async () => ({ success: true, provider: 'twilio-verify', digits: 6 })),
  checkVerification: jest.fn(async ({ code }) => ({ approved: code === '123456' })),
  sendPass: jest.fn(async () => ({ success: true, provider: 'twilio', status: 'queued' }))
};
const mockCloudinary = {
  uploadImage: jest.fn(async (buffer, options) => ({ secure_url: 'https://res.cloudinary.com/test/image/upload/v1/visitor-passes/' + options.public_id + '.png' }))
};
const mockBadgeRenderer = { renderVisitorBadge: jest.fn(async () => Buffer.from('full-badge-png')) };
let mockBadgeSetting = null;
const mockBadgeSettingModel = {
  sync: jest.fn(async () => {}),
  findByPk: jest.fn(async () => mockBadgeSetting),
  upsert: jest.fn(async (value) => { mockBadgeSetting = { ...value, updatedAt: new Date() }; })
};
function mockMatches(row, where = {}) {
  if (where[Op.or] && !where[Op.or].some((clause) => mockMatches(row, clause))) return false;
  for (const field of ['id', 'phone', 'publicCode', 'registrationNumber', 'visitorPassId', 'scannerId', 'status']) {
    if (where[field] !== undefined && row[field] !== where[field]) return false;
  }
  return !where.scannedAt || row.scannedAt >= where.scannedAt[Op.gte];
}
const mockPassModel = {
  sync: jest.fn(async () => {}),
  sequelize: {
    transaction: jest.fn((callback) => {
      const current = mockTransactionTail.then(() => callback({ LOCK: { UPDATE: 'UPDATE' } }));
      mockTransactionTail = current.catch(() => {});
      return current;
    })
  },
  findOne: jest.fn(async ({ where }) => mockPasses.find((row) => mockMatches(row, where)) || null),
  findByPk: jest.fn(async (id) => mockPasses.find((row) => row.id === id) || null),
  findAll: jest.fn(async ({ where }) => mockPasses.filter((row) => where.id.includes(row.id))),
  count: jest.fn(async ({ where } = {}) => mockPasses.filter((row) => mockMatches(row, where)).length),
  create: jest.fn(async (value) => {
    const row = {
      ...value, id: 'pass-' + (mockPasses.length + 1),
      save: jest.fn(async () => {}),
      async update(values) { Object.assign(this, values); return this; }
    };
    mockPasses.push(row);
    return row;
  }),
  findOrCreate: jest.fn(async ({ where, defaults }) => {
    const existing = mockPasses.find((row) => mockMatches(row, where));
    return existing ? [existing, false] : [await mockPassModel.create(defaults), true];
  })
};
const mockScanModel = {
  sync: jest.fn(async () => {}),
  findOne: jest.fn(async ({ where }) => [...mockScans].reverse().find((row) => mockMatches(row, where)) || null),
  create: jest.fn(async (value) => {
    const row = { ...value, id: 'scan-' + (mockScans.length + 1) };
    mockScans.push(row);
    return row;
  }),
  count: jest.fn(async ({ where }) => mockScans.filter((row) => mockMatches(row, where)).length),
  findAll: jest.fn(async ({ where, group, limit }) => group
    ? [...new Set(mockScans.filter((row) => mockMatches(row, where)).map((row) => row.visitorPassId))]
      .map((visitorPassId) => ({ visitorPassId }))
    : [...mockScans].reverse().slice(0, limit))
};
const mockContactModel = {
  sync: jest.fn(async () => {}),
  sequelize: { where: (field, value) => ({ value }), fn: () => ({}), col: () => ({}) },
  findOne: jest.fn(async ({ where }) => mockContacts.find((row) =>
    where.formType[Op.in].includes(row.formType) && row.payload.visitorCode === where[Op.and].value) || null),
  create: jest.fn(async (value) => {
    const row = {
      ...value,
      update: jest.fn(async (values) => { Object.assign(row, values); return row; })
    };
    mockContacts.push(row);
    return row;
  })
};
jest.mock('../src/models', () => ({
  init: async () => ({ VisitorPass: mockPassModel, VisitorPassScan: mockScanModel, ContactSubmission: mockContactModel, VisitorBadgeSetting: mockBadgeSettingModel }),
  getModel: () => ({
    findByPk: async (role) => role === 'missing' ? null : { id: role, role, status: role === 'inactive' ? 'inactive' : 'active' }
  })
}));
jest.mock('../src/services/PassMessagingService', () => mockMessaging);
jest.mock('../src/services/EmailService', () => ({
  sendEmail: jest.fn(async () => ({ success: true })),
  sendEmailWithAttachment: jest.fn(async () => ({ success: true })),
  sendVisitorOTP: jest.fn(async () => ({ success: true }))
}));
jest.mock('../src/services/CloudinaryService', () => mockCloudinary);
jest.mock('../src/services/VisitorBadgeRenderer', () => mockBadgeRenderer);
jest.mock('qrcode', () => ({ toDataURL: async () => 'data:image/png;base64,test', toBuffer: async () => Buffer.from('test') }));

process.env.JWT_SECRET = 'visitor-pass-regression-tests';
const app = express();
app.use(express.json());
app.use('/api/passes', require('../src/routes/passRoutes'));
app.use('/api/contact', require('../src/routes/contact'));
const token = (role = 'admin') => 'Bearer ' + jwt.sign({ id: role }, process.env.JWT_SECRET);
const phone = { countryCode: '+91', mobile: '9876543210', channel: 'whatsapp', email: 'visitor@example.test' };
const scan = (code, scannerId = 'phone-A') => request(app).post('/api/passes/scan')
  .set('Authorization', token()).send({ code, scannerId });
const service = require('../src/services/PassService');

beforeEach(() => {
  mockPasses = []; mockScans = []; mockContacts = []; mockBadgeSetting = null;
  mockTransactionTail = Promise.resolve();
  jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());

async function verified(channel = phone.channel) {
  const suffix = String(++mockPhoneCounter).padStart(7, '0');
  const input = { ...phone, channel, mobile: '987' + suffix };
  expect((await request(app).post('/api/passes/send-otp').send(input)).status).toBe(200);
  const response = await request(app).post('/api/passes/verify-otp').send({ ...input, otp: '123456' });
  expect(response.status).toBe(200);
  return { input, verificationToken: response.body.verificationToken };
}
async function pass() {
  return mockPassModel.create({
    registrationNumber: 'REG-DMX-TEST', publicCode: 'public-test', name: 'Test Visitor',
    company: 'Test Company', phone: '+919876543210', status: 'issued'
  });
}

test('scanner APIs reject anonymous users and unauthorized roles', async () => {
  expect((await request(app).post('/api/passes/scan').send({ code: 'test' })).status).toBe(401);
  expect((await request(app).get('/api/passes/scanner/summary')).status).toBe(401);
  expect((await request(app).post('/api/passes/check-in').send({ code: 'test' })).status).toBe(401);
  expect((await request(app).post('/api/passes/scan').set('Authorization', token('viewer')).send({ code: 'test' })).status).toBe(403);
  expect((await request(app).get('/api/passes/scanner/summary').set('Authorization', token('editor'))).status).toBe(200);
});

test('legacy scanner routes cannot bypass staff authentication', async () => {
  expect((await request(app).post('/api/contact/visitor/checkin').send({ visitorCode: 'test' })).status).toBe(401);
  expect((await request(app).get('/api/contact/visitors/all')).status).toBe(401);
  expect((await request(app).get('/api/contact/visitors/checked-in')).status).toBe(401);
});

test('verified main registration issues a pass that the scanner records', async () => {
  const session = await verified();
  const response = await request(app).post('/api/contact').send({
    formType: 'visitor-registration', verificationToken: session.verificationToken,
    countryCode: session.input.countryCode, phone: session.input.mobile,
    email: session.input.email, firstName: 'Test', lastName: 'Visitor', contactPerson: 'Test Visitor', companyName: 'Test Company',
    profile: 'Automotive', country: 'India'
  });
  expect(response.status).toBe(202);
  expect(response.body.pass.phone).toBe('+91' + session.input.mobile);
  expect(response.body.delivery.success).toBe(true);
  const result = await scan(response.body.pass.qrPayload);
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({ duplicate: false, todayVisit: 1, eventVisits: 1 });
  expect(mockPasses[0].status).toBe('checked_in');
  expect(mockPasses[0].checkedInAt).toBeInstanceOf(Date);
  expect(mockContacts[0].payload.visitorCode).toBe(response.body.pass.registrationNumber);
  expect(require('../src/services/EmailService').sendEmailWithAttachment).toHaveBeenCalled();
});

test('delivery errors keep the saved registration available', async () => {
  const session = await verified();
  mockMessaging.sendPass.mockRejectedValueOnce(new Error('Provider unavailable'));
  const response = await request(app).post('/api/passes/register').send({
    verificationToken: session.verificationToken, name: 'Visitor', company: 'Company', interests: ['Automotive']
  });
  expect(response.status).toBe(200);
  expect(response.body.delivery).toMatchObject({ success: false, error: 'Provider unavailable' });
  expect(mockPasses).toHaveLength(1);
});

test('same scanner duplicates are ignored, while later visits remain allowed', async () => {
  const row = await pass();
  expect((await scan(row.registrationNumber)).body.duplicate).toBe(false);
  const firstCheckIn = row.checkedInAt;
  expect((await scan(row.registrationNumber)).body.duplicate).toBe(true);
  expect(mockScans).toHaveLength(1);
  mockScans[0].scannedAt = new Date(Date.now() - 16000);
  const result = await scan('/passes/view/' + row.publicCode);
  expect(result.body).toMatchObject({ duplicate: false, eventVisits: 2 });
  expect(row.checkedInAt).toEqual(firstCheckIn);
});

test('concurrent requests for the same pass and device insert one scan', async () => {
  const row = await pass();
  const results = await Promise.all([
    service.recordScan({ code: row.registrationNumber, scannerId: 'same-device' }),
    service.recordScan({ code: row.registrationNumber, scannerId: 'same-device' })
  ]);
  expect(results.filter((result) => result.duplicate)).toHaveLength(1);
  expect(mockScans).toHaveLength(1);
  expect(mockPassModel.findByPk).toHaveBeenCalledWith(row.id, expect.objectContaining({ lock: 'UPDATE' }));
});

test('unknown and cancelled passes never produce attendance rows', async () => {
  expect((await scan('unknown')).status).toBe(404);
  const row = await pass();
  row.status = 'cancelled';
  expect((await scan(row.registrationNumber)).status).toBe(404);
  expect(mockScans).toHaveLength(0);
});

test('legacy email URLs are imported only from saved visitor registrations', async () => {
  mockContacts.push({
    formType: 'visitor-registration',
    payload: { visitorCode: 'diemex-12345', firstName: 'Legacy', lastName: 'Visitor', phone: '9876543210', email: 'legacy@example.test', companyName: 'Legacy Company' }
  });
  const response = await scan('https://example.test/api/contact/pass/diemex-12345');
  expect(response.status).toBe(200);
  expect(response.body.visitor).toMatchObject({ name: 'Legacy Visitor', registrationNumber: 'diemex-12345' });
  expect(mockPasses).toHaveLength(1);
  expect((await scan('diemex-12345')).body.duplicate).toBe(true);
  expect(mockPasses).toHaveLength(1);
  expect((await scan('https://example.test/api/contact/pass/diemex-unknown')).status).toBe(404);
});

test('enquiries cannot be converted into visitor passes', async () => {
  mockContacts.push({ formType: 'exhibitor-enquiry', payload: { visitorCode: 'diemex-enquiry', phone: '9876543210' } });
  expect((await scan('diemex-enquiry')).status).toBe(404);
  expect(mockPasses).toHaveLength(0);
});

test('a failed managed OTP resend preserves the prior verification session', async () => {
  const input = { ...phone, mobile: '9123456789' };
  expect((await request(app).post('/api/passes/send-otp').send(input)).status).toBe(200);
  const current = Date.now();
  jest.spyOn(Date, 'now').mockReturnValue(current + 46000);
  mockMessaging.sendOtp.mockResolvedValueOnce({ success: false, error: 'Temporary failure' });
  expect((await request(app).post('/api/passes/resend-otp').send(input)).status).toBe(502);
  expect((await request(app).post('/api/passes/verify-otp').send({ ...input, otp: '123456' })).status).toBe(200);
});

test('cancelled passes cannot be resent', async () => {
  const row = await pass();
  row.status = 'cancelled';
  const result = await request(app).post('/api/passes/resend-pass').send({ publicCode: row.publicCode, channel: 'whatsapp' });
  expect(result.status).toBe(403);
  expect(mockMessaging.sendPass).not.toHaveBeenCalled();
});

test('existing contact clients issue scannable email passes without triggering Twilio', async () => {
  const result = await request(app).post('/api/contact').send({
    formType: 'visitor-registration', firstName: 'Legacy', lastName: 'Client',
    email: 'legacy-client@example.test', phone: '9876543210', companyName: 'Legacy'
  });
  expect(result.status).toBe(202);
  expect(result.body.pass.channel).toBe('email');
  expect(mockMessaging.sendPass).not.toHaveBeenCalled();
  expect((await scan('https://example.test/api/contact/pass/' + result.body.pass.registrationNumber)).status).toBe(200);
});

test('invalid verification tokens and resend channels are rejected', async () => {
  expect((await request(app).post('/api/contact').send({
    formType: 'visitor-registration', email: phone.email, verificationToken: 'invalid'
  })).status).toBe(401);
  expect((await request(app).post('/api/passes/resend-pass').send({ publicCode: 'test', channel: 'fax' })).status).toBe(400);
});

test('visitor form submissions without OTP store contact details and send the thank-you email', async () => {
  const result = await request(app).post('/api/contact').send({
    formType: 'visitor-registration', firstName: 'Test', lastName: 'Visitor',
    contactPerson: 'Test Visitor', email: 'visitor@example.test',
    phone: '9876543210', countryCode: '+91', companyName: 'Test Company',
    jobTitle: 'Engineer', profile: 'Automotive', country: 'India',
    state: 'Maharashtra', city: 'Pune'
  });
  expect(result.status).toBe(202);
  await new Promise((resolve) => setImmediate(resolve));
  expect(mockContacts).toHaveLength(1);
  expect(mockContacts[0]).toMatchObject({
    formType: 'visitor-registration', emailStatus: 'sent',
    name: 'Test Visitor', company: 'Test Company'
  });
  expect(require('../src/services/EmailService').sendEmailWithAttachment).toHaveBeenCalledWith(
    expect.objectContaining({
      to: 'visitor@example.test',
      subject: 'Visitor Registration Confirmed - DIEMEX 2027'
    })
  );
  expect(mockMessaging.sendOtp).not.toHaveBeenCalled();
});

test('contact storage errors are reported instead of acknowledging an unsaved registration', async () => {
  mockContactModel.create.mockRejectedValueOnce(new Error('Contact database unavailable'));
  const result = await request(app).post('/api/contact').send({
    formType: 'visitor-registration', firstName: 'Test', email: 'visitor@example.test',
    phone: '9876543210', countryCode: '+91', companyName: 'Test Company'
  });
  expect(result.status).toBe(500);
  expect(result.body.success).toBe(false);
  expect(require('../src/services/EmailService').sendEmailWithAttachment).not.toHaveBeenCalled();
});

test('email provider failures are recorded against the saved visitor registration', async () => {
  require('../src/services/EmailService').sendEmailWithAttachment
    .mockResolvedValueOnce({ success: false, error: 'Email provider unavailable' });
  const result = await request(app).post('/api/contact').send({
    formType: 'visitor-registration', firstName: 'Test', email: 'visitor@example.test',
    phone: '9876543210', countryCode: '+91', companyName: 'Test Company'
  });
  expect(result.status).toBe(500);
  expect(result.body.success).toBe(false);
  expect(mockContacts[0].emailStatus).toBe('failed');
});

test('registration acknowledgement waits for the email provider while the contact remains stored', async () => {
  let acceptEmail;
  let acknowledged = false;
  require('../src/services/EmailService').sendEmailWithAttachment.mockImplementationOnce(
    () => new Promise((resolve) => { acceptEmail = resolve; })
  );
  const pending = request(app).post('/api/contact').send({
    formType: 'visitor-registration', firstName: 'Test', email: 'visitor@example.test',
    phone: '9876543210', countryCode: '+91', companyName: 'Test Company'
  }).then((result) => { acknowledged = true; return result; });
  for (let attempt = 0; !acceptEmail && attempt < 100; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  expect(acceptEmail).toEqual(expect.any(Function));
  expect(mockContacts[0].emailStatus).toBe('pending');
  expect(acknowledged).toBe(false);
  acceptEmail({ success: true });
  expect((await pending).status).toBe(202);
  expect(mockContacts[0].emailStatus).toBe('sent');
});

test.each([
  [undefined, 'https://www.diemex.in'],
  ['https://www.diemex.in/', 'https://www.diemex.in'],
  ['http://localhost:3000', 'http://localhost:3000']
])('SMS registration saves a pass and delivers its badge link with FRONTEND_URL=%s', async (configured, origin) => {
  const previous = process.env.FRONTEND_URL;
  if (configured === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = configured;
  try {
    const session = await verified('sms');
    const response = await request(app).post('/api/passes/register').send({
      verificationToken: session.verificationToken, name: 'SMS Visitor', company: 'Company', interests: ['Automotive']
    });
    expect(response.status).toBe(200);
    expect(response.body.pass.channel).toBe('sms');
    const passUrl = origin + '/passes/view/' + response.body.pass.publicCode;
    expect(response.body.pass.passUrl).toBe(passUrl);
    expect(response.body.delivery).toMatchObject({ success: true, channel: 'sms', passUrl, status: 'queued' });
    expect(mockMessaging.sendPass).toHaveBeenCalledWith(expect.objectContaining({
      phone: '+91' + session.input.mobile, channel: 'sms', passUrl, mediaUrl: null
    }));
    expect(mockPasses[0]).toMatchObject({ channel: 'sms', sentVia: 'sms', sentStatus: 'queued', status: 'issued' });
  } finally {
    if (previous === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previous;
  }
});


describe('WhatsApp portrait badge delivery', () => {
  beforeEach(() => {
    jest.replaceProperty(process, 'env', {
      ...process.env, CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'test-key'
    });
  });

  test('uploads the full badge and sends it with the original pass QR payload', async () => {
    const row = await pass();
    row.qrPayload = 'DIEMEX 2027\nVisitor\nCode: REG-DMX-TEST';
    const result = await request(app).post('/api/passes/resend-pass')
      .send({ publicCode: row.publicCode, channel: 'whatsapp' });
    expect(result.status).toBe(200);
    expect(result.body.delivery).toMatchObject({ success: true, channel: 'whatsapp', status: 'queued' });
    expect(mockBadgeRenderer.renderVisitorBadge).toHaveBeenCalledWith({
      design: 'design1', designation: undefined, country: undefined,
      name: row.name, company: row.company, registrationNumber: row.registrationNumber,
      qrPayload: row.qrPayload,
      event: { name: 'DIEMEX 2027', dates: '24\u201326 Mar 2027', venue: 'Auto Cluster Exhibition Centre, Pune' }
    });
    expect(mockCloudinary.uploadImage).toHaveBeenCalledWith(Buffer.from('full-badge-png'), {
      folder: 'visitor-passes', public_id: 'badge-design1-REG-DMX-TEST', overwrite: true, format: 'png'
    });
    expect(mockMessaging.sendPass).toHaveBeenCalledWith(expect.objectContaining({
      name: row.name, registrationNumber: row.registrationNumber,
      mediaUrl: result.body.delivery.mediaUrl
    }));
    expect(row).toMatchObject({ status: 'issued', sentStatus: 'queued', sentVia: 'whatsapp' });
  });

  test.each(['render', 'upload', 'missing URL', 'settings'])('%s failure preserves the registration for retry', async (failure) => {
    const row = await pass();
    if (failure === 'settings') mockBadgeSettingModel.findByPk.mockRejectedValueOnce(new Error('Settings unavailable'));
    if (failure === 'render') mockBadgeRenderer.renderVisitorBadge.mockRejectedValueOnce(new Error('Render unavailable'));
    if (failure === 'upload') mockCloudinary.uploadImage.mockRejectedValueOnce(new Error('Upload unavailable'));
    if (failure === 'missing URL') mockCloudinary.uploadImage.mockResolvedValueOnce({});
    const result = await request(app).post('/api/passes/resend-pass')
      .send({ publicCode: row.publicCode, channel: 'whatsapp' });
    expect(result.status).toBe(200);
    expect(result.body.delivery).toMatchObject({ success: false, mediaUrl: null });
    expect(result.body.delivery.error).toEqual(expect.any(String));
    expect(mockMessaging.sendPass).not.toHaveBeenCalled();
    expect(row).toMatchObject({ status: 'issued', sentStatus: 'failed', sentVia: 'whatsapp' });
    expect(mockPasses).toHaveLength(1);
    expect(row.save).toHaveBeenCalled();
    const retry = await request(app).post('/api/passes/resend-pass')
      .send({ publicCode: row.publicCode, channel: 'whatsapp' });
    expect(retry.body.delivery.success).toBe(true);
    expect(row.sentStatus).toBe('queued');
    expect(mockPasses).toHaveLength(1);
  });
});


describe('admin badge design selection', () => {
  test('settings and previews require an active admin', async () => {
    expect((await request(app).get('/api/passes/badge-design')).status).toBe(401);
    expect((await request(app).put('/api/passes/badge-design').send({ design: 'design2' })).status).toBe(401);
    expect((await request(app).get('/api/passes/badge-designs/design2/preview')).status).toBe(401);
    for (const role of ['viewer', 'editor', 'exhibitor', 'inactive']) {
      expect((await request(app).put('/api/passes/badge-design').set('Authorization', token(role)).send({ design: 'design2' })).status).toBe(403);
    }
    expect(mockBadgeSettingModel.upsert).not.toHaveBeenCalled();
  });

  test('defaults to Design 1 and persists a selection for subsequent reads', async () => {
    const initial = await request(app).get('/api/passes/badge-design').set('Authorization', token());
    expect(initial.status).toBe(200);
    expect(initial.body.design).toBe('design1');
    expect(initial.body.designs.map((item) => item.id)).toEqual(['design1', 'design2']);
    const saved = await request(app).put('/api/passes/badge-design').set('Authorization', token()).send({ design: 'design2' });
    expect(saved.status).toBe(200);
    expect(saved.body.design).toBe('design2');
    expect(mockBadgeSettingModel.upsert).toHaveBeenCalledWith({ id: 'visitor', design: 'design2', updatedBy: 'admin' });
    expect((await request(app).get('/api/passes/badge-design').set('Authorization', token())).body.design).toBe('design2');
    expect(mockMessaging.sendPass).not.toHaveBeenCalled();
  });

  test.each(['design3', '__proto__', null])('rejects invalid design %s without changing the saved setting', async (design) => {
    const response = await request(app).put('/api/passes/badge-design').set('Authorization', token()).send({ design });
    expect(response.status).toBe(400);
    expect(mockBadgeSettingModel.upsert).not.toHaveBeenCalled();
  });

  test('does not acknowledge a design that failed to save', async () => {
    mockBadgeSettingModel.upsert.mockRejectedValueOnce(new Error('Database unavailable'));
    const response = await request(app).put('/api/passes/badge-design').set('Authorization', token()).send({ design: 'design2' });
    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect((await request(app).get('/api/passes/badge-design').set('Authorization', token())).body.design).toBe('design1');
  });

  test('previews render the requested sample design without sending a message or changing the active selection', async () => {
    const response = await request(app).get('/api/passes/badge-designs/design2/preview').set('Authorization', token());
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^image\/png/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(mockBadgeRenderer.renderVisitorBadge).toHaveBeenCalledWith(expect.objectContaining({
      design: 'design2', registrationNumber: 'DEMO-DMX-2027', designation: 'Engineer', country: 'India'
    }));
    expect(mockBadgeSettingModel.upsert).not.toHaveBeenCalled();
    expect(mockMessaging.sendPass).not.toHaveBeenCalled();
    expect((await request(app).get('/api/passes/badge-designs/unknown/preview').set('Authorization', token())).status).toBe(400);
  });

  test('switching either way changes the next WhatsApp image while reusing the saved registration and QR', async () => {
    jest.replaceProperty(process, 'env', { ...process.env, CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: 'key' });
    const row = await pass();
    row.designation = 'Engineer'; row.country = 'India'; row.qrPayload = 'Code: REG-DMX-TEST';
    for (const design of ['design2', 'design1']) {
      await request(app).put('/api/passes/badge-design').set('Authorization', token()).send({ design });
      const response = await request(app).post('/api/passes/resend-pass').send({ publicCode: row.publicCode, channel: 'whatsapp' });
      expect(response.body.delivery).toMatchObject({ success: true, badgeDesign: design });
      expect(mockBadgeRenderer.renderVisitorBadge).toHaveBeenLastCalledWith(expect.objectContaining({
        design, designation: row.designation, country: row.country, qrPayload: row.qrPayload
      }));
      expect(mockCloudinary.uploadImage).toHaveBeenLastCalledWith(expect.any(Buffer), expect.objectContaining({
        public_id: 'badge-' + design + '-REG-DMX-TEST'
      }));
      expect(mockMessaging.sendPass).toHaveBeenLastCalledWith(expect.objectContaining({ mediaUrl: response.body.delivery.mediaUrl }));
    }
    expect(mockPasses).toHaveLength(1);
    expect(row.registrationNumber).toBe('REG-DMX-TEST');
    expect(row.qrPayload).toBe('Code: REG-DMX-TEST');
  });
});
