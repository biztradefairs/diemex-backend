const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const database = require('../src/config/database');
const defineBlog = require('../src/models/mysql/Blog');
const ensureBlogTable = require('../src/utils/ensureBlogTable');

async function main() {
  let sequelize;
  try {
    // Do not initialize or synchronize unrelated models.
    sequelize = await database.connectMySQL();
    const Blog = defineBlog(sequelize);
    await ensureBlogTable(Blog);
    const count = await Blog.count();
    console.log('Blog table is ready. Existing blog posts: ' + count);
  } catch (error) {
    console.error('Blog table setup failed: ' + error.message);
    process.exitCode = 1;
  } finally {
    if (sequelize) await sequelize.close();
  }
}

main();
