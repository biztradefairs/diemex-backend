const fs = require('fs');
const path = require('path');
const { renderBadgePreview } = require('../src/services/VisitorBadgePreview');
const { BADGE_DESIGNS, isBadgeDesign } = require('../src/services/badges/designs');

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const flag = args.indexOf('--design');
  const design = flag === -1 ? 'design1' : args[flag + 1];
  if (!isBadgeDesign(design)) throw new Error('Use --design design1 or --design design2.');
  const target = args.find((value, index) => !value.startsWith('--') && (flag === -1 || index !== flag + 1));
  for (const id of all ? BADGE_DESIGNS.map((item) => item.id) : [design]) {
    const output = path.resolve(target || (all ? 'docs/previews/visitor-badge-' + id + '.png' : 'docs/previews/visitor-badge.png'));
    if (all && target) throw new Error('Use --all without an output filename.');
    const png = await renderBadgePreview(id);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, png);
    console.log(id + ' preview: ' + output + ' (' + png.length + ' bytes)');
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
