// services/DashboardService.js
const { Op } = require('sequelize');
const modelFactory = require('../models');
const { getVisitorStatsDetailed } = require('../services/googleAnalytics');

class DashboardService {
  constructor() {
    this.models = null;
  }

  async getModels() {
    if (!this.models) {
      await modelFactory.init();
      this.models = modelFactory.getAllModels();
    }
    return this.models;
  }

  async getDashboardSummary() {
    try {
      const models = await this.getModels();
      
      // Get user stats
      const userStats = await this.getUserStats(models);
      
      // Get exhibitor stats
      const exhibitorStats = await this.getExhibitorStats(models);
      
      // Get visitor stats
      const visitorStats = await this.getVisitorStats(models);
      
      // Get revenue stats (if Invoice model exists)
      let revenueStats = {
        totalRevenue: 0,
        monthRevenue: 0,
        pendingAmount: 0
      };
      
      if (models.Invoice) {
        revenueStats = await this.getRevenueStats(models);
      }
      
      // Get article stats
      let articleStats = {
        total: 0,
        published: 0,
        recent: []
      };
      
      if (models.Article) {
        articleStats = await this.getArticleStats(models);
      }
      
      // Get recent activities
      const recentActivities = await this.getRecentActivities(models);
      
      return {
        users: userStats,
        exhibitors: exhibitorStats,
        visitors: visitorStats,
        revenue: revenueStats,
        articles: articleStats,
        activities: recentActivities
      };
    } catch (error) {
      console.error('Error getting dashboard summary:', error);
      throw error;
    }
  }

  async getUserStats(models) {
    try {
      const total = await models.User.count();
      const active = await models.User.count({
        where: { status: 'active' }
      });
      const inactive = await models.User.count({
        where: { status: 'inactive' }
      });
      
      // Get users by role
      const admins = await models.User.count({
        where: { role: 'admin' }
      });
      const editors = await models.User.count({
        where: { role: 'editor' }
      });
      const viewers = await models.User.count({
        where: { role: 'viewer' }
      });
      
      // Get new users this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const newThisWeek = await models.User.count({
        where: {
          createdAt: { [Op.gte]: weekAgo }
        }
      });
      
      return {
        total,
        active,
        inactive,
        admins,
        editors,
        viewers,
        newThisWeek
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return { total: 0, active: 0, inactive: 0, admins: 0, editors: 0, viewers: 0, newThisWeek: 0 };
    }
  }

  async getExhibitorStats(models) {
    try {
      if (!models.Exhibitor) {
        return { total: 0, active: 0, pending: 0, inactive: 0, approved: 0, rejected: 0 };
      }
      
      const total = await models.Exhibitor.count();
      const active = await models.Exhibitor.count({
        where: { status: 'active' }
      });
      const pending = await models.Exhibitor.count({
        where: { status: 'pending' }
      });
      const approved = await models.Exhibitor.count({
        where: { status: 'approved' }
      });
      const rejected = await models.Exhibitor.count({
        where: { status: 'rejected' }
      });
      const inactive = await models.Exhibitor.count({
        where: { status: 'inactive' }
      });
      
      // Get new exhibitors this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const newThisWeek = await models.Exhibitor.count({
        where: {
          createdAt: { [Op.gte]: weekAgo }
        }
      });
      
      // Get exhibitors by sector
      const bySector = await models.Exhibitor.findAll({
        attributes: [
          'sector',
          [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count']
        ],
        where: {
          sector: { [Op.ne]: null }
        },
        group: ['sector'],
        limit: 10
      });
      
      return {
        total,
        active,
        pending,
        approved,
        rejected,
        inactive,
        newThisWeek,
        bySector: bySector.map(item => ({
          sector: item.sector,
          count: parseInt(item.dataValues.count)
        }))
      };
    } catch (error) {
      console.error('Error getting exhibitor stats:', error);
      return { total: 0, active: 0, pending: 0, inactive: 0, approved: 0, rejected: 0, newThisWeek: 0, bySector: [] };
    }
  }



