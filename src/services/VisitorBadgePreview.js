const { renderVisitorBadge } = require('./VisitorBadgeRenderer');

function renderBadgePreview(design = 'design1') {
  const name = 'Ananya Sharma';
  const company = 'Precision Engineering Pvt. Ltd.';
  const registrationNumber = 'DEMO-DMX-2027';
  const event = { name: 'DIEMEX 2027', dates: '24\u201326 Mar 2027', venue: 'Auto Cluster Exhibition Centre, Pune' };
  const qrPayload = [event.name, 'DESIGN PREVIEW - NOT VALID FOR ENTRY', 'Name: ' + name,
    'Company: ' + company, 'Code: ' + registrationNumber, 'Date: ' + event.dates].join('\n');
  return renderVisitorBadge({ design, name, company, designation: 'Engineer', country: 'India', registrationNumber, event, qrPayload });
}
module.exports = { renderBadgePreview };
