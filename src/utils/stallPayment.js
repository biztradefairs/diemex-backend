function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100
}

function normalizePhaseStatus(status) {
  return ['pending', 'paid', 'overdue'].includes(status) ? status : 'pending'
}

function buildStallPayment(source = {}, existing = {}) {
  const stallCost = round2(source.stallCost ?? existing.stallCost ?? 0)
  const discount = round2(source.discount ?? existing.discount ?? 0)
  const gstPercent = round2(source.gstPercent ?? existing.gstPercent ?? 18)
  const afterDiscount = round2(Math.max(0, stallCost - discount))
  const gstAmount = round2((afterDiscount * gstPercent) / 100)
  const finalAmount = round2(afterDiscount + gstAmount)

  const percents = [30, 40, 30]
  const labels = ['Initial Payment', '2nd Payment', '3rd Payment']
  const incoming = Array.isArray(source.paymentPhases)
    ? source.paymentPhases
    : Array.isArray(existing.paymentPhases)
      ? existing.paymentPhases
      : []

  const first = round2(finalAmount * 0.3)
  const second = round2(finalAmount * 0.4)
  const third = round2(finalAmount - first - second)
  const amounts = [first, second, third]

  const paymentPhases = percents.map((percent, index) => {
    const prev =
      incoming.find((phase) => Number(phase?.phase) === index + 1) ||
      incoming[index] ||
      {}
    return {
      phase: index + 1,
      label: labels[index],
      percent,
      amount: amounts[index],
      dueDate: prev.dueDate || '',
      status: normalizePhaseStatus(prev.status),
      paidAt: prev.paidAt || '',
      orderId: prev.orderId || '',
      paymentId: prev.paymentId || '',
    }
  })

  return {
    stallCost,
    discount,
    gstPercent,
    gstAmount,
    afterDiscount,
    finalAmount,
    paymentPhases,
  }
}

function addDays(value, days) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function schedulePaymentPhases(payment, fromDate = new Date()) {
  const start = new Date(fromDate)
  return {
    ...payment,
    paymentPhases: (payment.paymentPhases || []).map((phase, index) => ({
      ...phase,
      dueDate: index === 0 ? addDays(start, 0) : index === 1 ? addDays(start, 15) : addDays(start, 30),
    })),
  }
}

function markPhasePaid(existing, phaseNumber, meta = {}) {
  const payment = buildStallPayment(existing, existing)
  const paidAt = meta.paidAt || new Date().toISOString()
  const paidPhaseNo = Number(phaseNumber)
  const already = payment.paymentPhases.find((phase) => Number(phase.phase) === paidPhaseNo)
  if (already && already.status === 'paid') {
    return payment
  }

  return {
    ...payment,
    paymentPhases: payment.paymentPhases.map((phase) => {
      const phaseNo = Number(phase.phase)
      if (phaseNo === paidPhaseNo) {
        return {
          ...phase,
          status: 'paid',
          paidAt,
          dueDate: phase.dueDate || addDays(paidAt, 0),
          orderId: meta.orderId || phase.orderId || '',
          paymentId: meta.paymentId || phase.paymentId || '',
        }
      }
      if (phase.status === 'paid') return phase
      if (paidPhaseNo === 1 && phaseNo === 2) {
        return { ...phase, dueDate: addDays(paidAt, 15) }
      }
      if (paidPhaseNo === 1 && phaseNo === 3) {
        return { ...phase, dueDate: addDays(paidAt, 30) }
      }
      if (paidPhaseNo === 2 && phaseNo === 3) {
        return { ...phase, dueDate: addDays(paidAt, 15) }
      }
      return phase
    }),
  }
}

async function recordStallPhasePayment(exhibitorId, phaseNumber, meta = {}) {
  if (!exhibitorId) return null
  const modelFactory = require('../models')
  const Exhibitor = modelFactory.getModel('Exhibitor')
  const exhibitor = await Exhibitor.findByPk(exhibitorId)
  if (!exhibitor) return null

  let stallDetails = exhibitor.stallDetails || {}
  if (typeof stallDetails === 'string') {
    try {
      stallDetails = JSON.parse(stallDetails)
    } catch {
      stallDetails = {}
    }
  }

  const nextPayment = markPhasePaid(stallDetails, phaseNumber, meta)
  const paidPhase = nextPayment.paymentPhases.find((phase) => Number(phase.phase) === Number(phaseNumber))
  exhibitor.stallDetails = {
    ...stallDetails,
    ...nextPayment,
    lastStallPayment: {
      phase: Number(phaseNumber),
      orderId: meta.orderId || '',
      paymentId: meta.paymentId || '',
      paidAt: meta.paidAt || new Date().toISOString(),
      amount: paidPhase?.amount || 0,
    },
  }
  exhibitor.changed('stallDetails', true)
  await exhibitor.save()
  return exhibitor.stallDetails
}

function phaseFromRequirementId(requirementId) {
  const match = String(requirementId || '').match(/^stall-phase-(\d+)$/)
  return match ? Number(match[1]) : 0
}

module.exports = {
  round2,
  buildStallPayment,
  schedulePaymentPhases,
  markPhasePaid,
  addDays,
  recordStallPhasePayment,
  phaseFromRequirementId,
}
