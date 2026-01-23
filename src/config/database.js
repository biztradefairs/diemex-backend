const { Sequelize } = require('sequelize');
const mongoose = require('mongoose');

class Database {
  constructor() {
    this.dbType = process.env.DB_TYPE || 'mysql';
    this.connections = {};
    this._connected = false;
    this.maxRetries = 5;
    this.retryDelay = 3000;
  }

  async connectMySQL() {
    let retries = 0;

    // 👉 Detect LOCAL Docker MySQL vs Cloud MySQL (TiDB/PlanetScale)
    const isLocalMySQL =
      process.env.MYSQL_HOST === 'mysql' ||               // docker-compose service
      process.env.MYSQL_HOST === 'localhost' ||           // local machine
      process.env.NODE_ENV === 'development';

    while (retries < this.maxRetries) {
      try {
        const sequelize = new Sequelize(
          process.env.MYSQL_DATABASE,
          process.env.MYSQL_USER,
          process.env.MYSQL_PASSWORD,
          {
            host: process.env.MYSQL_HOST,

            // 🔹 Docker MySQL → 3306
            // 🔹 TiDB Cloud → 4000
            port: Number(process.env.MYSQL_PORT) || (isLocalMySQL ? 3306 : 4000),

            dialect: 'mysql',
            logging: process.env.NODE_ENV === 'development' ? console.log : false,

            // 🔐 SSL ONLY for Cloud MySQL
            ...(isLocalMySQL
              ? {}
              : {
                  ssl: true,
                  dialectOptions: {
                    ssl: {
                      require: true,
                      rejectUnauthorized: true
                    }
                  }
                }),

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
          isLocalMySQL
            ? '✅ MySQL connected (local / no SSL)'
            : '✅ MySQL connected (TLS enforced)'
        );

        this.connections.mysql = sequelize;
        return sequelize;

      } catch (error) {
        retries++;
        console.warn(`MySQL connection attempt ${retries} failed: ${error.message}`);

        if (retries >= this.maxRetries) {
          console.error('❌ MySQL connection failed after maximum retries');
          throw error;
        }

        await new Promise(res => setTimeout(res, this.retryDelay));
      }
    }
  }

  async connectMongoDB() {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10
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
