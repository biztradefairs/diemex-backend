// src/services/ExhibitorService.js
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class ExhibitorService {
  constructor() {
    this._exhibitorModel = null;
  }

  // Get Exhibitor model with error handling
  get Exhibitor() {
    if (!this._exhibitorModel) {
      const modelFactory = require('../models');
      this._exhibitorModel = modelFactory.getModel('Exhibitor');
    }
    return this._exhibitorModel;
  }

  async testConnection() {
    try {
      const count = await this.Exhibitor.count();
      console.log(`✅ Exhibitor model connection test: ${count} records found`);
      return true;
    } catch (error) {
      console.error('❌ Exhibitor model connection test failed:', error.message);
      return false;
    }
  }

async createExhibitor(exhibitorData) {
  try {
    // 1️⃣ Generate temporary password (save both plain and hashed)
    const plainPassword = crypto.randomBytes(8).toString('hex'); // 16 character password
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    exhibitorData.password = hashedPassword;
    exhibitorData.metadata = {
      ...exhibitorData.metadata,
      passwordResetRequired: true,
      initialPasswordSet: true,
      initialPassword: plainPassword // Store for audit (optional)
    };

    // 2️⃣ Create exhibitor
    const exhibitor = await this.Exhibitor.create(exhibitorData);

    // 3️⃣ Send welcome email with actual password (async, don't wait)
    try {
      emailService.sendExhibitorWelcome(exhibitor.toJSON(), plainPassword)
        .then(info => {
          console.log(`✅ Welcome email sent to ${exhibitor.email}`);
          console.log(`   Password: ${plainPassword}`);
        })
        .catch(emailError => {
          console.error(`❌ Failed to send welcome email:`, emailError.message);
          // Log the password in console for admin to manually send
          console.log(`⚠️ Manual password for ${exhibitor.email}: ${plainPassword}`);
        });
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError.message);
    }

    // 4️⃣ Kafka notifications (non-blocking)
    if (process.env.ENABLE_KAFKA === 'true') {
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendNotification('EXHIBITOR_REGISTERED', null, {
          exhibitorId: exhibitor.id,
          email: exhibitor.email,
          company: exhibitor.company
        });
      } catch (kafkaError) {
        console.warn('⚠️ Kafka unavailable:', kafkaError.message);
      }
    }

    // 5️⃣ Return exhibitor without sensitive data
    const response = exhibitor.toJSON();
    delete response.password;
    delete response.resetPasswordToken;
    delete response.resetPasswordExpires;

    // But include plain password in response for admin UI
    response.plainPassword = plainPassword; // Only for immediate display

    return response;

  } catch (error) {
    console.error('❌ Create exhibitor error:', error);

    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new Error('Email already exists');
    }

    throw new Error(`Failed to create exhibitor: ${error.message}`);
  }
}

