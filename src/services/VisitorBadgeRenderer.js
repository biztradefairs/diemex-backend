const path = require('path');
const QRCode = require('qrcode');

const WIDTH = 900;
const HEIGHT = 1428;
const FONT = '"Diemex Inter"';
const INK = '#003875';
const BLUE = '#004A96';
const RED = '#E0161D';
const ASSETS = path.join(__dirname, '..', 'assets', 'badge');
let artwork;

function loadArtwork() {
  if (!artwork) {
    // Load the native renderer only when a badge is requested, not during app startup.
    const canvas = require('@napi-rs/canvas');
    if (!canvas.GlobalFonts.registerFromPath(path.join(ASSETS, 'Inter.ttf'), 'Diemex Inter')) {
      throw new Error('The visitor badge font could not be loaded.');
    }
    artwork = canvas.loadImage(path.join(ASSETS, 'diemex-logo.png'))
      .then((logo) => ({ createCanvas: canvas.createCanvas, logo }))
      .catch((error) => { artwork = null; throw error; });
  }
  return artwork;
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

function wrapLines(ctx, text, width) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    // Break long company names/identifiers without splitting surrogate pairs.
    for (const character of Array.from(word)) {
      if (line && ctx.measureText(line + character).width > width) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textBlock(ctx, text, {
  top, height, width = 724, size = 30, minSize = 20, maxLines = 2,
  weight = 500, color = INK, lineSpacing = 1.2,
}) {
  const value = cleanText(text);
  if (!value) return;
  let lines;
  let fontSize = size;
  for (; fontSize >= minSize; fontSize -= 1) {
    ctx.font = `${weight} ${fontSize}px ${FONT}`;
    lines = wrapLines(ctx, value, width);
    if (lines.length <= maxLines && lines.length * fontSize * lineSpacing <= height) break;
  }
  fontSize = Math.max(fontSize, minSize);
  ctx.font = `${weight} ${fontSize}px ${FONT}`;
  lines = wrapLines(ctx, value, width);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > width) {
      last = Array.from(last).slice(0, -1).join('');
    }
    lines[maxLines - 1] = `${last}…`;
  }
  const lineHeight = fontSize * lineSpacing;
  const firstY = top + height / 2 - (lines.length - 1) * lineHeight / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect((WIDTH - width) / 2, top, width, height);
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  lines.forEach((line, index) => ctx.fillText(line, WIDTH / 2, firstY + index * lineHeight));
  ctx.restore();
}

function trackedText(ctx, text, centerX, y, size, tracking, color, weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const letters = Array.from(text);
  const widths = letters.map((letter) => ctx.measureText(letter).width);
  let x = centerX - (widths.reduce((sum, width) => sum + width, 0) + tracking * (letters.length - 1)) / 2;
  letters.forEach((letter, index) => {
    ctx.fillText(letter, x, y);
    x += widths[index] + tracking;
  });
}

function drawQr(ctx, payload) {
  // Keep the full registration payload readable in the reference's compact QR frame.
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'Q' });
  const quietZone = 4;
  const area = { x: 294, y: 888, size: 312 };
  const fittedModuleSize = Math.floor(area.size / (qr.modules.size + quietZone * 2));
  // Prefer even modules so half-width phone previews retain whole pixels.
  const moduleSize = fittedModuleSize >= 4 ? fittedModuleSize - fittedModuleSize % 2 : fittedModuleSize;
  if (moduleSize < 2) throw new Error('The visitor QR payload is too large for a scannable badge.');
  const totalSize = moduleSize * (qr.modules.size + quietZone * 2);
  const left = area.x + Math.floor((area.size - totalSize) / 2);
  const top = area.y + Math.floor((area.size - totalSize) / 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(area.x, area.y, area.size, area.size);
  ctx.fillStyle = INK;
  // Integer-sized modules and a four-module white margin keep the QR crisp and scannable.
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let column = 0; column < qr.modules.size; column += 1) {
      if (qr.modules.get(row, column)) {
        ctx.fillRect(left + (column + quietZone) * moduleSize,
          top + (row + quietZone) * moduleSize, moduleSize, moduleSize);
      }
    }
  }
}

async function renderVisitorBadge({ name, company, registrationNumber, qrPayload, event }) {
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

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Match the reference's flat top band and narrow accent stripe.
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, WIDTH, 79);
  ctx.fillStyle = RED;
  ctx.fillRect(0, 79, WIDTH, 18);

  // Keep the supplied logo's colours, aspect ratio and included exhibition title.
  const logoWidth = 490;
  const logoHeight = logoWidth * logo.height / logo.width;
  ctx.drawImage(logo, (WIDTH - logoWidth) / 2, 316 - logoHeight / 2, logoWidth, logoHeight);

  textBlock(ctx, cleanText(name).toUpperCase(), {
    top: 544, height: 184, width: 720, size: 82, minSize: 38,
    maxLines: 2, weight: 800, color: BLUE, lineSpacing: 1.05,
  });
  textBlock(ctx, company, {
    top: 734, height: 68, width: 790, size: 42, minSize: 25, maxLines: 2, weight: 400,
  });
  textBlock(ctx, `${cleanText(event.name)} | ${cleanText(event.dates)}`, {
    top: 807, height: 28, width: 800, size: 22, minSize: 16,
    maxLines: 1, weight: 650, color: BLUE,
  });
  textBlock(ctx, event.venue, {
    top: 844, height: 26, width: 800, size: 20, minSize: 16, maxLines: 1, weight: 400,
  });

  // The V-shaped colour block and its accent follow the reference silhouette.
  ctx.beginPath();
  ctx.moveTo(0, 901);
  ctx.lineTo(WIDTH / 2, 1076);
  ctx.lineTo(WIDTH, 901);
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.lineTo(0, HEIGHT);
  ctx.closePath();
  ctx.fillStyle = RED;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, 919);
  ctx.lineTo(WIDTH / 2, 1094);
  ctx.lineTo(WIDTH, 919);
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.lineTo(0, HEIGHT);
  ctx.closePath();
  ctx.fillStyle = BLUE;
  ctx.fill();

  // The white QR square overlaps the V, just as it does in the supplied design.
  drawQr(ctx, qrPayload);
  textBlock(ctx, registrationNumber, {
    top: 1222, height: 28, width: 760, size: 20, minSize: 14,
    maxLines: 1, weight: 600, color: '#FFFFFF',
  });
  trackedText(ctx, 'VISITOR', WIDTH / 2, 1332, 124, 6, '#FFFFFF', 800);

  return canvas.encode('png');
}

module.exports = { renderVisitorBadge, WIDTH, HEIGHT };
