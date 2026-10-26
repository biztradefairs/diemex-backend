const DEFAULT_BADGE_DESIGN = 'design1';
const BADGE_DESIGNS = [
  { id: 'design1', name: 'Design 1', description: 'Angled blue footer with red accents and a large visitor name.' },
  { id: 'design2', name: 'Design 2', description: 'Green badge with centred QR, visitor details and a green visitor band.' }
];
const isBadgeDesign = (design) => BADGE_DESIGNS.some((item) => item.id === design);
module.exports = { DEFAULT_BADGE_DESIGN, BADGE_DESIGNS, isBadgeDesign };