// services/ExhibitorService.js - Update the getAllExhibitors method
async getAllExhibitors(filters = {}, page = 1, limit = 10, includePassword = false) {
  try {
    console.log('🔍 Fetching exhibitors with filters:', { filters, page, limit, includePassword });
    
    const offset = (page - 1) * limit;
    
    // Build query conditions
    let where = {};
    
    if (filters.search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${filters.search}%` } },
        { company: { [Op.like]: `%${filters.search}%` } },
        { email: { [Op.like]: `%${filters.search}%` } },
        { phone: { [Op.like]: `%${filters.search}%` } }
      ];
    }
    
    if (filters.sector && filters.sector !== 'all') {
      where.sector = filters.sector;
    }
    
    if (filters.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    console.log('📊 Sequelize query where:', where);
    
    // Define attributes based on includePassword
    let attributes;
    if (includePassword) {
      // Include ALL fields including password
      attributes = { exclude: [] }; // Empty exclude means include all
    } else {
      // Exclude sensitive fields
      attributes = { 
        exclude: ['password', 'resetPasswordToken', 'resetPasswordExpires'] 
      };
    }
    
    console.log('📊 Query attributes:', attributes);
    
    // Get exhibitors
    const result = await this.Exhibitor.findAndCountAll({
      where: where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      attributes: attributes,
      raw: true // Get plain objects to avoid toJSON issues
    });

    console.log(`✅ Found ${result.count} total exhibitors, returning ${result.rows.length}`);
    console.log('📦 Sample raw data:', result.rows.length > 0 ? result.rows[0] : 'No data');
    
    // Map to consistent format - FIXED for your database columns
    const formattedExhibitors = result.rows.map(exhibitor => {
      // Your database columns are different - adjust mapping
      console.log('📊 Mapping exhibitor:', {
        id: exhibitor.id,
        name: exhibitor.name,
        email: exhibitor.email,
        boothNumber: exhibitor.boothNumber,
        registrationDate: exhibitor.registrationDate,
        created_at: exhibitor.created_at || exhibitor.createdAt,
        updated_at: exhibitor.updated_at || exhibitor.updatedAt
      });
      
      const exhibitorData = {
        id: exhibitor.id,
        name: exhibitor.name,
        email: exhibitor.email,
        phone: exhibitor.phone,
        company: exhibitor.company,
        sector: exhibitor.sector,
        booth: exhibitor.boothNumber || exhibitor.booth || '',
        status: exhibitor.status,
        registrationDate: exhibitor.registrationDate || exhibitor.createdAt || exhibitor.created_at,
        website: exhibitor.website,
        address: exhibitor.address,
        city: exhibitor.city,
        country: exhibitor.country,
        postalCode: exhibitor.postalCode,
        description: exhibitor.description,
        stallSize: exhibitor.stallSize,
        powerRequirements: exhibitor.powerRequirements,
        internetRequirements: exhibitor.internetRequirements,
        additionalRequirements: exhibitor.additionalRequirements,
        stallDetails: exhibitor.stallDetails,
        metadata: exhibitor.metadata,
        lastLogin: exhibitor.lastLogin,
        resetPasswordToken: exhibitor.resetPasswordToken,
        resetPasswordExpires: exhibitor.resetPasswordExpires,
        createdAt: exhibitor.createdAt || exhibitor.created_at,
        updatedAt: exhibitor.updatedAt || exhibitor.updated_at
      };
      
      // Include password if requested
      if (includePassword && exhibitor.password) {
        exhibitorData.password = exhibitor.password;
        exhibitorData.hasPassword = true;
      }
      
      return exhibitorData;
    });

    console.log(`✅ Mapped ${formattedExhibitors.length} exhibitors`);
    
    return {
      exhibitors: formattedExhibitors,
      total: result.count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(result.count / limit)
    };
    
  } catch (error) {
    console.error('❌ Error in getAllExhibitors:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to fetch exhibitors: ${error.message}`);
  }
}
// services/ExhibitorService.js - Update the getAllExhibitorsWithPasswords method

