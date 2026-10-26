const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { BinaryBitmap, HybridBinarizer, RGBLuminanceSource, MultiFormatReader,
  DecodeHintType, BarcodeFormat } = require('@zxing/library');
const { renderVisitorBadge, WIDTH, HEIGHT } = require('../src/services/VisitorBadgeRenderer');

const event = {
  name: 'DIEMEX 2027', dates: '24\u201326 Mar 2027', venue: 'Auto Cluster Exhibition Centre, Pune'
};
function visitor(overrides = {}) {
  const details = {
    name: 'Ananya Sharma', company: 'Precision Engineering Pvt. Ltd.',
    registrationNumber: 'REG-DMX-28082026-750281', ...overrides
  };
  return {
    ...details, event,
    qrPayload: [event.name, 'Visitor', `Name: ${details.name}`, `Company: ${details.company}`,
      `Code: ${details.registrationNumber}`, `Date: ${event.dates}`].join('\n')
  };
}
async function decodeBadge(png, width = WIDTH) {
  const image = await loadImage(png);
  const height = Math.round(image.height * width / image.width);
  const ctx = createCanvas(width, height).getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const pixels = new Int32Array(width * height);
  for (let i = 0; i < pixels.length; i += 1) {
    pixels[i] = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
  }
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, height)));
  return new MultiFormatReader().decode(bitmap, new Map([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]], [DecodeHintType.TRY_HARDER, true]
  ])).getText();
}

test('renders a WhatsApp-sized portrait PNG whose complete image scans to the original payload', async () => {
  const details = visitor();
  const png = await renderVisitorBadge(details);
  const image = await loadImage(png);
  expect([image.width, image.height]).toEqual([900, 1500]);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(png.length).toBeLessThan(5 * 1024 * 1024);
  expect(await decodeBadge(png)).toBe(details.qrPayload);
  expect(await decodeBadge(png, 600)).toBe(details.qrPayload);
  expect(await decodeBadge(png, 450)).toBe(details.qrPayload);
});

test('long visitor details fit without obscuring the QR on a phone-sized badge', async () => {
  const details = visitor({
    name: 'Dr. Ananya Chandra Shekhar Narayanaswamy Subramanian & Associates',
    company: 'Precision Engineering, Research & Development <India> Pvt. Ltd. - International Tooling and Manufacturing Division'
  });
  expect(await decodeBadge(await renderVisitorBadge(details), 600)).toBe(details.qrPayload);
});

test('missing optional company details still produce a scannable badge', async () => {
  const details = visitor({ company: '' });
  expect(await decodeBadge(await renderVisitorBadge(details))).toBe(details.qrPayload);
});

test('rejects a missing QR and an oversized payload instead of producing an unusable badge', async () => {
  await expect(renderVisitorBadge({ ...visitor(), qrPayload: '' })).rejects.toThrow('QR payload are required');
  await expect(renderVisitorBadge({ ...visitor(), qrPayload: 'X'.repeat(5000) })).rejects.toThrow();
});
