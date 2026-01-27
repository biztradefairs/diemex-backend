require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const database = require('./config/database');
const logger = require('./utils/logger');

async function createDefaultAdmin() {
  try {
    // Load models AFTER database connection
    const modelFactory = require('./models');
    const User = modelFactory.getModel('User');
    
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminEmail || !adminPassword) {
      console.warn('⚠️ Admin credentials not set in environment variables');
      return;
    }
    
    let adminUser;
    
    if (process.env.DB_TYPE === 'mysql') {
      adminUser = await User.findOne({ where: { email: adminEmail } });
    } else {
      adminUser = await User.findOne({ email: adminEmail });
    }
    
    if (!adminUser) {
      const adminData = {
        name: 'Administrator',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        status: 'active',
        phone: '+1234567890'
      };
      
      await User.create(adminData);
      console.log('✅ Default admin user created');
      
      // Send audit log
      try {
        const kafkaProducer = require('./kafka/producer');
        await kafkaProducer.sendAuditLog('ADMIN_USER_CREATED', null, {
          email: adminEmail,
          action: 'initial_setup'
        });
      } catch (kafkaError) {
        console.warn('⚠️ Kafka not available for audit log');
      }
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    logger.error(`Admin user creation failed: ${error.message}`);
  }
}

async function startServer() {
  try {
    console.log('🚀 Starting Exhibition Admin Backend...');
    console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Database: ${process.env.DB_TYPE || 'mysql'}`);
    
    // 1️⃣ FIRST connect to database
    console.log('🔗 Connecting to database...');
    await database.connect();
    console.log('✅ Database connected successfully');
    
    // 2️⃣ Initialize models AFTER database connection
    console.log('🗄️ Initializing models...');
    const modelFactory = require('./models');
    modelFactory.init();
    console.log('✅ Models initialized successfully');
    
    // 3️⃣ Load app AFTER models are initialized
    console.log('🚀 Loading Express app...');
    const app = require('./appServer');
    const PORT = process.env.PORT || 5000;
    
    // 4️⃣ Create default admin user
    console.log('👤 Checking default admin user...');
    await createDefaultAdmin();
    console.log('✅ Admin user check completed');
    
    // 5️⃣ Connect to Kafka (optional - continue even if Kafka fails)
    console.log('🔗 Connecting to Kafka...');
    let kafkaConnected = false;
    try {
      const kafkaProducer = require('./kafka/producer');
      const kafkaConsumer = require('./kafka/consumer');
      await kafkaProducer.connect();
      await kafkaConsumer.connect();
      await kafkaConsumer.setupCommonSubscriptions();
      kafkaConnected = true;
      console.log('✅ Kafka connected successfully');
    } catch (kafkaError) {
      console.warn('⚠️ Kafka connection failed (continuing without Kafka):', kafkaError.message);
    }
    
    // 6️⃣ Create HTTP server
    const server = http.createServer(app);
    
    // 7️⃣ Initialize WebSocket
    console.log('🔌 Initializing WebSocket...');
    const io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
    
    const WebSocketService = require('./services/WebSocketService');
    const webSocketService = new WebSocketService(io);
    webSocketService.initialize();
    console.log('✅ WebSocket service initialized');
    
    // 8️⃣ Start scheduler (optional)
    console.log('⏰ Starting scheduler service...');
    try {
      const schedulerService = require('./services/SchedulerService');
      schedulerService.start();
      console.log('✅ Scheduler service started');
    } catch (schedulerError) {
      console.warn('⚠️ Scheduler service failed to start:', schedulerError.message);
    }
    
    // 9️⃣ Start server
    server.listen(PORT, '0.0.0.0', () => {
      console.log('='.repeat(50));
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️ Database: ${process.env.DB_TYPE || 'mysql'}`);
      console.log(`🔌 WebSocket: Enabled`);
      console.log(`📊 Health Check: http://localhost:${PORT}/health`);
      console.log(`📡 Kafka: ${kafkaConnected ? 'Connected' : 'Disabled'}`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
      }
      
      console.log('='.repeat(50));
    });
    
    // Store server reference
    app.server = server;
    
    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      try {
        if (app.server) {
          app.server.close(() => {
            console.log('✅ HTTP server closed');
          });
        }
        
        try {
          const schedulerService = require('./services/SchedulerService');
          schedulerService.stop();
          console.log('✅ Scheduler stopped');
        } catch (error) {
          console.warn('⚠️ Error stopping scheduler:', error.message);
        }
        
        try {
          const kafkaProducer = require('./kafka/producer');
          const kafkaConsumer = require('./kafka/consumer');
          await kafkaProducer.disconnect();
          await kafkaConsumer.disconnect();
          console.log('✅ Kafka disconnected');
        } catch (error) {
          console.warn('⚠️ Error disconnecting Kafka:', error.message);
        }
        
        await database.disconnect();
        console.log('✅ Database disconnected');
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
        
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        logger.error(`Graceful shutdown failed: ${error.message}`, { stack: error.stack });
        process.exit(1);
      }
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      logger.error('Unhandled Rejection', { promise, reason });
    });
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    logger.error(`Server startup failed: ${error.message}`, { stack: error.stack });
    process.exit(1);
  }
}

// Start the server
startServer();