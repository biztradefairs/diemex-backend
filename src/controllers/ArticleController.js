// src/controllers/ArticleController.js
const articleService = require('../services/ArticleService');

class ArticleController {
  async createArticle(req, res) {
    try {
      const article = await articleService.createArticle(req.body);
      
      res.status(201).json({
        success: true,
        data: article
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAllArticles(req, res) {
    try {
      const { page = 1, limit = 10, search, category, status } = req.query;
      
      const filters = {};
      if (search) filters.search = search;
      if (category) filters.category = category;
      if (status) filters.status = status;
      
      const result = await articleService.getAllArticles(filters, parseInt(page), parseInt(limit));
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getArticle(req, res) {
    try {
      const article = await articleService.getArticleById(req.params.id);
      
      res.json({
        success: true,
        data: article
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateArticle(req, res) {
    try {
      const article = await articleService.updateArticle(req.params.id, req.body);
      
      res.json({
        success: true,
        data: article
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteArticle(req, res) {
    try {
      await articleService.deleteArticle(req.params.id);
      
      res.json({
        success: true,
        message: 'Article deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async uploadImage(req, res) {
    try {
      if (!req.file) {
        throw new Error('No file uploaded');
      }
      
      const imageUrl = `/uploads/${req.file.filename}`;
      
      res.json({
        success: true,
        data: {
          url: imageUrl,
          filename: req.file.filename,
          size: req.file.size
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new ArticleController();