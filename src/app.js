require('dotenv').config();
const http = require('http');
const socketIo = require('socket.io');
const database = require('./config/database');
const logger = require('./utils/logger');

async function createDefaultAdmin() {
  try {
    console.log('👤 Creating default admin user...');
    
    const modelFactory = require('./models');
    
    // Initialize models
    await modelFactory.init();
    
    const User = modelFactory.getModel('User');
    const bcrypt = require('bcryptjs');
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@exhibition.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    // Check if admin already exists
    const adminUser = await User.findOne({ where: { email: adminEmail } });
    
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      await User.create({
        name: 'Administrator',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        status: 'active',
        phone: '+1234567890'
      });
      
      console.log('✅ Default admin user created');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
}

async function startServer() {
  try {
    console.log('🚀 Starting Exhibition Admin Backend...');
    console.log('='.repeat(50));
    console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Database: ${process.env.DB_TYPE || 'mysql'}`);
    console.log(`🌐 Port: ${process.env.PORT || 5000}`);
    console.log('='.repeat(50));
    
    // 1️⃣ Connect to database FIRST
    console.log('\n🔗 Step 1: Connecting to database...');
    await database.connect();
    console.log('✅ Database connected successfully');
    
    // 2️⃣ Create default admin user
    console.log('\n👤 Step 2: Creating default admin user...');
    await createDefaultAdmin();
    
    // 3️⃣ Load Express app
    console.log('\n🚀 Step 3: Loading Express app...');
    const app = require('./appServer');
    const PORT = process.env.PORT || 5000;
    
    // 4️⃣ Create HTTP server
    const server = http.createServer(app);
    
    // 5️⃣ Initialize WebSocket
    console.log('\n🔌 Step 4: Initializing WebSocket...');
    const io = socketIo(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    
    console.log('✅ WebSocket service initialized');
    
    // 6️⃣ Start server
    console.log('\n🎯 Step 5: Starting server...');
    server.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(50));
      console.log('🎉 SERVER STARTED SUCCESSFULLY!');
      console.log('='.repeat(50));
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️ Database: ${process.env.DB_TYPE || 'mysql'}`);
      console.log(`📊 Health Check: http://localhost:${PORT}/health`);
      console.log(`🔍 Swagger UI: http://localhost:${PORT}/api-docs`);
      console.log('='.repeat(50));
    });
    
    // Store server reference
    app.server = server;
    app.io = io;
    
    // Graceful shutdown handler
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);
      
      try {
        // Close HTTP server
        if (server) {
          server.close(() => {
            console.log('✅ HTTP server closed');
          });
        }
        
        // Disconnect database
        await database.disconnect();
        console.log('✅ Database disconnected');
        
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle unhandled errors
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();