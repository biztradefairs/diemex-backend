// src/services/ArticleService.js
const { Op } = require('sequelize');

class ArticleService {
  constructor() {
    this._articleModel = null;
  }

  // Lazy getter for Article model
  get Article() {
    if (!this._articleModel) {
      const modelFactory = require('../models');
      this._articleModel = modelFactory.getModel('Article');
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
      
      // Send notification for new article
      if (article.status === 'published') {
        try {
          const kafkaProducer = require('../kafka/producer');
          await kafkaProducer.sendNotification('ARTICLE_PUBLISHED', null, {
            articleId: article.id,
            title: article.title
          });
        } catch (kafkaError) {
          console.warn('Kafka not available for notification:', kafkaError.message);
        }
      }

      return article;
    } catch (error) {
      throw new Error(`Failed to create article: ${error.message}`);
    }
  }

  async getAllArticles(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      let query = {};
      
      if (filters.search) {
        if (process.env.DB_TYPE === 'mysql') {
          query[Op.or] = [
            { title: { [Op.like]: `%${filters.search}%` } },
            { excerpt: { [Op.like]: `%${filters.search}%` } },
            { content: { [Op.like]: `%${filters.search}%` } }
          ];
        } else {
          query.$or = [
            { title: { $regex: filters.search, $options: 'i' } },
            { excerpt: { $regex: filters.search, $options: 'i' } },
            { content: { $regex: filters.search, $options: 'i' } }
          ];
        }
      }
      
      if (filters.category && filters.category !== 'all') {
        query.category = filters.category;
      }
      
      if (filters.status && filters.status !== 'all') {
        query.status = filters.status;
      }

      let articles, total;
      
      if (process.env.DB_TYPE === 'mysql') {
        const result = await this.Article.findAndCountAll({
          where: query,
          limit,
          offset,
          order: [['createdAt', 'DESC']]
        });
        
        articles = result.rows;
        total = result.count;
      } else {
        articles = await this.Article.find(query)
          .skip(offset)
          .limit(limit)
          .sort({ createdAt: -1 });
        
        total = await this.Article.countDocuments(query);
      }

      return {
        articles,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw new Error(`Failed to fetch articles: ${error.message}`);
    }
  }

  async getArticleById(id) {
    try {
      let article;
      
      if (process.env.DB_TYPE === 'mysql') {
        article = await this.Article.findByPk(id);
      } else {
        article = await this.Article.findById(id);
      }
      
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

      let article;
      
      if (process.env.DB_TYPE === 'mysql') {
        article = await this.Article.findByPk(id);
        if (!article) throw new Error('Article not found');
        
        // Send notification if status changed to published
        if (updateData.status === 'published' && article.status !== 'published') {
          try {
            const kafkaProducer = require('../kafka/producer');
            await kafkaProducer.sendNotification('ARTICLE_PUBLISHED', null, {
              articleId: id,
              title: updateData.title || article.title
            });
          } catch (kafkaError) {
            console.warn('Kafka not available for notification:', kafkaError.message);
          }
        }
        
        await article.update(updateData);
      } else {
        // Check if status is being changed to published
        if (updateData.status === 'published') {
          const current = await this.Article.findById(id);
          if (current && current.status !== 'published') {
            try {
              const kafkaProducer = require('../kafka/producer');
              await kafkaProducer.sendNotification('ARTICLE_PUBLISHED', null, {
                articleId: id,
                title: updateData.title || current.title
              });
            } catch (kafkaError) {
              console.warn('Kafka not available for notification:', kafkaError.message);
            }
          }
        }
        
        article = await this.Article.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        if (!article) throw new Error('Article not found');
      }

      return article;
    } catch (error) {
      throw new Error(`Failed to update article: ${error.message}`);
    }
  }

  async deleteArticle(id) {
    try {
      let result;
      
      if (process.env.DB_TYPE === 'mysql') {
        const article = await this.Article.findByPk(id);
        if (!article) throw new Error('Article not found');
        await article.destroy();
        result = { success: true };
      } else {
        result = await this.Article.findByIdAndDelete(id);
        if (!result) throw new Error('Article not found');
      }

      return result;
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
      let article;
      
      if (process.env.DB_TYPE === 'mysql') {
        article = await this.Article.findOne({ where: { slug } });
      } else {
        article = await this.Article.findOne({ slug });
      }
      
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
      let articles;
      
      if (process.env.DB_TYPE === 'mysql') {
        articles = await this.Article.findAll({
          where: { 
            category,
            status: 'published'
          },
          limit,
          order: [['createdAt', 'DESC']]
        });
      } else {
        articles = await this.Article.find({ 
          category,
          status: 'published'
        })
        .limit(limit)
        .sort({ createdAt: -1 });
      }
      
      return articles;
    } catch (error) {
      throw new Error(`Failed to get articles by category: ${error.message}`);
    }
  }

  async getPopularArticles(limit = 5) {
    try {
      let articles;
      
      if (process.env.DB_TYPE === 'mysql') {
        articles = await this.Article.findAll({
          where: { status: 'published' },
          limit,
          order: [['views', 'DESC']]
        });
      } else {
        articles = await this.Article.find({ status: 'published' })
          .limit(limit)
          .sort({ views: -1 });
      }
      
      return articles;
    } catch (error) {
      throw new Error(`Failed to get popular articles: ${error.message}`);
    }
  }
}

module.exports = new ArticleService();