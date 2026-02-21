// ======================================================
// MODELS INDEX FILE - COMPLETE VERSION
// ======================================================

const database = require('../config/database');

let models = {};
let initialized = false;

// ======================================================
// MODEL FACTORIES
// ======================================================

const modelFactories = {
  // ================= MYSQL MODELS =================

  User: () => {
    const factory = require('./mysql/User');
    return factory(database.getConnection('mysql'));
  },

  Article: () => {
    const factory = require('./mysql/Article');
    return factory(database.getConnection('mysql'));
  },

  Exhibitor: () => {
    const factory = require('./mysql/Exhibitor');
    return factory(database.getConnection('mysql'));
  },

  Invoice: () => {
    const factory = require('./mysql/Invoice');
    return factory(database.getConnection('mysql'));
  },

  Payment: () => {
    const factory = require('./mysql/Payment');
    return factory(database.getConnection('mysql'));
  },

  Media: () => {
    const factory = require('./mysql/Media');
    return factory(database.getConnection('mysql'));
  },

  FloorPlan: () => {
    const factory = require('./mysql/FloorPlan');
    return factory(database.getConnection('mysql'));
  },

  Product: () => {
    const factory = require('./mysql/Product');
    return factory(database.getConnection('mysql'));
  },

  Brand: () => {
    const factory = require('./mysql/Brand');
    return factory(database.getConnection('mysql'));
  },

  Brochure: () => {
    const factory = require('./mysql/Brochure');
    return factory(database.getConnection('mysql'));
  },

  Requirement: () => {
    const factory = require('./mysql/Requirement');
    return factory(database.getConnection('mysql'));
  },

  Manual: () => {
    const factory = require('./mysql/Manual');
    return factory(database.getConnection('mysql'));
  },

  Furniture: () => {
    const factory = require('./mysql/Furniture');
    return factory(database.getConnection('mysql'));
  },

  CompressedAirOption: () => {
    const factory = require('./mysql/CompressedAirOption');
    return factory(database.getConnection('mysql'));
  },

  ElectricalRate: () => {
    const factory = require('./mysql/ElectricalRate');
    return factory(database.getConnection('mysql'));
  },

  RentalItem: () => {
    const factory = require('./mysql/RentalItem');
    return factory(database.getConnection('mysql'));
  },

  HostessCategory: () => {
    const factory = require('./mysql/HostessCategory');
    return factory(database.getConnection('mysql'));
  },

  SecurityGuardConfig: () => {
    const factory = require('./mysql/SecurityGuardConfig');
    return factory(database.getConnection('mysql'));
  },

  WaterConnectionConfig: () => {
    const factory = require('./mysql/WaterConnectionConfig');
    return factory(database.getConnection('mysql'));
  },

  HousekeepingConfig: () => {
    const factory = require('./mysql/HousekeepingConfig');
    return factory(database.getConnection('mysql'));
  },

  SecurityDeposit: () => {
    const factory = require('./mysql/SecurityDeposit');
    return factory(database.getConnection('mysql'));
  },

  // ================= MONGO MODELS =================

  MongoUser: () => require('./mongodb/User'),
  MongoAuditLog: () => require('./mongodb/AuditLog'),
  MongoNotification: () => require('./mongodb/Notification'),
  MongoFloorPlan: () => require('./mongodb/FloorPlan'),
  MongoInvoice: () => require('./mongodb/Invoice'),
  MongoPayment: () => require('./mongodb/Payment'),
  MongoMedia: () => require('./mongodb/Media'),
  MongoAlert: () => require('./mongodb/Alert')
};

// ======================================================
// INITIALIZE MODELS
// ======================================================

async function init() {
  if (initialized) return models;

  const dbType = process.env.DB_TYPE || 'mysql';
  console.log(`📦 Initializing models (DB_TYPE=${dbType})`);

  // ================= MYSQL =================
  if (dbType === 'mysql' || dbType === 'both') {
    const sequelize = database.getConnection('mysql');

    if (!sequelize) {
      throw new Error('❌ MySQL connection not available');
    }

    console.log('🔄 Loading MySQL models...');

    for (const modelName of Object.keys(modelFactories)) {
      if (!modelName.startsWith('Mongo')) {
        try {
          models[modelName] = modelFactories[modelName]();
          console.log(`✅ Loaded model: ${modelName}`);
        } catch (err) {
          console.error(`❌ Failed loading model ${modelName}:`, err.message);
        }
      }
    }

    // ================= ASSOCIATIONS =================
    console.log('🔗 Setting up associations...');
    for (const modelName of Object.keys(models)) {
      if (models[modelName]?.associate) {
        try {
          models[modelName].associate(models);
          console.log(`✅ Associated: ${modelName}`);
        } catch (err) {
          console.warn(`⚠️ Association failed for ${modelName}:`, err.message);
        }
      }
    }

    // ================= AUTO SYNC =================
    console.log('🗄️ Syncing database models...');

    try {
      await sequelize.sync({
        alter: process.env.NODE_ENV === 'development',
        force: false
      });

      console.log('✅ Database synced successfully');
    } catch (syncError) {
      console.error('❌ Database sync failed:', syncError.message);
    }
  }

  // ================= MONGODB =================
  if (dbType === 'mongodb' || dbType === 'both') {
    console.log('🔄 Loading MongoDB models...');

    for (const modelName of Object.keys(modelFactories)) {
      if (modelName.startsWith('Mongo')) {
        try {
          models[modelName] = modelFactories[modelName]();
          console.log(`✅ Loaded Mongo model: ${modelName}`);
        } catch (err) {
          console.error(`❌ Failed Mongo model ${modelName}:`, err.message);
        }
      }
    }
  }

  initialized = true;

  console.log('🎯 Models initialized successfully');
  console.log('📋 Available models:', Object.keys(models).join(', '));

  return models;
}

// ======================================================
// GET MODEL
// ======================================================

function getModel(name) {
  if (!initialized) {
    throw new Error('Models not initialized. Call init() first.');
  }

  if (models[name]) return models[name];

  throw new Error(
    `Model "${name}" not found. Available: ${Object.keys(models).join(', ')}`
  );
}

// ======================================================
// GET ALL MODELS
// ======================================================

function getAllModels() {
  return models;
}

// ======================================================
// CLEAR MODELS (FOR TESTING)
// ======================================================

function clear() {
  models = {};
  initialized = false;
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  init,
  getModel,
  getAllModels,
  clear
};