// test-manual-model.js
require('dotenv').config();
const database = require('./config/database');

async function testManualModel() {
  try {
    console.log('🔌 Connecting to database...');
    await database.connect();
    
    console.log('📦 Initializing models...');
    const models = require('./src/models');
    models.init();
    
    const { Manual } = models.getAllModels();
    
    if (!Manual) {
      console.error('❌ Manual model not found in models!');
      console.log('Available models:', Object.keys(models.getAllModels()));
      return;
    }
    
    console.log('✅ Manual model found!');
    
    // Try to count manuals
    const count = await Manual.count();
    console.log(`📊 Total manuals in database: ${count}`);
    
    // Try to create a test manual
    if (count === 0) {
      console.log('📝 Creating a test manual...');
      
      const testManual = await Manual.create({
        title: 'Test Manual',
        description: 'This is a test manual',
        category: 'Test',
        version: '1.0',
        file_path: 'https://test.com/test.pdf',
        file_name: 'test.pdf',
        file_size: '1 MB',
        mime_type: 'application/pdf',
        last_updated: new Date().toISOString().split('T')[0],
        updated_by: 'Test User',
        status: 'draft',
        downloads: 0,
        metadata: {}
      });
      
      console.log('✅ Test manual created with ID:', testManual.id);
    }
    
    // Try to fetch all manuals
    const manuals = await Manual.findAll();
    console.log(`✅ Successfully fetched ${manuals.length} manuals`);
    
    await database.disconnect();
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testManualModel();