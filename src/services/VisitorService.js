// services/VisitorService.js
const { Sequelize } = require('sequelize');
const modelFactory = require('../models');

class VisitorService {
  constructor() {
    this.Visitor = null;
    this.Exhibitor = null;
  }

  async init() {
    if (!this.Visitor) {
      const models = await modelFactory.init();
      this.Visitor = models.Visitor;
      this.Exhibitor = models.Exhibitor;
    }
  }

  async createVisitor(visitorData, req = null) {
    await this.init();
    
    // Check if visitor already exists
    const existingVisitor = await this.Visitor.findOne({
      where: { email: visitorData.email }
    });

    if (existingVisitor) {
      // Update existing visitor
      return await existingVisitor.update({
        ...visitorData,
        registeredAt: new Date(),
        ipAddress: req?.ip || req?.connection?.remoteAddress,
        userAgent: req?.headers?.['user-agent'],
        referrer: req?.headers?.referer
      });
    }

    // Create new visitor
    const visitor = await this.Visitor.create({
      ...visitorData,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent'],
      referrer: req?.headers?.referer
    });

    return visitor;
  }

  async getVisitorStats(filters = {}) {
    await this.init();

    const { startDate, endDate, company } = filters;

    const where = {};
    if (startDate && endDate) {
      where.registeredAt = {
        [Sequelize.Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    if (company) {
      where.company = company;
    }

    // Get total visitors
    const total = await this.Visitor.count({ where });

    // Get today's visitors
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await this.Visitor.count({
      where: {
        registeredAt: {
          [Sequelize.Op.gte]: today
        }
      }
    });

    // Get this week's visitors
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekCount = await this.Visitor.count({
      where: {
        registeredAt: {
          [Sequelize.Op.gte]: weekStart
        }
      }
    });

    // Get this month's visitors
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthCount = await this.Visitor.count({
      where: {
        registeredAt: {
          [Sequelize.Op.gte]: monthStart
        }
      }
    });

    // Get visitors by day (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);
      
      const count = await this.Visitor.count({
        where: {
          registeredAt: {
            [Sequelize.Op.gte]: date,
            [Sequelize.Op.lt]: nextDate
          }
        }
      });
      
      last7Days.push({
        date: date.toISOString().split('T')[0],
        count
      });
    }

    // Get visitors by company (top 10)
    const topCompanies = await this.Visitor.findAll({
      attributes: [
        'company',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where,
      group: ['company'],
      order: [[Sequelize.literal('count'), 'DESC']],
      limit: 10
    });

    // Get recent visitors
    const recentVisitors = await this.Visitor.findAll({
      where,
      order: [['registeredAt', 'DESC']],
      limit: 10
    });

    return {
      total,
      today: todayCount,
      week: weekCount,
      month: monthCount,
      last7Days,
      topCompanies,
      recentVisitors
    };
  }

  async getAllVisitors(page = 1, limit = 20, filters = {}) {
    await this.init();

    const offset = (page - 1) * limit;
    const where = {};

    if (filters.search) {
      where[Sequelize.Op.or] = [
        { name: { [Sequelize.Op.like]: `%${filters.search}%` } },
        { email: { [Sequelize.Op.like]: `%${filters.search}%` } },
        { company: { [Sequelize.Op.like]: `%${filters.search}%` } }
      ];
    }

    if (filters.startDate && filters.endDate) {
      where.registeredAt = {
        [Sequelize.Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
      };
    }

    if (filters.company) {
      where.company = filters.company;
    }

    const { count, rows } = await this.Visitor.findAndCountAll({
      where,
      order: [['registeredAt', 'DESC']],
      limit,
      offset
    });

    // Check which visitors are exhibitors
    const visitorsWithExhibitorStatus = await Promise.all(
      rows.map(async (visitor) => {
        const isExhibitor = await visitor.isExhibitor();
        return {
          ...visitor.toJSON(),
          isExhibitor
        };
      })
    );

    return {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: visitorsWithExhibitorStatus
    };
  }

  async getVisitorById(id) {
    await this.init();
    const visitor = await this.Visitor.findByPk(id);
    if (visitor) {
      const isExhibitor = await visitor.isExhibitor();
      return {
        ...visitor.toJSON(),
        isExhibitor
      };
    }
    return null;
  }

  async getVisitorsByCompany(company) {
    await this.init();
    return await this.Visitor.findAll({
      where: { company },
      order: [['registeredAt', 'DESC']]
    });
  }
}

module.exports = new VisitorService();