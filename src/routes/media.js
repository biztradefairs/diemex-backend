// src/routes/media.js
const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/MediaController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require authentication
router.use(authenticate);

// Get all media (admin/editor only)
router.get('/', authorize(['admin', 'editor']), mediaController.getAllMedia);

// Get media stats
router.get('/stats', authorize(['admin', 'editor']), mediaController.getMediaStats);

// Get single media
router.get('/:id', authorize(['admin', 'editor']), mediaController.getMedia);

// Upload media (admin/editor only)
router.post('/upload', authorize(['admin', 'editor']), upload.single('file'), mediaController.uploadMedia);

// Update media (admin/editor only)
router.put('/:id', authorize(['admin', 'editor']), mediaController.updateMedia);

// Delete media (admin only)
router.delete('/:id', authorize(['admin']), mediaController.deleteMedia);

// Bulk upload
router.post('/bulk-upload', authorize(['admin', 'editor']), upload.array('files', 10), mediaController.bulkUpload);

// Cleanup orphaned files (admin only)
router.post('/cleanup', authorize(['admin']), mediaController.cleanupOrphanedFiles);

module.exports = router;