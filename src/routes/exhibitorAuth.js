const router = require('express').Router();
const exhibitorAuthController = require('../controllers/ExhibitorAuthController');
const { authenticateExhibitor } = require('../middleware/auth');

// Test route to check if controller is loaded
router.get('/test', (req, res) => {
  console.log('✅ Exhibitor auth routes working');
  res.json({ 
    success: true, 
    message: 'Exhibitor auth routes working',
    endpoints: {
      login: 'POST /api/auth/exhibitor/login',
      profile: 'GET /api/auth/exhibitor/profile (protected)',
      test: 'GET /api/auth/exhibitor/test'
    }
  });
});

// Test login endpoint
router.post('/test-login', exhibitorAuthController.testLogin);

// Login route
router.post('/login', exhibitorAuthController.login);

// Profile route (protected)
router.get('/profile', authenticateExhibitor, exhibitorAuthController.getProfile);

module.exports = router;