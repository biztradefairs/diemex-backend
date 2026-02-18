const database = require('../config/database');

let models = {};
let initialized = false;

// Model factory functions
const modelFactories = {
  // MySQL / Sequelize models
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

  FloorPlan: () => {
    const FloorPlanFactory = require('./mysql/FloorPlan');
    const sequelize = database.getConnection('mysql');
    return FloorPlanFactory(sequelize);
  },

  Product: () => {
    const ProductFactory = require('./mysql/Product');
    const sequelize = database.getConnection('mysql');
    return ProductFactory(sequelize);
  },

  Brand: () => {
    const BrandFactory = require('./mysql/Brand');
    const sequelize = database.getConnection('mysql');
    return BrandFactory(sequelize);
  },

  Brochure: () => {
    const BrochureFactory = require('./mysql/Brochure');
    const sequelize = database.getConnection('mysql');
    return BrochureFactory(sequelize);
  },

  Requirement: () => {
    const RequirementFactory = require('./mysql/Requirement');
    const sequelize = database.getConnection('mysql');
    return RequirementFactory(sequelize);
  },

  Manual: () => {
    const ManualFactory = require('./mysql/Manual');
    const sequelize = database.getConnection('mysql');
    return ManualFactory(sequelize);
  },

  // ADD THIS - Furniture model
 Furniture: () => {
  const FurnitureFactory = require('./mysql/Furniture');
  const sequelize = database.getConnection('mysql');
  return FurnitureFactory(sequelize);
},

  // MongoDB models
  MongoUser: () => require('./mongodb/User'),
  MongoAuditLog: () => require('./mongodb/AuditLog'),
  MongoNotification: () => require('./mongodb/Notification'),
  MongoFloorPlan: () => require('./mongodb/FloorPlan'),
  MongoInvoice: () => require('./mongodb/Invoice'),
  MongoPayment: () => require('./mongodb/Payment'),
  MongoMedia: () => require('./mongodb/Media'),
  MongoAlert: () => require('./mongodb/Alert')
  
};

function init() {
  if (initialized) {
    return models;
  }

  const dbType = process.env.DB_TYPE || 'mysql';

  // MySQL Models
  if (dbType === 'mysql' || dbType === 'both') {
    const sequelize = database.getConnection('mysql');

    if (!sequelize) {
      throw new Error('MySQL connection not available');
    }

    // Load all MySQL models
    Object.keys(modelFactories).forEach((modelName) => {
      if (!modelName.startsWith('Mongo')) {
        try {
          models[modelName] = modelFactories[modelName]();
          console.log(`✅ Loaded model: ${modelName}`);
        } catch (err) {
          console.warn(`⚠️ Failed to load model ${modelName}: ${err.message}`);
        }
      }
    });

    // Set up associations
    Object.keys(models).forEach(modelName => {
      if (models[modelName].associate) {
        try {
          models[modelName].associate(models);
          console.log(`✅ Associated model: ${modelName}`);
        } catch (err) {
          console.warn(`⚠️ Failed to associate model ${modelName}: ${err.message}`);
        }
      }
    });

    // Sync models (only in development)
    if (process.env.NODE_ENV === 'development') {
      sequelize
        .sync({ alter: true })
        .then(() => console.log('✅ MySQL models synced'))
        .catch(err => console.error('❌ MySQL sync failed:', err.message));
    }
  }

  // MongoDB Models
  if (dbType === 'mongodb' || dbType === 'both') {
    Object.keys(modelFactories).forEach((modelName) => {
      if (modelName.startsWith('Mongo')) {
        try {
          models[modelName] = modelFactories[modelName]();
          console.log(`✅ Loaded MongoDB model: ${modelName}`);
        } catch (err) {
          console.warn(`⚠️ Failed to load MongoDB model ${modelName}: ${err.message}`);
        }
      }
    });
  }

  initialized = true;
  console.log(`🎯 Total models loaded: ${Object.keys(models).length}`);
  console.log('📋 Loaded models:', Object.keys(models).join(', '));
  
  return models;
}

function getModel(name) {
  if (!initialized) {
    throw new Error('Models not initialized. Call init() first.');
  }

  if (models[name]) {
    return models[name];
  }

  const altNames = {
    FloorPlan: 'MongoFloorPlan',
    User: 'MongoUser',
    Manual: 'Manual',
    Furniture: 'Furniture' // Add this
  };

  if (altNames[name] && models[altNames[name]]) {
    return models[altNames[name]];
  }

  throw new Error(`Model "${name}" not found. Available models: ${Object.keys(models).join(', ')}`);
}

function getAllModels() {
  return models;
}

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