async getVisitorStats(models) {
  try {
    const stats = await getVisitorStatsDetailed();

    return {
      total: stats.total,
      today: stats.today,
      week: stats.week,
      month: stats.month,
      last7Days: stats.last7Days,
      topCompanies: stats.topCompanies,
      source: 'google-analytics'
    };

  } catch (error) {
    console.error('❌ GA Visitor Stats Error:', error);

    return {
      total: 0,
      today: 0,
      week: 0,
      month: 0,
      last7Days: [],
      topCompanies: [],
      source: 'error'
    };
  }
}

  async getRevenueStats(models) {
    try {
      if (!models.Invoice) {
        return { totalRevenue: 0, monthRevenue: 0, pendingAmount: 0 };
      }
      
      // Total revenue from paid invoices
      const totalRevenue = await models.Invoice.sum('amount', {
        where: { status: 'paid' }
      }) || 0;
      
      // This month's revenue
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthRevenue = await models.Invoice.sum('amount', {
        where: {
          status: 'paid',
          createdAt: { [Op.gte]: monthStart }
        }
      }) || 0;
      
      // Pending amount
      const pendingAmount = await models.Invoice.sum('amount', {
        where: { status: 'pending' }
      }) || 0;
      
      // Invoice counts
      const totalInvoices = await models.Invoice.count();
      const paidInvoices = await models.Invoice.count({
        where: { status: 'paid' }
      });
      const pendingInvoices = await models.Invoice.count({
        where: { status: 'pending' }
      });
      
      return {
        totalRevenue,
        monthRevenue,
        pendingAmount,
        invoices: {
          total: totalInvoices,
          paid: paidInvoices,
          pending: pendingInvoices
        }
      };
    } catch (error) {
      console.error('Error getting revenue stats:', error);
      return { totalRevenue: 0, monthRevenue: 0, pendingAmount: 0, invoices: { total: 0, paid: 0, pending: 0 } };
    }
  }

  async getArticleStats(models) {
    try {
      if (!models.Article) {
        return { total: 0, published: 0, recent: [] };
      }
      
      const total = await models.Article.count();
      const published = await models.Article.count({
        where: { status: 'published' }
      });
      
      // Recent articles
      const recent = await models.Article.findAll({
        attributes: ['id', 'title', 'views', 'status', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit: 5
      });
      
      // Most viewed articles
      const topViewed = await models.Article.findAll({
        attributes: ['id', 'title', 'views', 'status'],
        order: [['views', 'DESC']],
        limit: 5,
        where: { status: 'published' }
      });
      
      return {
        total,
        published,
        draft: total - published,
        recent: recent.map(article => ({
          id: article.id,
          title: article.title,
          views: article.views || 0,
          status: article.status,
          date: article.createdAt
        })),
        topViewed: topViewed.map(article => ({
          id: article.id,
          title: article.title,
          views: article.views || 0,
          status: article.status
        }))
      };
    } catch (error) {
      console.error('Error getting article stats:', error);
      return { total: 0, published: 0, recent: [], topViewed: [] };
    }
  }

  async getRecentActivities(models) {
    try {
      const activities = [];
      
      // Get recent user registrations
      const recentUsers = await models.User.findAll({
        attributes: ['id', 'name', 'email', 'role', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit: 5
      });
      
      recentUsers.forEach(user => {
        activities.push({
          id: `user-${user.id}`,
          action: `New user registered: ${user.name}`,
          user: user.email,
          time: user.createdAt,
          type: 'user_registration',
          icon: 'UserPlus'
        });
      });
      
      // Get recent exhibitor registrations
      if (models.Exhibitor) {
        const recentExhibitors = await models.Exhibitor.findAll({
          attributes: ['id', 'name', 'company', 'email', 'status', 'createdAt'],
          order: [['createdAt', 'DESC']],
          limit: 5
        });
        
        recentExhibitors.forEach(exhibitor => {
          activities.push({
            id: `exhibitor-${exhibitor.id}`,
            action: `New exhibitor registration: ${exhibitor.company}`,
            user: exhibitor.email,
            time: exhibitor.createdAt,
            type: 'exhibitor_registration',
            icon: 'Building',
            status: exhibitor.status
          });
        });
      }
      
      // Get recent visitor registrations
      if (models.Visitor) {
        const recentVisitors = await models.Visitor.findAll({
          attributes: ['id', 'name', 'company', 'email', 'registeredAt'],
          order: [['registeredAt', 'DESC']],
          limit: 5
        });
        
        recentVisitors.forEach(visitor => {
          activities.push({
            id: `visitor-${visitor.id}`,
            action: `New visitor registration: ${visitor.name} from ${visitor.company}`,
            user: visitor.email,
            time: visitor.registeredAt,
            type: 'visitor_registration',
            icon: 'Users'
          });
        });
      }
      
      // Sort by time and get latest 10
      activities.sort((a, b) => new Date(b.time) - new Date(a.time));
      
      return activities.slice(0, 10);
    } catch (error) {
      console.error('Error getting recent activities:', error);
      return [];
    }
  }

  async getSystemHealth() {
    try {
      const models = await this.getModels();
      
      // Check database connection
      let databaseStatus = 'OK';
      try {
        await models.sequelize.authenticate();
      } catch (err) {
        databaseStatus = 'ERROR';
      }
      
      return {
        status: databaseStatus === 'OK' ? 'healthy' : 'unhealthy',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        services: {
          database: databaseStatus,
          redis: 'NOT_CONFIGURED',
          kafka: process.env.ENABLE_KAFKA === 'true' ? 'CONFIGURED' : 'DISABLED'
        }
      };
    } catch (error) {
      console.error('Error getting system health:', error);
      return {
        status: 'unhealthy',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

module.exports = new DashboardService();