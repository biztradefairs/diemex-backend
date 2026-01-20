/**
 * src/models/index.js
 * Fixed Model Factory with lazy initialization
 */

const database = require('../config/database');

let models = {};
let initialized = false;

// Model factory functions (lazy loading)
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
    const Exhibitor = require('./mysql/Exhibitor');
    return Exhibitor;
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
function init() {
  if (initialized) {
    return models;
  }

  const dbType = process.env.DB_TYPE || 'mysql';

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
  return models;
}

/**
 * Get a single model safely (lazy loading)
 */
function getModel(name) {
  // Check if model is already loaded
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