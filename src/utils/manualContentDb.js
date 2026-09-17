const DEFAULT_IMPORTANT_DATES = [
  { label: 'Setup Begins', dateLabel: '07 Oct 2026', sortOrder: 0 },
  { label: 'Event Days', dateLabel: '08–10 Oct 2026', sortOrder: 1 },
  { label: 'Breakdown', dateLabel: '10 Oct 2026', sortOrder: 2 },
  { label: 'Requirements Due', dateLabel: '25 Sep 2026', sortOrder: 3 }
];

function getModels() {
  const modelFactory = require('../models');
  return {
    ManualSection: modelFactory.getModel('ManualSection'),
    ManualImportantDate: modelFactory.getModel('ManualImportantDate')
  };
}

let tablesReady = false;

async function ensureManualContentTables() {
  if (tablesReady) return;
  const { ManualSection, ManualImportantDate } = getModels();
  await ManualSection.sync();
  await ManualImportantDate.sync();

  const dateCount = await ManualImportantDate.count();
  if (dateCount === 0) {
    await ManualImportantDate.bulkCreate(DEFAULT_IMPORTANT_DATES);
  }

  tablesReady = true;
}

function formatSection(section) {
  const content = section.content || '';
  return {
    id: section.id,
    title: section.title,
    content,
    description: content.length > 100 ? `${content.substring(0, 100)}...` : content,
    category: section.category
      ? section.category.charAt(0).toUpperCase() + section.category.slice(1)
      : 'General',
    version: '1.0',
    file_name: null,
    file_size: '0 KB',
    file_path: null,
    mime_type: 'text/plain',
    last_updated: section.updatedAt || section.createdAt,
    updated_by: 'Admin',
    downloads: 0,
    status: section.status || 'published',
    type: 'section'
  };
}

module.exports = {
  DEFAULT_IMPORTANT_DATES,
  getModels,
  ensureManualContentTables,
  formatSection
};
