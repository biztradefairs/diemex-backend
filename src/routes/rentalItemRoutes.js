const express = require('express');
const router = express.Router();
const multer = require('multer');
const rentalItemController = require('../controllers/RentalItemController');
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
    message: 'Rental Item API is working!',
    timestamp: new Date().toISOString()
  });
});

// ======================================================
// PUBLIC ROUTES (Accessible without authentication)
// ======================================================

// Get statistics
router.get('/statistics', rentalItemController.getStatistics);

// Get all items with filters - handle both with and without trailing slash
router.get('/', rentalItemController.getAllItems);
router.get('', rentalItemController.getAllItems);

// Get items by category
router.get('/category/:category', rentalItemController.getItemsByCategory);

// Get single item by ID
router.get('/:id', rentalItemController.getItem);

// ======================================================
// ADMIN ROUTES (Protected)
// ======================================================

// Create item
router.post(
  '/',
  authenticate,
  authorize(['admin']),
  upload.single('image'),
  rentalItemController.createItem
);
router.post(
  '',
  authenticate,
  authorize(['admin']),
  upload.single('image'),
  rentalItemController.createItem
);

// Update item
router.put(
  '/:id',
  authenticate,
  authorize(['admin']),
  upload.single('image'),
  rentalItemController.updateItem
);

// Delete item
router.delete(
  '/:id',
  authenticate,
  authorize(['admin']),
  rentalItemController.deleteItem
);

// Bulk delete items
router.delete(
  '/bulk/delete',
  authenticate,
  authorize(['admin']),
  rentalItemController.bulkDeleteItems
);

// Update display order
router.patch(
  '/display-order/update',
  authenticate,
  authorize(['admin']),
  rentalItemController.updateDisplayOrder
);

// Reorder all items
router.post(
  '/reorder',
  authenticate,
  authorize(['admin']),
  rentalItemController.reorderItems
);

// Toggle active status
router.patch(
  '/:id/toggle-status',
  authenticate,
  authorize(['admin']),
  rentalItemController.toggleActiveStatus
);

module.exports = router;