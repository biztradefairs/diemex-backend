const { WIDTH, HEIGHT, BLUE, RED, cleanText, textBlock, trackedText, drawQr } = require('./artwork');

module.exports = function drawDesign1(ctx, logo, { name, company, registrationNumber, qrPayload, event }) {
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

};
