const modelFactory = require('../models');
const { DEFAULT_BADGE_DESIGN, BADGE_DESIGNS, isBadgeDesign } = require('./badges/designs');
let ready;

async function getModel() {
  if (!ready) {
    ready = modelFactory.init().then(async (models) => {
      const model = models.VisitorBadgeSetting;
      if (!model) throw new Error('Visitor badge settings are unavailable.');
      // Creates only this new table when absent; existing pass data is unaffected.
      await model.sync();
      return model;
    }).catch((error) => { ready = null; throw error; });
  }
  return ready;
}

async function getBadgeDesignSetting() {
  const row = await (await getModel()).findByPk('visitor');
  if (row && !isBadgeDesign(row.design)) throw new Error('The saved visitor badge design is invalid.');
  return { design: row?.design || DEFAULT_BADGE_DESIGN, designs: BADGE_DESIGNS, updatedAt: row?.updatedAt || null };
}
async function getActiveBadgeDesign() {
  return (await getBadgeDesignSetting()).design;
}
async function setBadgeDesign(design, userId) {
  if (!isBadgeDesign(design)) throw Object.assign(new Error('Choose Design 1 or Design 2.'), { status: 400 });
  await (await getModel()).upsert({ id: 'visitor', design, updatedBy: userId });
  return getBadgeDesignSetting();
}
module.exports = { getBadgeDesignSetting, getActiveBadgeDesign, setBadgeDesign };
