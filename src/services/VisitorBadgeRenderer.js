const path = require('path');
const QRCode = require('qrcode');

const WIDTH = 900;
const HEIGHT = 1500;
const FONT = '"Diemex Inter"';
const INK = '#102D50';
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

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
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
  weight = 500, color = INK,
}) {
  const value = cleanText(text);
  if (!value) return;
  let lines;
  let fontSize = size;
  for (; fontSize >= minSize; fontSize -= 1) {
    ctx.font = `${weight} ${fontSize}px ${FONT}`;
    lines = wrapLines(ctx, value, width);
    if (lines.length <= maxLines && lines.length * fontSize * 1.2 <= height) break;
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
  const lineHeight = fontSize * 1.2;
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
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'H' });
  const quietZone = 4;
  const area = { x: 165, y: 708, size: 570 };
  const fittedModuleSize = Math.floor(area.size / (qr.modules.size + quietZone * 2));
  // Multiples of three also stay crisp at common 600px and 450px viewing widths.
  const moduleSize = fittedModuleSize >= 6 ? Math.floor(fittedModuleSize / 3) * 3 : fittedModuleSize;
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

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, '#081C36');
  background.addColorStop(0.6, '#123D6D');
  background.addColorStop(1, '#0758A6');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle tooling-inspired geometry stays outside the visitor details and QR.
  ctx.strokeStyle = '#FFFFFF14';
  ctx.lineWidth = 1.5;
  [220, 280, 340].forEach((radius) => {
    ctx.beginPath();
    ctx.arc(WIDTH + 45, -30, radius, 0, Math.PI * 2);
    ctx.stroke();
  });
  [42, WIDTH - 42].forEach((x) => {
    ctx.strokeStyle = '#FFFFFF45';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, 33, 10, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Preserve the full-colour third-edition logo, including its exhibition title.
  roundedRect(ctx, 36, 44, 828, 220, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  const logoWidth = 445;
  const logoHeight = logoWidth * logo.height / logo.width;
  ctx.drawImage(logo, 68, 52, logoWidth, logoHeight);

  roundedRect(ctx, 654, 90, 168, 120, 18);
  ctx.fillStyle = '#F0F5FB';
  ctx.fill();
  ctx.strokeStyle = '#D8E3EF';
  ctx.lineWidth = 1;
  ctx.stroke();
  trackedText(ctx, 'EVENT YEAR', 738, 118, 13, 1.8, '#52657B');
  ctx.font = `750 51px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.fillText(cleanText(event.name).match(/20\d{2}/)?.[0] || 'DIEMEX', 738, 164);

  ctx.fillStyle = '#0B4B97';
  ctx.fillRect(0, 274, WIDTH, 112);
  textBlock(ctx, cleanText(event.dates).toUpperCase(), {
    top: 284, height: 44, size: 32, minSize: 24, maxLines: 1, weight: 750, color: '#FFFFFF',
  });
  textBlock(ctx, event.venue, {
    top: 334, height: 32, width: 820, size: 22, minSize: 17, maxLines: 1, color: '#E5EFFB',
  });
  ctx.fillStyle = '#F43F4C';
  ctx.fillRect(0, 380, WIDTH, 6);

  roundedRect(ctx, 36, 416, 828, 954, 30);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#DCE6F0';
  ctx.lineWidth = 1;
  ctx.stroke();

  trackedText(ctx, 'DIGITAL VISITOR BADGE', WIDTH / 2, 460, 16, 3, '#E53846', 700);
  textBlock(ctx, name, { top: 488, height: 112, size: 54, minSize: 28, weight: 750 });
  textBlock(ctx, company, {
    top: 608, height: 68, size: 30, minSize: 20, weight: 500, color: '#52657B',
  });
  ctx.fillStyle = '#F43F4C';
  ctx.fillRect(396, 690, 108, 4);

  drawQr(ctx, qrPayload);
  trackedText(ctx, 'SCAN AT ENTRY', WIDTH / 2, 1303, 15, 2.5, '#65788D');
  textBlock(ctx, registrationNumber, {
    top: 1322, height: 30, size: 23, minSize: 15, maxLines: 1, weight: 650,
  });

  const footer = ctx.createLinearGradient(0, 1402, WIDTH, HEIGHT);
  footer.addColorStop(0, '#D92739');
  footer.addColorStop(1, '#F14B50');
  ctx.fillStyle = footer;
  ctx.fillRect(0, 1402, WIDTH, HEIGHT - 1402);
  trackedText(ctx, 'VISITOR', WIDTH / 2, 1452, 65, 10, '#FFFFFF', 800);

  return canvas.encode('png');
}

module.exports = { renderVisitorBadge, WIDTH, HEIGHT };
