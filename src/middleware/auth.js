const jwt = require('jsonwebtoken');

// Middleware to authenticate user (admin/editor/viewer)
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const modelFactory = require('../models');
    const User = modelFactory.getModel('User');

    // ✅ ALWAYS Sequelize
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Account is not active'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }

    res.status(500).json({ success: false, error: error.message });
  }
};

// Role-based authorization
const authorize = (roles = []) => {
  if (typeof roles === 'string') roles = [roles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to access this resource'
      });
    }

    next();
  };
};

// Exhibitor authentication (also Sequelize)
const authenticateExhibitor = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'exhibitor') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Exhibitor access required.'
      });
    }

    const modelFactory = require('../models');
    const Exhibitor = modelFactory.getModel('Exhibitor');

    // ✅ ALWAYS Sequelize
    const exhibitor = await Exhibitor.findByPk(decoded.id);

    if (!exhibitor) {
      return res.status(401).json({
        success: false,
        error: 'Exhibitor not found'
      });
    }

    if (exhibitor.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Account is not active'
      });
    }

    req.user = {
      id: exhibitor.id,
      email: exhibitor.email,
      company: exhibitor.company,
      role: 'exhibitor'
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }

    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  authenticate,
  authorize,
  authenticateExhibitor
};
