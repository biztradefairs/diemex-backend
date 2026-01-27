// scripts/create-floor-plans-table.js
const database = require('../src/config/database');

async function createFloorPlansTable() {
  try {
    const sequelize = database.getConnection('mysql');
    
    if (!sequelize) {
      console.error('MySQL connection not available');
      process.exit(1);
    }
    
    const query = `
      CREATE TABLE IF NOT EXISTS floor_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        floor VARCHAR(100),
        version VARCHAR(20) DEFAULT '1.0',
        image LONGTEXT,
        shapes LONGTEXT,
        scale FLOAT DEFAULT 0.1,
        grid_size INT DEFAULT 20,
        show_grid BOOLEAN DEFAULT true,
        tags TEXT,
        metadata LONGTEXT,
        is_public BOOLEAN DEFAULT false,
        thumbnail VARCHAR(500),
        created_by INT,
        updated_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_floor_plan_name (name),
        INDEX idx_floor_plan_floor (floor),
        INDEX idx_floor_plan_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    await sequelize.query(query);
    console.log('✅ floor_plans table created successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating floor_plans table:', error.message);
    process.exit(1);
  }
}

createFloorPlansTable();