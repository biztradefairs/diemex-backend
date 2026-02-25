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
      forgotPassword: 'POST /api/auth/exhibitor/forgot-password',
      resetPasswordWithToken: 'POST /api/auth/exhibitor/reset-password-with-token',
      validateResetToken: 'GET /api/auth/exhibitor/validate-reset-token/:token',
      resetPassword: 'POST /api/auth/exhibitor/reset-password',
      fixPassword: 'POST /api/auth/exhibitor/fix-password-direct',
      profile: 'GET /api/auth/exhibitor/profile (protected)'
    }
  });
});

// Test endpoints
router.post('/test-login', exhibitorAuthController.testLogin);
router.post('/test-body', exhibitorAuthController.testBodyParsing);

// Password reset endpoints
router.post('/forgot-password', exhibitorAuthController.forgotPassword);
router.post('/reset-password-with-token', exhibitorAuthController.resetPasswordWithToken);
router.get('/validate-reset-token/:token', exhibitorAuthController.validateResetToken);

// Auth endpoints
router.post('/login', exhibitorAuthController.login);
router.post('/reset-password', exhibitorAuthController.resetPassword);
router.post('/fix-password-direct', exhibitorAuthController.fixPasswordDirect);

// Profile route (protected)
router.get('/profile', authenticateExhibitor, exhibitorAuthController.getProfile);

module.exports = router;