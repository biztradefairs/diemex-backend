const { WIDTH, HEIGHT, cleanText, textBlock: drawText, trackedText, drawQr } = require('./artwork');
const GREEN = '#00A651';
const DARK_GREEN = '#064E3B';
const textBlock = (ctx, text, options) => drawText(ctx, text, { color: DARK_GREEN, ...options });

module.exports = function drawDesign2(ctx, logo, pass) {
  const { name, designation, company, country, registrationNumber, qrPayload } = pass;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const logoWidth = 440;
  const logoHeight = logoWidth * logo.height / logo.width;
  ctx.drawImage(logo, (WIDTH - logoWidth) / 2, 76, logoWidth, logoHeight);
  ctx.fillStyle = GREEN;
  ctx.fillRect(32, 358, WIDTH - 64, 6);

  textBlock(ctx, cleanText(name).toUpperCase(), {
    top: 428, height: 100, width: 816, size: 58, minSize: 32, maxLines: 2, weight: 800, color: GREEN,
  });
  let detailsTop = 546;
  if (cleanText(designation)) {
    textBlock(ctx, cleanText(designation).toUpperCase(), {
      top: detailsTop, height: 44, width: 816, size: 34, minSize: 23, maxLines: 1, weight: 450,
    });
    detailsTop += 56;
  }
  textBlock(ctx, cleanText(company).toUpperCase(), {
    top: detailsTop, height: 62, width: 820, size: 35, minSize: 23, maxLines: 2, weight: 450,
  });
  if (cleanText(country)) {
    textBlock(ctx, cleanText(country).toUpperCase(), {
      top: detailsTop + 72, height: 40, width: 816, size: 32, minSize: 23, maxLines: 1, weight: 450,
    });
  }

  // There is no profile image; the QR is centred across the full badge width.
  drawQr(ctx, qrPayload, { x: 243, y: 728, size: 414 }, DARK_GREEN, 'H');
  textBlock(ctx, 'User ID: ' + cleanText(registrationNumber), {
    top: 1148, height: 44, width: 820, size: 26, minSize: 17, maxLines: 1, weight: 450,
  });
  ctx.fillStyle = GREEN;
  ctx.fillRect(32, 1236, WIDTH - 64, 128);
  trackedText(ctx, 'VISITOR', WIDTH / 2, 1300, 84, 3, '#FFFFFF', 700);
};
