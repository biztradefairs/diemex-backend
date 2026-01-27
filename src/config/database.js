const { Sequelize } = require('sequelize');
const mongoose = require('mongoose');

class Database {
  constructor() {
    this.dbType = process.env.DB_TYPE || 'mysql';
    this.connections = {};
    this._connected = false;
    this.maxRetries = 10; // Increased for Docker
    this.retryDelay = 5000; // Increased delay
  }

  async connectMySQL() {
    let retries = 0;
    const isLocalMySQL = process.env.MYSQL_HOST === 'mysql' || 
                         process.env.MYSQL_HOST === 'localhost' ||
                         process.env.NODE_ENV === 'development';

    while (retries < this.maxRetries) {
      try {
        console.log(`🔗 MySQL connection attempt ${retries + 1}/${this.maxRetries}`);
        
        const sequelize = new Sequelize(
          process.env.MYSQL_DATABASE,
          process.env.MYSQL_USER,
          process.env.MYSQL_PASSWORD,
          {
            host: process.env.MYSQL_HOST,
            port: Number(process.env.MYSQL_PORT) || (isLocalMySQL ? 3306 : 4000),
            dialect: 'mysql',
            logging: process.env.NODE_ENV === 'development' ? false : false,
            dialectOptions: isLocalMySQL ? {} : {
              ssl: { require: true, rejectUnauthorized: true }
            },
            pool: {
              max: 10,
              min: 0,
              acquire: 30000,
              idle: 10000
            },
            retry: {
              max: 5,
              match: [
                /SequelizeConnectionError/,
                /SequelizeConnectionRefusedError/,
                /SequelizeHostNotFoundError/,
                /SequelizeHostNotReachableError/,
                /SequelizeInvalidConnectionError/,
                /SequelizeConnectionTimedOutError/
              ]
            }
          }
        );

        await sequelize.authenticate();
        console.log('✅ MySQL connected successfully');
        this.connections.mysql = sequelize;
        return sequelize;

      } catch (error) {
        retries++;
        console.warn(`MySQL connection failed (attempt ${retries}): ${error.message}`);
        
        if (retries >= this.maxRetries) {
          console.error('❌ MySQL connection failed after maximum retries');
          throw error;
        }
        
        console.log(`Waiting ${this.retryDelay/1000} seconds before retry...`);
        await new Promise(res => setTimeout(res, this.retryDelay));
      }
    }
  }

  async connectMongoDB() {
    let retries = 0;
    
    while (retries < this.maxRetries) {
      try {
        console.log(`🔗 MongoDB connection attempt ${retries + 1}/${this.maxRetries}`);
        
        await mongoose.connect(process.env.MONGO_URI, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });

        console.log('✅ MongoDB connected successfully');
        this.connections.mongodb = mongoose.connection;
        return;

      } catch (error) {
        retries++;
        console.warn(`MongoDB connection failed (attempt ${retries}): ${error.message}`);
        
        if (retries >= this.maxRetries) {
          console.error('❌ MongoDB connection failed after maximum retries');
          throw error;
        }
        
        console.log(`Waiting ${this.retryDelay/1000} seconds before retry...`);
        await new Promise(res => setTimeout(res, this.retryDelay));
      }
    }
  }

  async connect() {
    console.log(`🗄️ Database type: ${this.dbType}`);
    
    try {
      if (this.dbType === 'mysql' || this.dbType === 'both') {
        await this.connectMySQL();
      }

      if (this.dbType === 'mongodb' || this.dbType === 'both') {
        await this.connectMongoDB();
      }

      this._connected = true;
      console.log('✅ All database connections established');

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
      if (this.connections.mysql) await this.connections.mysql.close();
      if (this.connections.mongodb) await this.connections.mongodb.close();
      this._connected = false;
      console.log('✅ Database connections closed');
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error.message);
    }
  }
}

module.exports = new Database();