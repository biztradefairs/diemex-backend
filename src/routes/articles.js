// src/routes/articles.js
const express = require('express');
const router = express.Router();
const articleController = require('../controllers/ArticleController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.get('/', articleController.getAllArticles);
router.get('/:id', articleController.getArticle);

// Protected routes
router.use(authenticate);

// Create, update, delete (admin/editor only)
router.post('/', authorize(['admin', 'editor']), articleController.createArticle);
router.put('/:id', authorize(['admin', 'editor']), articleController.updateArticle);
router.delete('/:id', authorize(['admin', 'editor']), articleController.deleteArticle);

// Upload image
router.post('/upload', authorize(['admin', 'editor']), upload.single('image'), articleController.uploadImage);

module.exports = router;