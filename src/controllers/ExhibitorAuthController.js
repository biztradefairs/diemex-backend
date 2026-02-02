const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class ExhibitorAuthController {
  // Enhanced login with debugging
  async login(req, res) {
    try {
      console.log('\n🔐 LOGIN ATTEMPT - ENHANCED');
      console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
      
      const { email, password } = req.body;
      
      if (!email || !password) {
        console.log('❌ Missing email or password');
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }
      
      const modelFactory = require('../models');
      const Exhibitor = modelFactory.getModel('Exhibitor');
      
      const cleanEmail = email.toLowerCase().trim();
      console.log('📧 Searching for email:', cleanEmail);
      
      // Find exhibitor
      const exhibitor = await Exhibitor.findOne({
        where: { email: cleanEmail }
      });
      
      if (!exhibitor) {
        console.log('❌ Exhibitor not found');
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }
      
      console.log('✅ Found exhibitor:', {
        id: exhibitor.id,
        name: exhibitor.name,
        email: exhibitor.email,
        status: exhibitor.status
      });
      
      // Check if password field exists and is valid
      if (!exhibitor.password) {
        console.log('❌ No password field in exhibitor record');
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }
      
      console.log('🔑 Stored password hash (first 30 chars):', exhibitor.password.substring(0, 30));
      console.log('🔑 Hash length:', exhibitor.password.length);
      console.log('🔄 Comparing password...');
      
      // Check password using bcrypt directly
      const isValid = await bcrypt.compare(password, exhibitor.password);
      console.log('🔑 Password comparison result:', isValid);
      
      if (!isValid) {
        console.log('❌ Password comparison failed');
        
        // Check metadata for original password
        if (exhibitor.metadata) {
          try {
            const metadata = typeof exhibitor.metadata === 'string' 
              ? JSON.parse(exhibitor.metadata) 
              : exhibitor.metadata;
            
            console.log('📝 Metadata found:', metadata);
            
            if (metadata.originalPassword) {
              console.log('🔍 Original password from metadata:', metadata.originalPassword);
              console.log('🔍 Testing with original password...');
              const checkWithOriginal = await bcrypt.compare(metadata.originalPassword, exhibitor.password);
              console.log('🔑 Check with original password:', checkWithOriginal);
              
              // If original password works, use it
              if (checkWithOriginal) {
                console.log('ℹ️ Original password from metadata works');
                // Continue with login
              }
            }
          } catch (metaError) {
            console.log('⚠️ Could not parse metadata:', metaError.message);
          }
        }
        
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }
      
      // Check account status
      const status = exhibitor.status?.toLowerCase();
      console.log('📊 Account status:', status);
      
      if (!['approved', 'active'].includes(status)) {
        return res.status(403).json({
          success: false,
          error: `Account is ${status}. Please contact administrator.`
        });
      }
      
      // Generate JWT token
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
      
      // Prepare response
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
          status: frontendStatus,
          createdAt: exhibitor.createdAt
        }
      };
      
      console.log('🎉 Login successful!');
      
      res.json({
        success: true,
        data: responseData,
        message: 'Login successful'
      });
      
    } catch (error) {
      console.error('🔥 Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: error.message
      });
    }
  }

  // Reset password endpoint
async resetPassword(req, res) {
  try {
    const { email, newPassword } = req.body;
    
    console.log('\n🔄 RESET PASSWORD - USING MODEL HOOK');
    
    const modelFactory = require('../models');
    const Exhibitor = modelFactory.getModel('Exhibitor');
    
    const exhibitor = await Exhibitor.findOne({
      where: { email: email.toLowerCase().trim() }
    });
    
    if (!exhibitor) {
      return res.status(404).json({
        success: false,
        error: 'Exhibitor not found'
      });
    }
    
    console.log('📝 Before update - current hash:', exhibitor.password?.substring(0, 30));
    
    // Update with _originalPassword so hook can store it
    await exhibitor.update({
      password: newPassword, // Pass plain password, let hook hash it
      _originalPassword: newPassword // For metadata
    });
    
    // Refresh to get updated data
    await exhibitor.reload();
    
    console.log('📝 After update - new hash:', exhibitor.password?.substring(0, 30));
    
    // Verify
    const bcrypt = require('bcryptjs');
    const isValid = await bcrypt.compare(newPassword, exhibitor.password);
    
    console.log('✅ Password verification:', isValid);
    
    res.json({
      success: true,
      message: 'Password reset successfully',
      data: {
        email: exhibitor.email,
        verified: isValid,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

  // Direct fix password endpoint (uses raw SQL)
  async fixPasswordDirect(req, res) {
    try {
      const { email, password } = req.body;
      
      console.log('\n🔧 FIXING PASSWORD DIRECTLY FOR:', email);
      
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }
      
      const sequelize = require('../config/database').getConnection('mysql');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Direct SQL update to bypass any hooks
      const query = `
        UPDATE exhibitors 
        SET password = ?, 
            metadata = JSON_SET(
              COALESCE(metadata, '{}'),
              '$.originalPassword', ?,
              '$.fixedAt', NOW(),
              '$.fixedBy', 'direct-fix'
            ),
            updatedAt = NOW()
        WHERE email = ?
      `;
      
      const [result] = await sequelize.query(query, {
        replacements: [hashedPassword, password, email.toLowerCase().trim()]
      });
      
      console.log('✅ Direct fix completed, affected rows:', result.affectedRows);
      
      res.json({
        success: true,
        message: 'Password fixed directly via SQL',
        data: {
          email: email,
          password: password,
          affectedRows: result.affectedRows,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Direct fix error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Test body parsing
  async testBodyParsing(req, res) {
    try {
      console.log('\n🧪 TESTING BODY PARSING');
      console.log('📦 Request body:', req.body);
      console.log('📦 Body type:', typeof req.body);
      console.log('📦 Body keys:', Object.keys(req.body || {}));
      
      res.json({
        success: true,
        body: req.body,
        bodyType: typeof req.body,
        bodyKeys: Object.keys(req.body || {})
      });
      
    } catch (error) {
      console.error('Test error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get profile
  async getProfile(req, res) {
    try {
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