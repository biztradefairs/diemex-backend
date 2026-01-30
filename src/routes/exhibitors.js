const router = require('express').Router();
const exhibitorController = require('../controllers/ExhibitorController');

// Public routes
router.get('/', exhibitorController.getAllExhibitors);
router.get('/stats', exhibitorController.getExhibitorStats);
router.get('/:id', exhibitorController.getExhibitor);

// Protected routes
router.post('/', exhibitorController.createExhibitor);
router.put('/:id', exhibitorController.updateExhibitor);
router.delete('/:id', exhibitorController.deleteExhibitor);
router.post('/bulk/update-status', exhibitorController.bulkUpdateStatus);

// Add resend credentials route
router.post('/:id/resend-credentials', exhibitorController.resendCredentials);

module.exports = router;