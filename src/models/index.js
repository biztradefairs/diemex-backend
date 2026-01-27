const database = require('../config/database');

let models = {};
let initialized = false;

// Model factory functions
const modelFactories = {
  // ======================
  // MySQL / Sequelize
  // ======================
  User: () => {
    const UserFactory = require('./mysql/User');
    const sequelize = database.getConnection('mysql');
    return UserFactory(sequelize);
  },

  Article: () => {
    const ArticleFactory = require('./mysql/Article');
    const sequelize = database.getConnection('mysql');
    return ArticleFactory(sequelize);
  },

  Exhibitor: () => {
    const ExhibitorFactory = require('./mysql/Exhibitor');
    const sequelize = database.getConnection('mysql');
    return ExhibitorFactory(sequelize);
  },

  Invoice: () => {
    const InvoiceFactory = require('./mysql/Invoice');
    const sequelize = database.getConnection('mysql');
    return InvoiceFactory(sequelize);
  },

  Payment: () => {
    const PaymentFactory = require('./mysql/Payment');
    const sequelize = database.getConnection('mysql');
    return PaymentFactory(sequelize);
  },

  Media: () => {
    const MediaFactory = require('./mysql/Media');
    const sequelize = database.getConnection('mysql');
    return MediaFactory(sequelize);
  },
  
  // MongoDB models
  MongoUser: () => {
    const MongoUser = require('./mongodb/User');
    return MongoUser;
  },
  
  MongoAuditLog: () => {
    const MongoAuditLog = require('./mongodb/AuditLog');
    return MongoAuditLog;
  },
  
  MongoNotification: () => {
    const MongoNotification = require('./mongodb/Notification');
    return MongoNotification;
  }
};

/**
 * Initialize all models AFTER database.connect()
 */
async function init() {
  if (initialized) {
    console.log('⚠️ Models already initialized');
    return models;
  }

  const dbType = process.env.DB_TYPE || 'mysql';
  console.log(`📦 Initializing models for database type: ${dbType}`);

  // Initialize models based on database type
  if (dbType === 'mysql' || dbType === 'both') {
    const sequelize = database.getConnection('mysql');
    
    if (!sequelize) {
      throw new Error('MySQL connection not available');
    }

    // Load Sequelize models
    Object.keys(modelFactories).forEach(modelName => {
      if (!modelName.startsWith('Mongo')) { // Skip MongoDB models for MySQL
        try {
          models[modelName] = modelFactories[modelName]();
        } catch (error) {
          console.warn(`Failed to load model ${modelName}:`, error.message);
        }
      }
    });

    // Sync models in development
    if (process.env.NODE_ENV === 'development') {
      sequelize.sync({ alter: false })
        .then(() => console.log('✅ MySQL models synced'))
        .catch((err) => console.error('❌ MySQL sync failed:', err));
    }
  }

  // MongoDB models
  if (dbType === 'mongodb' || dbType === 'both') {
    models.MongoUser = require('./mongodb/User');
    models.MongoAuditLog = require('./mongodb/AuditLog');
    models.MongoNotification = require('./mongodb/Notification');
    models.MongoFloorPlan = require('./mongodb/FloorPlan');
    models.MongoInvoice = require('./mongodb/Invoice');
    models.MongoPayment = require('./mongodb/Payment');
    models.MongoMedia = require('./mongodb/Media');
    models.MongoAlert = require('./mongodb/Alert');
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
  if (!initialized) {
    throw new Error('Models not initialized. Call init() first.');
  }

  if (models[name]) {
    return models[name];
  }
  
  // Check if model factory exists
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
  
  throw new Error(`Model "${name}" not found. Call init() first or check if model exists.`);
}

/**
 * Get all models
 */
function getAllModels() {
  return models;
}

/**
 * Clear models (testing)
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
