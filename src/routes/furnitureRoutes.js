const express = require('express');
const router = express.Router();
const multer = require('multer');
const furnitureController = require('../controllers/FurnitureController');
const { authenticate, authorize } = require('../middleware/auth');

// ======================
// Multer Configuration for image upload
// ======================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
    }
  }
});

// ======================================================
// TEST ROUTE - To verify routes are working
// ======================================================
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Furniture API is working!',
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// PUBLIC ROUTES (Accessible without authentication)
// ======================================================

// Get statistics
router.get('/statistics', furnitureController.getStatistics);

// Get all furniture with filters - handle both with and without trailing slash
router.get('/', furnitureController.getAllFurniture);
router.get('', furnitureController.getAllFurniture);

// Search furniture
router.get('/search', furnitureController.searchFurniture);

// Get furniture by category
router.get('/category/:category', furnitureController.getFurnitureByCategory);

// Get single furniture by ID
router.get('/:id', furnitureController.getFurniture);

// ======================================================
// ADMIN ROUTES (Protected)
// ======================================================

// Create furniture
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  upload.single('image'),
  furnitureController.createFurniture
);
router.post(
  '',
  authenticate,
  authorize(['admin']),
  upload.single('image'),
  furnitureController.createFurniture
);

// Update furniture
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  upload.single('image'),
  furnitureController.updateFurniture
);

// Delete furniture
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  furnitureController.deleteFurniture
);

// Bulk delete furniture
router.delete(
  '/bulk/delete',
  authenticate,
  authorize(['admin']),
  furnitureController.bulkDeleteFurniture
);

// Update stock status
router.patch(
  '/:id/stock',
  authenticate,
  authorize(['admin']),
  furnitureController.updateStockStatus
);

module.exports = router;