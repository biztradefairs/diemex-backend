jest.mock('twilio', () => jest.fn());
jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));

let messaging;
let axios;
let verify;
const originalEnv = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  for (const key of Object.keys(process.env)) {
    if (/^(TWILIO_|MSG91_|WHATSAPP_)/.test(key)) delete process.env[key];
  }
  process.env.NODE_ENV = 'production';
  verify = {
    fetch: jest.fn().mockResolvedValue({ codeLength: 4 }),
    verifications: { create: jest.fn().mockResolvedValue({ status: 'pending' }) },
    verificationChecks: { create: jest.fn().mockResolvedValue({ status: 'approved' }) }
  };
  require('twilio').mockReturnValue({ verify: { v2: { services: jest.fn(() => verify) } } });
  axios = require('axios');
  axios.post.mockResolvedValue({ data: { sid: 'SM-test', status: 'queued' } });
  messaging = require('../src/services/PassMessagingService');
});
afterAll(() => { process.env = originalEnv; });

function account() {
  process.env.TWILIO_ACCOUNT_SID = 'AC' + '1'.repeat(32);
  process.env.TWILIO_AUTH_TOKEN = 'test-token';
}
function sender() {
  account();
  process.env.TWILIO_WHATSAPP_FROM = '+15005550006';
}
const visitor = {
  phone: '+919876543210', channel: 'whatsapp', name: 'Test Visitor',
  registrationNumber: 'REG-TEST', passUrl: 'https://example.test/passes/view/abc123',
  mediaUrl: 'https://example.test/qr.png'
};

test('missing production providers fail instead of reporting a sent message', async () => {
  expect(messaging.isConfigured('sms')).toBe(false);
  expect(messaging.isConfigured('whatsapp')).toBe(false);
  expect((await messaging.sendPass(visitor)).success).toBe(false);
  expect(axios.post).not.toHaveBeenCalled();
});

test('development simulation is explicitly reported', async () => {
  process.env.NODE_ENV = 'development';
  expect(await messaging.sendPass(visitor)).toMatchObject({ success: true, simulated: true, provider: 'dev' });
  expect(axios.post).not.toHaveBeenCalled();
});

test('Verify configuration works without a Programmable Messaging sender', async () => {
  account();
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VA-test';
  expect(messaging.isConfigured('sms', 'otp')).toBe(true);
  expect(messaging.isConfigured('sms', 'pass')).toBe(false);
  expect(await messaging.sendOtp({ phone: visitor.phone, channel: 'whatsapp' }))
    .toMatchObject({ success: true, managed: true, digits: 4 });
  expect(verify.verifications.create).toHaveBeenCalledWith({ to: visitor.phone, channel: 'whatsapp' });
  await messaging.sendOtp({ phone: visitor.phone, channel: 'sms' });
  expect(verify.fetch).toHaveBeenCalledTimes(1);
});

test('Twilio decides whether an OTP is approved', async () => {
  account();
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VA-test';
  verify.verificationChecks.create.mockResolvedValueOnce({ status: 'pending' });
  expect((await messaging.checkVerification({ phone: visitor.phone, code: '1234' })).approved).toBe(false);
  expect((await messaging.checkVerification({ phone: visitor.phone, code: '1234' })).approved).toBe(true);
});

test('approved pass templates send variables without free-form body or media parameters', async () => {
  sender();
  process.env.TWILIO_WHATSAPP_PASS_CONTENT_SID = 'HX-pass';
  const result = await messaging.sendPass(visitor);
  expect(result).toMatchObject({ success: true, messageSid: 'SM-test', status: 'queued' });
  const params = axios.post.mock.calls[0][1];
  expect(params.get('From')).toBe('whatsapp:+15005550006');
  expect(params.get('To')).toBe('whatsapp:' + visitor.phone);
  expect(params.get('ContentSid')).toBe('HX-pass');
  expect(JSON.parse(params.get('ContentVariables'))).toEqual({
    1: visitor.name, 2: visitor.registrationNumber, 3: visitor.passUrl
  });
  expect(params.has('Body')).toBe(false);
  expect(params.has('MediaUrl')).toBe(false);
});

test('template mappings support public URL suffixes and media placeholders', async () => {
  sender();
  process.env.TWILIO_WHATSAPP_PASS_CONTENT_SID = 'HX-pass';
  process.env.TWILIO_WHATSAPP_PASS_VARIABLES = '{"1":"publicCode","2":"mediaUrl"}';
  await messaging.sendPass(visitor);
  expect(JSON.parse(axios.post.mock.calls[0][1].get('ContentVariables')))
    .toEqual({ 1: 'abc123', 2: visitor.mediaUrl });
});

test('missing templates and invalid variable mappings do not send messages', async () => {
  sender();
  expect((await messaging.sendPass(visitor)).success).toBe(false);
  process.env.TWILIO_WHATSAPP_PASS_CONTENT_SID = 'HX-pass';
  process.env.TWILIO_WHATSAPP_PASS_VARIABLES = '{"1":"unknownField"}';
  expect((await messaging.sendPass(visitor)).error).toContain('Missing WhatsApp template value');
  expect(axios.post).not.toHaveBeenCalled();
});

test('Twilio errors are returned as delivery failures', async () => {
  sender();
  process.env.TWILIO_WHATSAPP_PASS_CONTENT_SID = 'HX-pass';
  axios.post.mockRejectedValueOnce({ response: { data: { message: 'Template not approved' } } });
  expect(await messaging.sendPass(visitor)).toMatchObject({ success: false, error: 'Template not approved' });
});