async getAllExhibitorsWithPasswords(filters = {}, page = 1, limit = 10) {
  try {
    console.log('🔑 Fetching exhibitors WITH PASSWORDS (admin)');
    console.log('Database type:', process.env.DB_TYPE);
    
    const offset = (page - 1) * limit;
    
    // Build query conditions based on database type
    let query = {};
    
    if (filters.search) {
      if (process.env.DB_TYPE === 'mysql') {
        query[Op.or] = [
          { name: { [Op.like]: `%${filters.search}%` } },
          { company: { [Op.like]: `%${filters.search}%` } },
          { email: { [Op.like]: `%${filters.search}%` } },
          { phone: { [Op.like]: `%${filters.search}%` } },
          { boothNumber: { [Op.like]: `%${filters.search}%` } }
        ];
      } else {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { company: { $regex: filters.search, $options: 'i' } },
          { email: { $regex: filters.search, $options: 'i' } },
          { phone: { $regex: filters.search, $options: 'i' } },
          { boothNumber: { $regex: filters.search, $options: 'i' } }
        ];
      }
    }
    
    if (filters.sector && filters.sector !== 'all') {
      query.sector = filters.sector;
    }
    
    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }
    
    console.log('Query conditions:', JSON.stringify(query, null, 2));
    
    let exhibitors, total;
    
    if (process.env.DB_TYPE === 'mysql') {
      // MySQL/Sequelize query - INCLUDE password
      const result = await this.Exhibitor.findAndCountAll({
        where: query,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        // Don't exclude any fields - include password
        // This returns ALL fields including password
      });
      
      exhibitors = result.rows;
      total = result.count;
    } else {
      // MongoDB query - INCLUDE password
      exhibitors = await this.Exhibitor.find(query)
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });
      
      total = await this.Exhibitor.countDocuments(query);
    }
    
    console.log(`✅ Found ${total} exhibitors with passwords`);
    
    // Map to consistent format
    const formattedExhibitors = exhibitors.map(exhibitor => {
      const data = exhibitor.toJSON ? exhibitor.toJSON() : exhibitor;
      
      return {
        id: data.id || data._id?.toString(),
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        sector: data.sector,
        booth: data.boothNumber || '',
        status: data.status,
        registrationDate: data.registrationDate || data.createdAt,
        website: data.website,
        address: data.address,
        city: data.city,
        country: data.country,
        postalCode: data.postalCode,
        description: data.description,
        stallSize: data.stallSize,
        powerRequirements: data.powerRequirements,
        internetRequirements: data.internetRequirements,
        additionalRequirements: data.additionalRequirements,
        password: data.password, // HASHLI şifre geliyor
        hasPassword: !!data.password,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    });
    
    return {
      exhibitors: formattedExhibitors,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    };
    
  } catch (error) {
    console.error('❌ Error fetching exhibitors with passwords:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to fetch exhibitors with passwords: ${error.message}`);
  }
}

  async getExhibitorById(id) {
    try {
      let exhibitor;
      
      if (process.env.DB_TYPE === 'mysql') {
        exhibitor = await this.Exhibitor.findByPk(id);
      } else {
        exhibitor = await this.Exhibitor.findById(id);
      }
      
      if (!exhibitor) {
        throw new Error('Exhibitor not found');
      }
      
      const exhibitorData = exhibitor.toJSON ? exhibitor.toJSON() : exhibitor;
      
      // Map to frontend format with ALL fields
      return {
        id: exhibitorData.id || exhibitorData._id,
        name: exhibitorData.name,
        email: exhibitorData.email,
        phone: exhibitorData.phone,
        company: exhibitorData.company,
        sector: exhibitorData.sector,
        booth: exhibitorData.boothNumber || '',
        status: exhibitorData.status,
        registrationDate: exhibitorData.registrationDate || exhibitorData.createdAt,
        website: exhibitorData.website,
        address: exhibitorData.address,
        city: exhibitorData.city,
        country: exhibitorData.country,
        postalCode: exhibitorData.postalCode,
        description: exhibitorData.description,
        stallSize: exhibitorData.stallSize,
        powerRequirements: exhibitorData.powerRequirements,
        internetRequirements: exhibitorData.internetRequirements,
        additionalRequirements: exhibitorData.additionalRequirements,
        stallDetails: exhibitorData.stallDetails,
        createdAt: exhibitorData.createdAt,
        updatedAt: exhibitorData.updatedAt,
        // Optional: include password if needed for admin
        // password: exhibitorData.password
      };
      
    } catch (error) {
      console.error('❌ Error fetching exhibitor:', error);
      throw new Error(`Failed to fetch exhibitor: ${error.message}`);
    }
  }

  // Get exhibitor with password (for admin/reset)
  async getExhibitorWithPasswordById(id) {
    try {
      const exhibitor = await this.Exhibitor.findByPk(id);
      
      if (!exhibitor) {
        throw new Error('Exhibitor not found');
      }
      
      const exhibitorData = exhibitor.toJSON();
      
      return {
        id: exhibitorData.id,
        name: exhibitorData.name,
        email: exhibitorData.email,
        phone: exhibitorData.phone,
        company: exhibitorData.company,
        sector: exhibitorData.sector,
        booth: exhibitorData.boothNumber || '',
        status: exhibitorData.status,
        registrationDate: exhibitorData.registrationDate || exhibitorData.createdAt,
        website: exhibitorData.website,
        address: exhibitorData.address,
        city: exhibitorData.city,
        country: exhibitorData.country,
        postalCode: exhibitorData.postalCode,
        description: exhibitorData.description,
        password: exhibitorData.password, // Includes hashed password
        hasPassword: !!exhibitorData.password,
        createdAt: exhibitorData.createdAt,
        updatedAt: exhibitorData.updatedAt
      };
      
    } catch (error) {
      console.error('❌ Error fetching exhibitor with password:', error);
      throw new Error(`Failed to fetch exhibitor: ${error.message}`);
    }
  }

  async updateExhibitor(id, updateData) {
    try {
      let exhibitor;
      
      if (process.env.DB_TYPE === 'mysql') {
        exhibitor = await this.Exhibitor.findByPk(id);
        if (!exhibitor) throw new Error('Exhibitor not found');
        
        // Update exhibitor
        await exhibitor.update(updateData);
        
      } else {
        exhibitor = await this.Exhibitor.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        if (!exhibitor) throw new Error('Exhibitor not found');
      }

      // Send notifications if Kafka is enabled
      if (process.env.ENABLE_KAFKA === 'true') {
        try {
          const kafkaProducer = require('../kafka/producer');
          
          // Send notification if status changed
          if (updateData.status) {
            const kafkaProducer = require('../kafka/producer');
            // Check if status is being changed
            if (updateData.status && updateData.status !== exhibitor.status) {
              await kafkaProducer.sendNotification('EXHIBITOR_STATUS_CHANGED', null, {
                exhibitorId: id,
                company: exhibitor.company,
                oldStatus: exhibitor.status,
                newStatus: updateData.status
              });
            }
          }
          
          // Send audit log
          await kafkaProducer.sendAuditLog('EXHIBITOR_UPDATED', null, {
            exhibitorId: id,
            updatedFields: Object.keys(updateData)
          });
          
        } catch (kafkaError) {
          console.warn('⚠️ Kafka unavailable for update:', kafkaError.message);
        }
      }

      return exhibitor;
    } catch (error) {
      console.error('❌ Error updating exhibitor:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Email already exists');
      }
      if (error.name === 'SequelizeValidationError') {
        throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(`Failed to update exhibitor: ${error.message}`);
    }
  }

  async deleteExhibitor(id) {
    try {
      let result;
      
      if (process.env.DB_TYPE === 'mysql') {
        const exhibitor = await this.Exhibitor.findByPk(id);
        if (!exhibitor) throw new Error('Exhibitor not found');
        await exhibitor.destroy();
        result = { success: true };
      } else {
        result = await this.Exhibitor.findByIdAndDelete(id);
        if (!result) throw new Error('Exhibitor not found');
      }

      // Send audit log if Kafka is enabled
      if (process.env.ENABLE_KAFKA === 'true') {
        try {
          const kafkaProducer = require('../kafka/producer');
          await kafkaProducer.sendAuditLog('EXHIBITOR_DELETED', null, {
            exhibitorId: id
          });
        } catch (kafkaError) {
          console.warn('⚠️ Kafka unavailable for delete:', kafkaError.message);
        }
      }

      return result;
    } catch (error) {
      console.error('❌ Error deleting exhibitor:', error);
      throw new Error(`Failed to delete exhibitor: ${error.message}`);
    }
  }

  async getExhibitorStats() {
    try {
      console.log('📊 Getting exhibitor stats');
      
      if (process.env.DB_TYPE === 'mysql') {
        const { Sequelize } = require('sequelize');
        const stats = await this.Exhibitor.findAll({
          attributes: [
            'status',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
          ],
          group: ['status']
        });

        const sectors = await this.Exhibitor.findAll({
          attributes: [
            'sector',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
          ],
          where: {
            sector: { [Op.not]: null }
          },
          group: ['sector']
        });

        const total = await this.Exhibitor.count();

        return {
          total,
          byStatus: stats.map(item => ({
            _id: item.status,
            count: item.get('count')
          })),
          bySector: sectors.map(item => ({
            _id: item.sector,
            count: item.get('count')
          }))
        };
      } else {
        const byStatus = await this.Exhibitor.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const bySector = await this.Exhibitor.aggregate([
          { $match: { sector: { $ne: null } } },
          { $group: { _id: '$sector', count: { $sum: 1 } } }
        ]);

        const total = await this.Exhibitor.countDocuments();

        return {
          total,
          byStatus,
          bySector
        };
      }
    } catch (error) {
      console.error('❌ Error getting exhibitor stats:', error);
      throw new Error(`Failed to get exhibitor stats: ${error.message}`);
    }
  }

  async getExhibitorByEmail(email) {
    try {
      let exhibitor;
      
      if (process.env.DB_TYPE === 'mysql') {
        exhibitor = await this.Exhibitor.findOne({ 
          where: { email }
        });
      } else {
        exhibitor = await this.Exhibitor.findOne({ email });
      }
      
      if (!exhibitor) {
        throw new Error('Exhibitor not found');
      }
      
      return exhibitor;
    } catch (error) {
      throw new Error(`Failed to fetch exhibitor: ${error.message}`);
    }
  }

