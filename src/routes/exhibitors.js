const router = require('express').Router();
const exhibitorController = require('../controllers/ExhibitorController');

// Public routes
router.get('/', exhibitorController.getAllExhibitors);
router.get('/stats', exhibitorController.getExhibitorStats);
router.get('/:id', exhibitorController.getExhibitor);

// Protected routes - no authentication for now to debug
router.post('/', exhibitorController.createExhibitor);
router.put('/:id', exhibitorController.updateExhibitor);
router.delete('/:id', exhibitorController.deleteExhibitor);
router.post('/bulk/update-status', exhibitorController.bulkUpdateStatus);

module.exports = router;