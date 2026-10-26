const { WIDTH, HEIGHT, cleanText, loadArtwork } = require('./badges/artwork');
const { DEFAULT_BADGE_DESIGN, isBadgeDesign } = require('./badges/designs');
const renderers = { design1: require('./badges/design1'), design2: require('./badges/design2') };

async function renderVisitorBadge(input = {}) {
  const { name, registrationNumber, qrPayload, event, design = DEFAULT_BADGE_DESIGN } = input;
  if (!isBadgeDesign(design)) throw Object.assign(new Error('Choose Design 1 or Design 2.'), { status: 400 });
  if (!cleanText(name) || !cleanText(registrationNumber) || !cleanText(qrPayload)) {
    throw new Error('Visitor name, registration number and QR payload are required for the badge.');
  }
  if (!event?.name || !event?.dates || !event?.venue) {
    throw new Error('Event name, dates and venue are required for the badge.');
  }
  const { createCanvas, logo } = await loadArtwork();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'middle';
  renderers[design](ctx, logo, input);
  return canvas.encode('png');
}

module.exports = { renderVisitorBadge, WIDTH, HEIGHT };
