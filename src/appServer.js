// src/appServer.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const path = require('path');
const compression = require('compression');
const hpp = require('hpp');
require('express-async-errors');

// Import configurations
const kafkaProducer = require('./kafka/producer');
const kafkaConsumer = require('./kafka/consumer');

// Import services
const schedulerService = require('./services/SchedulerService');
const logger = require('./utils/logger');

// Import middleware
const { authenticate, authorize } = require('./middleware/auth');
const { errorHandler, notFound } = require('./middleware/error');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const articleRoutes = require('./routes/articles');
const exhibitorRoutes = require('./routes/exhibitors');
const floorPlanRoutes = require('./routes/floorPlans');
const paymentRoutes = require('./routes/payments');
const invoiceRoutes = require('./routes/invoices');
const revenueRoutes = require('./routes/revenue');
const mediaRoutes = require('./routes/media');
const monitoringRoutes = require('./routes/monitoring');

const app = express();
const PORT = process.env.PORT || 5000;

// ========================
// SECURITY MIDDLEWARE
// ========================

// Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Enable CORS
app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to API routes
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ 
  limit: process.env.MAX_REQUEST_SIZE || '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_REQUEST_SIZE || '10mb'
}));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// Compression
app.use(compression());

// ========================
// STATIC FILES
// ========================

const uploadsDir = process.env.UPLOAD_PATH || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));
app.use('/public', express.static(path.join(__dirname, '../public')));

// ========================
// REQUEST LOGGING
// ========================

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
});

// ========================
// HEALTH CHECK
// ========================

app.get('/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'Exhibition Admin API',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    database: process.env.DB_TYPE,
    status: 'OK'
  };
  
  res.json(healthcheck);
});

// ========================
// API DOCUMENTATION
// ========================

if (process.env.NODE_ENV !== 'production') {
  const swaggerUi = require('swagger-ui-express');
  const swaggerSpecs = require('./docs/swagger');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
}

// ========================
// API ROUTES
// ========================

app.use('/api/auth', authRoutes);
app.use('/api/users', authenticate, userRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/exhibitors', authenticate, exhibitorRoutes);
app.use('/api/floor-plans', authenticate, floorPlanRoutes);
app.use('/api/payments', authenticate, paymentRoutes);
app.use('/api/invoices', authenticate, invoiceRoutes);
app.use('/api/revenue', authenticate, revenueRoutes);
app.use('/api/media', authenticate, mediaRoutes);
app.use('/api/monitoring', authenticate, monitoringRoutes);

// ========================
// DASHBOARD ROUTES
// ========================

app.get('/api/dashboard/summary', authenticate, authorize(['admin', 'editor']), async (req, res) => {
  try {
    const UserService = require('./services/UserService');
    const ArticleService = require('./services/ArticleService');
    const ExhibitorService = require('./services/ExhibitorService');
    const PaymentService = require('./services/PaymentService');
    const RevenueService = require('./services/RevenueService');
    
    const [
      userStats,
      articleStats,
      exhibitorStats,
      paymentStats,
      revenueStats
    ] = await Promise.all([
      UserService.getAllUsers({}, 1, 5),
      ArticleService.getAllArticles({}, 1, 5),
      ExhibitorService.getAllExhibitors({}, 1, 5),
      PaymentService.getPaymentStats('month'),
      RevenueService.getRevenueSummary('month')
    ]);
    
    const summary = {
      users: {
        total: userStats.total,
        recent: userStats.users
      },
      articles: {
        total: articleStats.total,
        recent: articleStats.articles
      },
      exhibitors: {
        total: exhibitorStats.total,
        recent: exhibitorStats.exhibitors
      },
      payments: paymentStats,
      revenue: revenueStats,
      activities: [
        { id: 1, action: 'System started', user: 'System', time: new Date().toISOString() }
      ]
    };
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================
// ERROR HANDLING
// ========================

app.use('*', notFound);
app.use(errorHandler);

module.exports = app;