const database = require('../config/database');

let models = {};
let initialized = false;

// Model factory functions
const modelFactories = {
  // MySQL/Sequelize models
  User: () => {
    const UserFactory = require('./mysql/User');
    const sequelize = database.getConnection('mysql');
    return UserFactory(sequelize);
  },
  
  Article: () => {
    const Article = require('./mysql/Article');
    return Article;
  },
  
  Exhibitor: () => {
    const ExhibitorFactory = require('./mysql/Exhibitor');
    const sequelize = database.getConnection('mysql');
    return ExhibitorFactory(sequelize);
  },
  
  Invoice: () => {
    const getInvoiceModel = require('./mysql/Invoice');
    return getInvoiceModel();
  },
  
  Payment: () => {
    const Payment = require('./mysql/Payment');
    return Payment;
  },
  
  Media: () => {
    const Media = require('./mysql/Media');
    return Media;
  },
  
  // Add FloorPlan model factory
  FloorPlan: () => {
    const FloorPlanFactory = require('./mysql/FloorPlan');
    const sequelize = database.getConnection('mysql');
    return FloorPlanFactory(sequelize);
  },
  
  // MongoDB models (will be loaded separately)
};

/**
 * Initialize all models
 */
async function init() {
  if (initialized) {
    console.log('⚠️ Models already initialized');
    return models;
  }

  const dbType = process.env.DB_TYPE || 'mysql';
  console.log(`📦 Initializing models for database type: ${dbType}`);

  try {
    // Initialize models based on database type
    if (dbType === 'mysql' || dbType === 'both') {
      const sequelize = database.getConnection('mysql');
      
      if (!sequelize) {
        throw new Error('MySQL connection not available');
      }

      console.log('🔧 Loading MySQL models...');
      
      // Load Sequelize models
      Object.keys(modelFactories).forEach(modelName => {
        if (!modelName.startsWith('Mongo')) {
          try {
            models[modelName] = modelFactories[modelName]();
            console.log(`   ✅ ${modelName} model loaded`);
          } catch (error) {
            console.error(`   ❌ Failed to load model ${modelName}:`, error.message);
          }
        }
      });

      // Set up associations after all models are loaded
      console.log('🔗 Setting up model associations...');
      Object.keys(models).forEach(modelName => {
        if (models[modelName].associate) {
          models[modelName].associate(models);
        }
      });
      console.log('✅ Model associations set up');

      // Sync models in development
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Syncing MySQL models...');
        try {
          await sequelize.sync({ alter: false });
          console.log('✅ MySQL models synced');
        } catch (err) {
          console.error('❌ MySQL sync failed:', err.message);
        }
      }
    }

    // MongoDB models (separate initialization)
    if (dbType === 'mongodb' || dbType === 'both') {
      console.log('🔧 Loading MongoDB models...');
      try {
        models.MongoUser = require('./mongodb/User');
        models.MongoAuditLog = require('./mongodb/AuditLog');
        models.MongoNotification = require('./mongodb/Notification');
        models.MongoFloorPlan = require('./mongodb/FloorPlan');
        models.MongoInvoice = require('./mongodb/Invoice');
        models.MongoPayment = require('./mongodb/Payment');
        models.MongoMedia = require('./mongodb/Media');
        models.MongoAlert = require('./mongodb/Alert');
        console.log('✅ MongoDB models loaded');
      } catch (error) {
        console.error('❌ MongoDB models loading failed:', error.message);
      }
    }

    initialized = true;
    console.log('🎉 All models initialized successfully');
    return models;
  } catch (error) {
    console.error('❌ Model initialization failed:', error);
    throw error;
  }
}

/**
 * Get a single model safely
 */
function getModel(name) {
  // Check if model is already loaded
  if (models[name]) {
    return models[name];
  }
  
  // Try to load from factory
  if (modelFactories[name]) {
    models[name] = modelFactories[name]();
    return models[name];
  }
  
  // Try to load MongoDB model
  if (name.startsWith('Mongo')) {
    try {
      const modelPath = `./mongodb/${name.replace('Mongo', '')}`;
      models[name] = require(modelPath);
      return models[name];
    } catch (error) {
      // Model not found
    }
  }
  
  // Try to load directly from MySQL directory
  if (!name.startsWith('Mongo')) {
    try {
      const modelPath = `./mysql/${name}`;
      const modelFactory = require(modelPath);
      const sequelize = database.getConnection('mysql');
      models[name] = modelFactory(sequelize);
      
      // Set up associations
      if (models[name].associate) {
        models[name].associate(models);
      }
      
      return models[name];
    } catch (error) {
      // Model not found
    }
  }
  
  throw new Error(`Model "${name}" not found. Make sure to call init() first.`);
}

/**
 * Get all models
 */
function getAllModels() {
  return models;
}

/**
 * Clear all models (for testing)
 */
function clear() {
  models = {};
  initialized = false;
}

module.exports = {
  init,
  getModel,
  getAllModels,
  clear
};