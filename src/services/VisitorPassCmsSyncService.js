const crypto = require('node:crypto');
const { Op } = require('sequelize');
const modelFactory = require('../models');
const { getActiveBadgeDesign } = require('./VisitorBadgeSettingsService');

const MUTATION = 'mutation SyncVisitorPass($input: SyncVisitorPassInput!) { syncVisitorPass(input: $input) { id } }';
let storage;
let timer;
let running = false;
let scheduled = false;

function configuration() {
  return {
    endpoint: process.env.CMS_GRAPHQL_ENDPOINT || process.env.NEXT_PUBLIC_CMS_GRAPHQL_ENDPOINT,
    projectId: process.env.CMS_PROJECT_ID || process.env.NEXT_PUBLIC_CMS_PROJECT_ID,
    secret: process.env.CMS_SYNC_SECRET,
  };
}
function isConfigured() {
  const config = configuration();
  return Boolean(config.endpoint && config.projectId && config.secret);
}
async function getStorage() {
  if (!storage) {
    storage = modelFactory.init().then(async models => {
      const Sync = models.VisitorPassCmsSync;
      if (!Sync || !models.VisitorPass) throw new Error('CMS visitor sync storage is unavailable');
      await Sync.sync();
      return { Sync, VisitorPass: models.VisitorPass };
    }).catch(error => { storage = null; throw error; });
  }
  return storage;
}
function date(value) {
  return value ? new Date(value).toISOString() : null;
}
function payloadObject(value) {
  return typeof value === 'string' ? JSON.parse(value) : value || {};
}
async function buildPayload(pass, options = {}, previous = {}) {
  const config = configuration();
  const frontend = (process.env.FRONTEND_URL || 'https://www.diemex.in').replace(/\/$/, '');
  const backend = (process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'https://diemex-backend.onrender.com').replace(/\/+$/, '').replace(/\/api$/, '');
  const design = options.delivery?.badgeDesign || previous.badgeDesign || await getActiveBadgeDesign();
  const tracking = options.tracking || {};
  const payload = {
    ...previous,
    projectId: config.projectId,
    externalPassId: String(pass.id),
    registrationNumber: pass.registrationNumber,
    publicCode: pass.publicCode,
    name: pass.name,
    companyName: pass.company,
    phone: pass.phone,
    email: pass.email || undefined,
    jobTitle: pass.designation || undefined,
    city: pass.city || undefined, state: pass.state || undefined, country: pass.country || undefined,
    countryCode: pass.countryCode || null, nationalNumber: pass.nationalNumber || null,
    area: pass.area || null, pinCode: pass.pinCode || null,
    registrationSource: pass.source || null,
    interests: pass.interests || [],
    passUrl: frontend + '/passes/view/' + encodeURIComponent(pass.publicCode),
    badgeUrl: backend + '/api/passes/' + encodeURIComponent(pass.publicCode) + '/badge?design=' + encodeURIComponent(design),
    badgeDesign: design,
    qrPayload: pass.qrPayload || ['DIEMEX 2027', 'Visitor', 'Name: ' + pass.name, 'Company: ' + pass.company, 'Code: ' + pass.registrationNumber, 'Date: 24?26 Mar 2027'].join('\n'),
    status: pass.status,
    channel: pass.channel,
    sentVia: pass.sentVia || null, sentStatus: pass.sentStatus || null,
    verifiedAt: date(pass.verifiedAt), issuedAt: date(pass.issuedAt),
    sentAt: date(pass.sentAt), checkedInAt: date(pass.checkedInAt),
    sourceUpdatedAt: date(pass.updatedAt || pass.checkedInAt || pass.sentAt || pass.issuedAt) || new Date().toISOString(),
    eventName: 'DIEMEX 2027', eventDates: '24?26 Mar 2027',
    eventVenue: 'Auto Cluster Exhibition Centre, Pune',
  };
  for (const [key, alias] of [
    ['utmSource', 'utm_source'], ['utmMedium', 'utm_medium'], ['utmCampaign', 'utm_campaign'],
    ['utmTerm', 'utm_term'], ['utmContent', 'utm_content'], ['utmId', 'cmsCampaignId'],
    ['utmUrl', 'landingPage'],
  ]) {
    const value = tracking[key] || tracking[alias];
    if (typeof value === 'string' && value.trim()) payload[key] = value.trim();
  }
  return payload;
}

