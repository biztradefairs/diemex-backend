// Sync this model independently: a failure syncing another model must not skip blogs.
module.exports = async function ensureBlogTable(Blog) {
  if (!Blog || typeof Blog.sync !== 'function') {
    throw new Error('Blog model is unavailable. Blog database setup cannot continue.');
  }
  // Create a missing table, preserving existing rows and columns.
  await Blog.sync({ force: false, alter: false });
};
