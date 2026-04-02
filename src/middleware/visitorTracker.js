// middleware/visitorTracker.js
const { v4: uuidv4 } = require('uuid');

// Simple in-memory store (use Redis or DB in production)
const visitorSessions = new Map();

const trackVisitor = async (req, res, next) => {
  try {
    // Don't track admin routes
    if (req.path.startsWith('/admin') || req.path.startsWith('/api')) {
      return next();
    }
    
    // Check if user is authenticated as exhibitor
    const authHeader = req.headers.authorization;
    let isExhibitor = false;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        if (decoded.role === 'exhibitor') {
          isExhibitor = true;
        }
      } catch (err) {
        // Invalid token, treat as visitor
      }
    }
    
    // Track only non-exhibitor visitors
    if (!isExhibitor) {
      const sessionId = req.cookies?.visitor_session || uuidv4();
      
      // Set cookie if not exists
      if (!req.cookies?.visitor_session) {
        res.cookie('visitor_session', sessionId, {
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production'
        });
      }
      
      // Track unique visit
      const today = new Date().toISOString().split('T')[0];
      const visitorKey = `${sessionId}_${today}`;
      
      if (!visitorSessions.has(visitorKey)) {
        visitorSessions.set(visitorKey, {
          sessionId,
          date: today,
          path: req.path,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date()
        });
        
        console.log(`📊 New visitor tracked: ${sessionId} on ${today}`);
        
        // You can also save to database here
        // await saveVisitorToDatabase(req, sessionId);
      }
    }
    
    next();
  } catch (error) {
    console.error('Error tracking visitor:', error);
    next();
  }
};

// Get visitor stats from memory
const getVisitorStats = () => {
  const today = new Date().toISOString().split('T')[0];
  const uniqueVisitorsToday = new Set();
  const uniqueVisitorsTotal = new Set();
  
  for (const [key, value] of visitorSessions.entries()) {
    uniqueVisitorsTotal.add(value.sessionId);
    if (value.date === today) {
      uniqueVisitorsToday.add(value.sessionId);
    }
  }
  
  return {
    total: uniqueVisitorsTotal.size,
    today: uniqueVisitorsToday.size,
    sessions: visitorSessions.size
  };
};

module.exports = { trackVisitor, getVisitorStats };