// Persist before trying the network. Repeated delivery or scan events update this one row.
async function enqueue(pass, options = {}) {
  try {
    const { Sync, VisitorPass } = await getStorage();
    const queued = await Sync.sequelize.transaction(async transaction => {
      // Lock the source row so a delayed queue write cannot restore an older profile.
      const current = await VisitorPass.findByPk(pass.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!current || current.source === 'contact:delegate-registration') return null;
      const existing = await Sync.findByPk(pass.id, { transaction });
      const previous = payloadObject(existing?.payload);
      const payload = await buildPayload(current, options, previous);
      const keys = Object.keys(payload).filter(key => key !== 'sourceUpdatedAt').sort();
      const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload, keys)).digest('hex');
      if (existing?.payloadHash === payloadHash) return existing;
      // Queue revisions are monotonic even when MySQL timestamps lose milliseconds.
      payload.sourceUpdatedAt = new Date(Math.max(Date.now(), (Date.parse(previous.sourceUpdatedAt) || 0) + 1)).toISOString();
      await Sync.upsert({
        visitorPassId: current.id, payload, payloadHash, status: 'pending', attempts: 0,
        leadId: existing?.leadId || null, lastError: null, nextAttemptAt: new Date(), syncedAt: null,
      }, { transaction });
      return { visitorPassId: current.id, payloadHash };
    });
    if (queued) kick();
    return queued;
  } catch (error) {
    // The worker also discovers passes that were saved before a queue write failed.
    console.error('Visitor CMS queue failed:', error.message);
    return null;
  }
}

async function syncRow(row) {
  const { Sync } = await getStorage();
  const config = configuration();
  const where = { visitorPassId: row.visitorPassId, payloadHash: row.payloadHash };
  try {
    const payload = { ...payloadObject(row.payload), projectId: config.projectId };
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-project-id': config.projectId, 'x-cms-sync-secret': config.secret },
      body: JSON.stringify({ query: MUTATION, variables: { input: payload } }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    const leadId = result.data?.syncVisitorPass?.id;
    if (!response.ok || result.errors?.length || !leadId) {
      throw new Error(result.errors?.[0]?.message || 'CMS sync returned HTTP ' + response.status);
    }
    // A newer snapshot queued during this request must remain pending.
    await Sync.update({ status: 'synced', leadId, syncedAt: new Date(), lastError: null }, { where });
    return true;
  } catch (error) {
    const attempts = (row.attempts || 0) + 1;
    const delay = Math.min(3600000, 30000 * 2 ** Math.min(attempts - 1, 7));
    await Sync.update({
      status: 'pending', attempts, lastError: String(error.message).slice(0, 2000),
      nextAttemptAt: new Date(Date.now() + delay),
    }, { where });
    return false;
  }
}
async function processPending({ limit = 20, backfill = true } = {}) {
  if (running || !isConfigured()) return { synced: 0, pending: 0 };
  running = true;
  try {
    const { Sync, VisitorPass } = await getStorage();
    if (backfill) {
      const missing = await VisitorPass.findAll({
        include: [{ model: Sync, as: 'cmsSync', attributes: [], required: false }],
        where: { '$cmsSync.visitorPassId$': null,
          [Op.or]: [{ source: null }, { source: { [Op.ne]: 'contact:delegate-registration' } }] },
        order: [['createdAt', 'ASC']], limit,
      });
      for (const pass of missing) await enqueue(pass);
    }
    const rows = await Sync.findAll({
      where: { status: 'pending', nextAttemptAt: { [Op.lte]: new Date() } },
      order: [['nextAttemptAt', 'ASC']], limit,
    });
    let synced = 0;
    for (let offset = 0; offset < rows.length; offset += 4) {
      const results = await Promise.all(rows.slice(offset, offset + 4).map(syncRow));
      synced += results.filter(Boolean).length;
    }
    return { synced, pending: rows.length - synced };
  } finally { running = false; }
}
function kick() {
  if (scheduled || running || !isConfigured()) return;
  scheduled = true;
  setImmediate(() => {
    scheduled = false;
    processPending().catch(error => console.error('Visitor CMS sync failed:', error.message));
  });
}
function startWorker() {
  if (timer) return;
  if (!isConfigured()) {
    console.warn('Visitor CMS sync needs CMS_GRAPHQL_ENDPOINT, CMS_PROJECT_ID and CMS_SYNC_SECRET.');
    return;
  }
  timer = setInterval(kick, 30000);
  timer.unref();
  kick();
}
function stopWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
module.exports = { enqueue, processPending, startWorker, stopWorker, isConfigured, buildPayload, syncRow };
