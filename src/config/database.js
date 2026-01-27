const { Sequelize } = require('sequelize');
const mongoose = require('mongoose');

class Database {
  constructor() {
    this.dbType = process.env.DB_TYPE || 'mysql';
    this.connections = {};
    this._connected = false;

    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  async connectMySQL() {
    // 🔍 Detect TiDB Cloud vs Local MySQL
    const isCloudMySQL =
      typeof process.env.MYSQL_HOST === 'string' &&
      process.env.MYSQL_HOST.includes('tidbcloud.com');

    const port = Number(process.env.MYSQL_PORT) || (isCloudMySQL ? 4000 : 3306);

    try {
      console.log(
        `🔍 Connecting to MySQL at ${process.env.MYSQL_HOST}:${port} ` +
        (isCloudMySQL ? '(TiDB Cloud)' : '(Local)')
      );

      const sequelize = new Sequelize(
        process.env.MYSQL_DATABASE,
        process.env.MYSQL_USER,
        process.env.MYSQL_PASSWORD,
        {
          host: process.env.MYSQL_HOST,
          port: port,
          dialect: 'mysql',

          logging:
            process.env.NODE_ENV === 'development'
              ? false  // Changed from console.log to false to reduce logs
              : false,

          // 🔐 TLS REQUIRED for TiDB Cloud
          dialectOptions: isCloudMySQL
            ? {
                ssl: {
                  minVersion: 'TLSv1.2',
                  rejectUnauthorized: true
                }
              }
            : {},

          pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
          }
        }
      );

      await sequelize.authenticate();

      console.log(
        isCloudMySQL
          ? '✅ MySQL connected to TiDB Cloud'
          : `✅ MySQL connected to ${process.env.MYSQL_HOST}:${port}`
      );

      this.connections.mysql = sequelize;
      return sequelize;

    } catch (error) {
      console.error(`❌ MySQL connection failed: ${error.message}`);
      throw error;
    }
  }

  async connectMongoDB() {
    try {
      console.log('🔍 Connecting to MongoDB...');
      
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });

      console.log('✅ MongoDB connected');
      this.connections.mongodb = mongoose.connection;

    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      throw error;
    }
  }

  async connect() {
    try {
      if (this.dbType === 'mysql' || this.dbType === 'both') {
        await this.connectMySQL();
      }

      if (this.dbType === 'mongodb' || this.dbType === 'both') {
        await this.connectMongoDB();
      }

      this._connected = true;
      console.log('🚀 Database layer ready');

    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  getConnection(type = 'mysql') {
    const conn = this.connections[type];
    if (!conn) {
      throw new Error(`${type} connection not available. Call connect() first.`);
    }
    return conn;
  }

  isReady() {
    return this._connected;
  }

  async disconnect() {
    try {
      if (this.connections.mysql) {
        await this.connections.mysql.close();
      }

      if (this.connections.mongodb) {
        await this.connections.mongodb.close();
      }

      this._connected = false;
      console.log('✅ Database connections closed');

    } catch (error) {
      console.error('❌ Error disconnecting databases:', error.message);
    }
  }
}

module.exports = new Database();