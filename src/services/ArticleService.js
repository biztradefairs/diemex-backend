const { Op } = require('sequelize');

class ArticleService {
  constructor() {
    this._articleModel = null;
  }

  get Article() {
    if (!this._articleModel) {
      const modelFactory = require('../models');
      this._articleModel = modelFactory.getModel('Article');
      if (!this._articleModel) {
        throw new Error('Article model not found. Make sure models are initialized.');
      }
    }
    return this._articleModel;
  }

  async createArticle(articleData) {
    try {
      // Generate slug from title
      if (!articleData.slug && articleData.title) {
        articleData.slug = this.generateSlug(articleData.title);
      }

      const article = await this.Article.create(articleData);
      return article;
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Slug already exists');
      }
      throw new Error(`Failed to create article: ${error.message}`);
    }
  }

  async getAllArticles(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      let where = {};
      
      // Search filter
      if (filters.search) {
        where[Op.or] = [
          { title: { [Op.like]: `%${filters.search}%` } },
          { excerpt: { [Op.like]: `%${filters.search}%` } },
          { content: { [Op.like]: `%${filters.search}%` } }
        ];
      }
      
      // Category filter
      if (filters.category && filters.category !== 'all') {
        where.category = filters.category;
      }
      
      // Status filter
      if (filters.status && filters.status !== 'all') {
        where.status = filters.status;
      }

      // Use Sequelize findAndCountAll
      const result = await this.Article.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      return {
        articles: result.rows,
        total: result.count,
        page,
        totalPages: Math.ceil(result.count / limit)
      };
    } catch (error) {
      throw new Error(`Failed to fetch articles: ${error.message}`);
    }
  }

  async getArticleById(id) {
    try {
      const article = await this.Article.findByPk(id);
      
      if (!article) {
        throw new Error('Article not found');
      }
      
      // Increment views
      article.views = (article.views || 0) + 1;
      await article.save();
      
      return article;
    } catch (error) {
      throw new Error(`Failed to fetch article: ${error.message}`);
    }
  }

  async updateArticle(id, updateData) {
    try {
      // Generate slug if title is updated
      if (updateData.title && !updateData.slug) {
        updateData.slug = this.generateSlug(updateData.title);
      }

      const article = await this.Article.findByPk(id);
      if (!article) throw new Error('Article not found');
      
      await article.update(updateData);
      return article;
    } catch (error) {
      throw new Error(`Failed to update article: ${error.message}`);
    }
  }

  async deleteArticle(id) {
    try {
      const article = await this.Article.findByPk(id);
      if (!article) throw new Error('Article not found');
      
      await article.destroy();
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete article: ${error.message}`);
    }
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim();
  }

  async getArticleBySlug(slug) {
    try {
      const article = await this.Article.findOne({ where: { slug } });
      
      if (!article) {
        throw new Error('Article not found');
      }
      
      // Increment views
      article.views = (article.views || 0) + 1;
      await article.save();
      
      return article;
    } catch (error) {
      throw new Error(`Failed to fetch article: ${error.message}`);
    }
  }

  async getArticlesByCategory(category, limit = 10) {
    try {
      const articles = await this.Article.findAll({
        where: { 
          category,
          status: 'published'
        },
        limit,
        order: [['createdAt', 'DESC']]
      });
      
      return articles;
    } catch (error) {
      throw new Error(`Failed to get articles by category: ${error.message}`);
    }
  }

  async getPopularArticles(limit = 5) {
    try {
      const articles = await this.Article.findAll({
        where: { status: 'published' },
        limit,
        order: [['views', 'DESC']]
      });
      
      return articles;
    } catch (error) {
      throw new Error(`Failed to get popular articles: ${error.message}`);
    }
  }
}

module.exports = new ArticleService();