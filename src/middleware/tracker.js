// middleware/tracker.js
const modelFactory = require('../models');

const trackPageView = async (req, res, next) => {
  try {
    // Don't track admin routes
    if (req.path.startsWith('/admin') || req.path.startsWith('/api')) {
      return next();
    }

    // Check if user is authenticated and is exhibitor
    const authHeader = req.headers.authorization;
    let isExhibitor = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'exhibitor') {
          isExhibitor = true;
        }
      } catch (err) {
        // Invalid token, treat as visitor
      }
    }

    // Only track visitors (not exhibitors)
    if (!isExhibitor) {
      const Visitor = modelFactory.getModel('Visitor');
      
      // Track unique visit by session or IP
      const sessionId = req.session?.id || req.ip;
      
      // You can implement page view tracking here
      // This could be stored in a separate PageView model
    }
    
    next();
  } catch (error) {
    console.error('Error tracking page view:', error);
    next();
  }
};

module.exports = { trackPageView };