const { DataTypes } = require('sequelize');
const database = require('../config/database');

async function addDataColumn() {
  const sequelize = database.getConnection('mysql');
  
  try {
    // Check if table exists
    const [tables] = await sequelize.query("SHOW TABLES LIKE 'requirements'");
    
    if (tables.length === 0) {
      console.log('⚠️ Requirements table does not exist yet');
      return;
    }
    
    // Check if column exists
    const [columns] = await sequelize.query("SHOW COLUMNS FROM requirements LIKE 'data'");
    
    if (columns.length === 0) {
      console.log('📝 Adding data column to requirements table...');
      await sequelize.query("ALTER TABLE requirements ADD COLUMN data JSON NULL");
      console.log('✅ Data column added successfully');
    } else {
      console.log('✅ Data column already exists');
    }
    
  } catch (error) {
    console.error('❌ Error adding column:', error);
  }
}

// Run the migration
addDataColumn();