const fs = require('fs')
const path = require('path')

const FILE_PATH = path.join(process.cwd(), 'uploads', 'stall-layout.json')

function defaultLayout() {
  return {
    availableColor: '#16a34a',
    bookedColor: '#dc2626',
    scale: 32,
    canvasWidth: 1100,
    canvasHeight: 720,
    halls: [
      { id: 'hall-a', name: 'Hall A' },
      { id: 'hall-b', name: 'Hall B' },
      { id: 'hall-c', name: 'Hall C' },
    ],
    stalls: [],
  }
}

function normalizeLayout(raw = {}) {
  const base = defaultLayout()
  const halls =
    Array.isArray(raw.halls) && raw.halls.length
      ? raw.halls
          .map((hall, index) => ({
            id: String(hall?.id || `hall-${index + 1}`),
            name: String(hall?.name || `Hall ${index + 1}`).trim() || `Hall ${index + 1}`,
          }))
          .filter((hall, index, list) => list.findIndex((item) => item.id === hall.id) === index)
      : base.halls
  const fallbackHall = halls[0]?.id || 'hall-a'
  const stalls = Array.isArray(raw.stalls)
    ? raw.stalls.map((stall) => ({
        ...stall,
        hallId: halls.some((hall) => hall.id === stall.hallId) ? stall.hallId : fallbackHall,
      }))
    : []
  return { ...base, ...raw, halls, stalls }
}

function readLayout() {
  try {
    if (!fs.existsSync(FILE_PATH)) return defaultLayout()
    const raw = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'))
    return normalizeLayout(raw)
  } catch {
    return defaultLayout()
  }
}

function writeLayout(layout) {
  const dir = path.dirname(FILE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const next = normalizeLayout(layout)
  fs.writeFileSync(FILE_PATH, JSON.stringify(next, null, 2))
  return next
}

module.exports = { FILE_PATH, defaultLayout, readLayout, writeLayout }
