const fs = require('fs');
const path = require('path');
const { renderVisitorBadge } = require('../src/services/VisitorBadgeRenderer');

async function main() {
  const output = path.resolve(process.argv[2] || 'docs/previews/visitor-badge.png');
  const name = 'Ananya Sharma';
  const company = 'Precision Engineering Pvt. Ltd.';
  const registrationNumber = 'DEMO-DMX-2027';
  const event = {
    name: 'DIEMEX 2027', dates: '24–26 Mar 2027', venue: 'Auto Cluster Exhibition Centre, Pune',
  };
  const qrPayload = [event.name, 'DESIGN PREVIEW - NOT VALID FOR ENTRY', `Name: ${name}`,
    `Company: ${company}`, `Code: ${registrationNumber}`, `Date: ${event.dates}`].join('\n');
  const png = await renderVisitorBadge({ name, company, registrationNumber, qrPayload, event });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, png);
  console.log(`Badge preview: ${output} (${png.length} bytes)`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
