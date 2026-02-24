// scripts/createAdmin.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const database = require('../config/database');

async function createAdminUser() {
  try {
    console.log('🔧 Creating admin user...');
    
    await database.connect();
    const sequelize = database.getConnection('mysql');
    
    // Check if users table exists
    const [tables] = await sequelize.query("SHOW TABLES LIKE 'users'");
    
    if (tables.length === 0) {
      console.log('❌ Users table does not exist. Run migrations first.');
      process.exit(1);
    }
    
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Check if admin already exists
    const [existing] = await sequelize.query(
      "SELECT * FROM users WHERE email = 'admin@example.com'"
    );
    
    if (existing.length > 0) {
      console.log('🔄 Admin user already exists, updating password...');
      await sequelize.query(
        "UPDATE users SET password = ?, updatedAt = NOW() WHERE email = 'admin@example.com'",
        {
          replacements: [hashedPassword]
        }
      );
      console.log('✅ Admin password updated');
    } else {
      console.log('👤 Creating new admin user...');
      await sequelize.query(
        `INSERT INTO users (name, email, password, role, status, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        {
          replacements: ['Administrator', 'admin@example.com', hashedPassword, 'admin', 'active']
        }
      );
      console.log('✅ Admin user created');
    }
    
    console.log('\n📧 Email: admin@example.com');
    console.log('🔑 Password: admin123');
    
    await database.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createAdminUser();