function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

const RATES = {
  shellPerSqm: 11000,
  barePerSqm: 10000,
  twoSidePercent: 15,
  threeSidePercent: 25,
  gstPercent: 18,
  advancePercent: 30,
}

const APPLICATION_RULES = [
  'Space is allotted on a first-come, first-served basis and is subject to full payment as per the schedule on this form.',
  'Advance payment of 30% of the total amount payable is due on confirmation of space. The balance is payable as per the organiser’s payment schedule.',
  'All amounts are in Indian Rupees. GST @ 18% (or the rate applicable at the time of invoicing) will be charged extra on space and open-side charges.',
  'Shell scheme space is charged at ₹11,000 per sq.m. Bare space is charged at ₹10,000 per sq.m. Open-side charges are 15% of space charges for 2-side open and 25% for 3-side open.',
  'Stall numbers, location, and layout are assigned by the organiser and may be changed if required for overall floor-plan, safety, or operational reasons.',
  'The exhibitor shall not sublet, assign, or share the allotted space with any other company without prior written approval of the organiser.',
  'Cancellation, reduction of space, or withdrawal must be informed in writing. Refunds, if any, are as per the organiser’s cancellation policy and are not guaranteed.',
  'The exhibitor is responsible for the safety of its staff, exhibits, and visitors at the stall, and for compliance with venue, fire, electrical, and security regulations.',
  'Construction, branding, and height of bare-space stalls must follow the exhibitor manual. Shell-scheme exhibitors must not damage or alter standard booth fittings.',
  'The organiser is not liable for loss, damage, delay, or interruption caused by circumstances beyond its reasonable control.',
  'By downloading, signing, and uploading this application, the exhibitor confirms that the company information and participation details are correct and accepts these rules and regulations.',
  'Disputes, if any, shall be subject to the jurisdiction of the courts at the organiser’s registered office.',
]

function calculateApplicationTotals(form = {}) {
  const shellSqm = form.shellScheme ? round2(form.shellSqm) : 0
  const bareSqm = form.bareSpace ? round2(form.bareSqm) : 0
  const shellAmount = round2(shellSqm * RATES.shellPerSqm)
  const bareAmount = round2(bareSqm * RATES.barePerSqm)
  const spaceCharges = round2(shellAmount + bareAmount)
  const twoSideAmount = form.twoSideOpen ? round2((spaceCharges * RATES.twoSidePercent) / 100) : 0
  const threeSideAmount = form.threeSideOpen ? round2((spaceCharges * RATES.threeSidePercent) / 100) : 0
  const openSideCharges = round2(twoSideAmount + threeSideAmount)
  const total = round2(spaceCharges + openSideCharges)
  const gstAmount = round2((total * RATES.gstPercent) / 100)
  const totalPayable = round2(total + gstAmount)
  const advance = round2((totalPayable * RATES.advancePercent) / 100)
  const balance = round2(totalPayable - advance)

  return {
    shellSqm,
    bareSqm,
    shellAmount,
    bareAmount,
    spaceCharges,
    twoSideAmount,
    threeSideAmount,
    openSideCharges,
    total,
    gstAmount,
    totalPayable,
    advance,
    balance,
    rates: RATES,
  }
}

function emptyApplicationForm() {
  return {
    gstNo: '',
    companyName: '',
    contactPerson: '',
    designation: '',
    address: '',
    city: '',
    pincode: '',
    state: '',
    telephone: '',
    mobile: '',
    email: '',
    shellScheme: false,
    shellSqm: '',
    bareSpace: false,
    bareSqm: '',
    twoSideOpen: false,
    threeSideOpen: false,
    stallNo: '',
    bookedBy: '',
    date: '',
    place: '',
    confirmation: false,
    rubberStamp: false,
    status: 'draft',
    sentAt: null,
    signedUpload: null,
  }
}

function prefillApplicationForm(exhibitor, existing) {
  const base = { ...emptyApplicationForm(), ...(existing || {}) }
  if (!existing || !existing.companyName) {
    base.companyName = exhibitor.company || base.companyName
    base.contactPerson = exhibitor.name || base.contactPerson
    base.email = exhibitor.email || base.email
    base.mobile = exhibitor.phone || base.mobile
    base.address = exhibitor.address || base.address
    base.stallNo = exhibitor.boothNumber || base.stallNo
  }
  if (!base.date) {
    base.date = new Date().toISOString().slice(0, 10)
  }
  return { ...base, totals: calculateApplicationTotals(base) }
}

function sanitizeApplicationForm(body = {}, existing = {}) {
  const form = {
    ...emptyApplicationForm(),
    ...existing,
    gstNo: String(body.gstNo ?? existing.gstNo ?? ''),
    companyName: String(body.companyName ?? existing.companyName ?? ''),
    contactPerson: String(body.contactPerson ?? existing.contactPerson ?? ''),
    designation: String(body.designation ?? existing.designation ?? ''),
    address: String(body.address ?? existing.address ?? ''),
    city: String(body.city ?? existing.city ?? ''),
    pincode: String(body.pincode ?? existing.pincode ?? ''),
    state: String(body.state ?? existing.state ?? ''),
    telephone: String(body.telephone ?? existing.telephone ?? ''),
    mobile: String(body.mobile ?? existing.mobile ?? ''),
    email: String(body.email ?? existing.email ?? ''),
    shellScheme: Boolean(body.shellScheme),
    shellSqm: body.shellSqm ?? existing.shellSqm ?? '',
    bareSpace: Boolean(body.bareSpace),
    bareSqm: body.bareSqm ?? existing.bareSqm ?? '',
    twoSideOpen: Boolean(body.twoSideOpen),
    threeSideOpen: Boolean(body.threeSideOpen),
    stallNo: String(body.stallNo ?? existing.stallNo ?? ''),
    bookedBy: String(body.bookedBy ?? existing.bookedBy ?? ''),
    date: String(body.date ?? existing.date ?? ''),
    place: String(body.place ?? existing.place ?? ''),
    confirmation: Boolean(body.confirmation),
    rubberStamp: Boolean(body.rubberStamp),
    status: existing.status === 'sent' ? 'sent' : 'draft',
    sentAt: existing.sentAt || null,
    signedUpload: existing.signedUpload || null,
  }

  if (form.twoSideOpen && form.threeSideOpen) {
    form.threeSideOpen = false
  }

  form.totals = calculateApplicationTotals(form)
  return form
}

module.exports = {
  RATES,
  APPLICATION_RULES,
  round2,
  calculateApplicationTotals,
  emptyApplicationForm,
  prefillApplicationForm,
  sanitizeApplicationForm,
}
