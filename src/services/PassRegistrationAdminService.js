const { Op } = require('sequelize');
const modelFactory = require('../models');
const cmsSync = require('./VisitorPassCmsSyncService');
const { getActiveBadgeDesign } = require('./VisitorBadgeSettingsService');
const { isBadgeDesign } = require('./badges/designs');

const FIELDS = [
  'id', 'registrationNumber', 'publicCode', 'name', 'company', 'designation',
  'phone', 'email', 'area', 'city', 'state', 'country', 'pinCode', 'source',
  'interests', 'channel', 'status', 'verifiedAt', 'issuedAt', 'sentAt',
  'sentVia', 'sentStatus', 'checkedInAt', 'createdAt', 'updatedAt',
];

function payload(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function listRegistrations({ page = 1, limit = 25, search = '', status = '' } = {}) {
  const { VisitorPass, VisitorPassCmsSync: Sync } = await modelFactory.init();
  const conditions = [
    { [Op.or]: [{ source: null }, { source: { [Op.ne]: 'contact:delegate-registration' } }] },
  ];
  if (status) conditions.push({ status });
  if (search) conditions.push({
    [Op.or]: ['name', 'company', 'email', 'phone', 'registrationNumber'].map(field => ({
      [field]: { [Op.substring]: search },
    })),
  });
  const { rows, count } = await VisitorPass.findAndCountAll({
    attributes: FIELDS, where: { [Op.and]: conditions },
    order: [['createdAt', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit,
  });
  let syncRows = [];
  if (rows.length && Sync) {
    try {
      syncRows = await Sync.findAll({
        where: { visitorPassId: { [Op.in]: rows.map(row => row.id) } },
        attributes: ['visitorPassId', 'status', 'leadId', 'syncedAt', 'attempts', 'lastError', 'nextAttemptAt', 'payload'],
      });
    } catch (error) {
      // A queue table awaiting its first startup must not hide saved visitors.
      if (error.original?.code !== 'ER_NO_SUCH_TABLE') throw error;
    }
  }
  const byPass = new Map(syncRows.map(row => [row.visitorPassId, row]));
  const activeDesign = rows.length ? await getActiveBadgeDesign() : 'design1';
  const frontend = (process.env.FRONTEND_URL || 'https://www.diemex.in').replace(/\/+$/, '');
  const backend = (process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'https://diemex-backend.onrender.com')
    .replace(/\/+$/, '').replace(/\/api$/, '');
  const registrations = rows.map(row => {
    const sync = byPass.get(row.id);
    const snapshot = payload(sync?.payload);
    const design = isBadgeDesign(snapshot.badgeDesign) ? snapshot.badgeDesign : activeDesign;
    return {
      ...Object.fromEntries(FIELDS.map(field => [field, row[field] ?? null])),
      interests: Array.isArray(row.interests) ? row.interests : [],
      passUrl: frontend + '/passes/view/' + encodeURIComponent(row.publicCode),
      badgeUrl: backend + '/api/passes/' + encodeURIComponent(row.publicCode) + '/badge?design=' + design,
      badgeDesign: design,
      cmsSync: {
        status: sync?.status || 'not_queued', leadId: sync?.leadId || null,
        syncedAt: sync?.syncedAt || null, attempts: sync?.attempts || 0,
        lastError: sync?.lastError || null, nextAttemptAt: sync?.nextAttemptAt || null,
      },
    };
  });
  return {
    success: true, registrations, total: count, page, limit,
    totalPages: Math.max(1, Math.ceil(count / limit)), cmsConfigured: cmsSync.isConfigured(),
  };
}

module.exports = { listRegistrations };