// services/ExhibitorService.js - Add this method
async getAllExhibitorsWithPasswords(filters = {}, page = 1, limit = 10) {
  try {
    console.log('🔑 Fetching exhibitors WITH PASSWORDS (admin)');
    
    const offset = (page - 1) * limit;
    
    // Build query conditions
    let query = {};
    
    if (filters.search) {
      query[Op.or] = [
        { name: { [Op.like]: `%${filters.search}%` } },
        { company: { [Op.like]: `%${filters.search}%` } },
        { email: { [Op.like]: `%${filters.search}%` } }
      ];
    }
    
    if (filters.sector && filters.sector !== 'all') {
      query.sector = filters.sector;
    }
    
    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }

    // Get exhibitors WITH passwords
    const result = await this.Exhibitor.findAndCountAll({
      where: query,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      // Include password field explicitly
      attributes: [
        'id', 'name', 'email', 'password', 'phone', 'company', 
        'sector', 'boothNumber', 'website', 'address', 'city', 
        'country', 'postalCode', 'description', 'status', 
        'stallSize', 'powerRequirements', 'internetRequirements', 
        'additionalRequirements', 'createdAt', 'updatedAt'
      ]
    });

    const formattedExhibitors = result.rows.map(exhibitor => {
      const data = exhibitor.toJSON();
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        sector: data.sector,
        booth: data.boothNumber || '',
        status: data.status,
        registrationDate: data.registrationDate || data.createdAt,
        website: data.website,
        address: data.address,
        city: data.city,
        country: data.country,
        postalCode: data.postalCode,
        description: data.description,
        stallSize: data.stallSize,
        powerRequirements: data.powerRequirements,
        internetRequirements: data.internetRequirements,
        additionalRequirements: data.additionalRequirements,
        password: data.password, // Includes hashed password
        hasPassword: !!data.password,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    });

    return {
      exhibitors: formattedExhibitors,
      total: result.count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(result.count / limit)
    };
    
  } catch (error) {
    console.error('❌ Error fetching exhibitors with passwords:', error);
    throw new Error(`Failed to fetch exhibitors: ${error.message}`);
  }
}

  async updatePassword(id, password) {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const exhibitor = await this.Exhibitor.findByPk(id);
      
      if (!exhibitor) throw new Error('Exhibitor not found');
      
      await exhibitor.update({ 
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null
      });
      
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to update password: ${error.message}`);
    }
  }

  async setResetToken(email, token, expires) {
    try {
      const exhibitor = await this.Exhibitor.findOne({ where: { email } });
      
      if (!exhibitor) {
        return false; // Don't reveal if email exists
      }
      
      await exhibitor.update({
        resetPasswordToken: token,
        resetPasswordExpires: expires
      });
      
      return true;
    } catch (error) {
      throw new Error(`Failed to set reset token: ${error.message}`);
    }
  }

  async getExhibitorByResetToken(token) {
    try {
      const exhibitor = await this.Exhibitor.findOne({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: { [Op.gt]: new Date() }
        }
      });
      
      if (!exhibitor) {
        throw new Error('Invalid or expired token');
      }
      
      return exhibitor;
    } catch (error) {
      throw new Error(`Failed to fetch exhibitor by token: ${error.message}`);
    }
  }

  // Bulk update status
  async bulkUpdateStatus(ids, status) {
    try {
      console.log(`🔄 Bulk updating ${ids.length} exhibitors to status: ${status}`);
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new Error('No exhibitor IDs provided');
      }
      
      if (!status) {
        throw new Error('No status provided');
      }
      
      let result;
      
      if (process.env.DB_TYPE === 'mysql') {
        result = await this.Exhibitor.update(
          { status },
          {
            where: { id: ids }
          }
        );
      } else {
        result = await this.Exhibitor.updateMany(
          { _id: { $in: ids } },
          { $set: { status } }
        );
      }
      
      console.log(`✅ Bulk update affected ${result[0] || result.nModified} records`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error in bulk update:', error);
      throw new Error(`Failed to bulk update: ${error.message}`);
    }
  }
}

module.exports = new ExhibitorService();