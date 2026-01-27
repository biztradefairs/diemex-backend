/**
 * src/models/index.js
 * Fixed Model Factory with lazy initialization
 */

const database = require('../config/database');

let models = {};
let initialized = false;

// Model factory functions (lazy loading)
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

  // ======================
  // MongoDB / Mongoose
  // ======================
  MongoUser: () => require('./mongodb/User'),
  MongoAuditLog: () => require('./mongodb/AuditLog'),
  MongoNotification: () => require('./mongodb/Notification'),
  MongoFloorPlan: () => require('./mongodb/FloorPlan'),
  MongoInvoice: () => require('./mongodb/Invoice'),
  MongoPayment: () => require('./mongodb/Payment'),
  MongoMedia: () => require('./mongodb/Media'),
  MongoAlert: () => require('./mongodb/Alert')
};

/**
 * Initialize models AFTER database.connect()
 */
function init() {
  if (initialized) {
    return models;
  }

  const dbType = process.env.DB_TYPE || 'mysql';

  // ======================
  // MySQL Models
  // ======================
  if (dbType === 'mysql' || dbType === 'both') {
    const sequelize = database.getConnection('mysql');

    if (!sequelize) {
      throw new Error('MySQL connection not available');
    }

    Object.keys(modelFactories).forEach((modelName) => {
      if (!modelName.startsWith('Mongo')) {
        try {
          models[modelName] = modelFactories[modelName]();
        } catch (err) {
          console.warn(`⚠️ Failed to load model ${modelName}: ${err.message}`);
        }
      }
    });

    if (process.env.NODE_ENV === 'development') {
      sequelize
        .sync({ alter: false })
        .then(() => console.log('✅ MySQL models synced'))
        .catch(err => console.error('❌ MySQL sync failed:', err.message));
    }
  }

  // ======================
  // MongoDB Models
  // ======================
  if (dbType === 'mongodb' || dbType === 'both') {
    Object.keys(modelFactories).forEach((modelName) => {
      if (modelName.startsWith('Mongo')) {
        try {
          models[modelName] = modelFactories[modelName]();
        } catch (err) {
          console.warn(`⚠️ Failed to load model ${modelName}: ${err.message}`);
        }
      }
    });
  }

  initialized = true;
  return models;
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

  throw new Error(`Model "${name}" not found`);
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
