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

module.exports = { round2, buildStallPayment }
