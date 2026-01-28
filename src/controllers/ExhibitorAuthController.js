const jwt = require('jsonwebtoken');

class ExhibitorAuthController {
async login(req, res) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    const modelFactory = require('../models');
    const Exhibitor = modelFactory.getModel('Exhibitor');
    
    const cleanEmail = email.toLowerCase().trim();
    const exhibitor = await Exhibitor.findOne({
      where: { email: cleanEmail }
    });
    
    if (!exhibitor) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Check password
    const isValid = await exhibitor.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    // Check status - "approved" means "active" in frontend
    const status = exhibitor.status?.toLowerCase();
    console.log('📊 Account status:', status);
    
    // Allow both "approved" (database) and "active" (frontend)
    if (!['approved', 'active'].includes(status)) {
      return res.status(403).json({
        success: false,
        error: `Account is ${status}. Please contact administrator.`
      });
    }
    
    // Generate token
    const jwtSecret = process.env.JWT_SECRET || 'exhibitor-secret-key-change-in-production';
    const token = jwt.sign(
      {
        id: exhibitor.id,
        email: exhibitor.email,
        company: exhibitor.company,
        name: exhibitor.name,
        role: 'exhibitor',
        status: exhibitor.status
      },
      jwtSecret,
      { expiresIn: '7d' }
    );
    
    // Update last login
    await exhibitor.update({ lastLogin: new Date() });
    
    // Prepare response - map "approved" to "active" for frontend
    const frontendStatus = exhibitor.status === 'approved' ? 'active' : exhibitor.status;
    
    const responseData = {
      token,
      exhibitor: {
        id: exhibitor.id,
        name: exhibitor.name,
        email: exhibitor.email,
        phone: exhibitor.phone,
        company: exhibitor.company,
        sector: exhibitor.sector,
        booth: exhibitor.boothNumber,
        status: frontendStatus, // Use mapped status
        createdAt: exhibitor.createdAt
      }
    };
    
    res.json({
      success: true,
      data: responseData,
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

  async getProfile(req, res) {
    try {
      console.log('\n👤 PROFILE REQUEST');
      
      const exhibitorId = req.user?.id;
      if (!exhibitorId) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
      }
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      const exhibitor = await Exhibitor.findByPk(exhibitorId, {
        attributes: { exclude: ['password'] }
      });
      
      if (!exhibitor) {
        return res.status(404).json({
          success: false,
          error: 'Exhibitor not found'
        });
      }
      
      res.json({
        success: true,
        data: exhibitor
      });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  
  // Simple test endpoint
  async testLogin(req, res) {
    console.log('🧪 Test login endpoint called');
    res.json({
      success: true,
      message: 'Auth endpoint is working',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new ExhibitorAuthController();