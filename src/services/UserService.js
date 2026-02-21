const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

class UserService {
  constructor() {
    this._userModel = null;
  }

  // Lazy getter for User model
  get User() {
    if (!this._userModel) {
      const modelFactory = require('../models');
      this._userModel = modelFactory.getModel('User');
    }
    return this._userModel;
  }

  async createUser(userData) {
    try {
      // Hash password if provided
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      const user = await this.User.create(userData);

      // Send audit log (only if Kafka is enabled)
      if (process.env.ENABLE_KAFKA === 'true') {
        try {
          const kafkaProducer = require('../kafka/producer');
          await kafkaProducer.sendAuditLog('USER_CREATED', user.id, {
            email: user.email,
            role: user.role
          });
        } catch (kafkaError) {
          console.warn('Kafka not available for audit log:', kafkaError.message);
        }
      }

      return user;
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Email already exists');
      }
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async getAllUsers(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      let where = {};
      
      if (filters.search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${filters.search}%` } },
          { email: { [Op.like]: `%${filters.search}%` } }
        ];
      }
      
      if (filters.role) {
        where.role = filters.role;
      }
      
      if (filters.status) {
        where.status = filters.status;
      }

      const result = await this.User.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']]
      });

      return {
        users: result.rows,
        total: result.count,
        page,
        totalPages: Math.ceil(result.count / limit)
      };
    } catch (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
  }

  async getUserById(id) {
    try {
      const user = await this.User.findByPk(id, {
        attributes: { exclude: ['password'] }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
  }

  async updateUser(id, updateData) {
    try {
      // Hash password if updating
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      const user = await this.User.findByPk(id);
      if (!user) throw new Error('User not found');
      
      await user.update(updateData);

      // Send audit log (only if Kafka is enabled)
      if (process.env.ENABLE_KAFKA === 'true') {
        try {
          const kafkaProducer = require('../kafka/producer');
          await kafkaProducer.sendAuditLog('USER_UPDATED', id, {
            updatedFields: Object.keys(updateData)
          });
        } catch (kafkaError) {
          console.warn('Kafka not available for audit log:', kafkaError.message);
        }
      }

      return user;
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async deleteUser(id) {
    try {
      const user = await this.User.findByPk(id);
      if (!user) throw new Error('User not found');
      
      await user.destroy();

      // Send audit log (only if Kafka is enabled)
      if (process.env.ENABLE_KAFKA === 'true') {
        try {
          const kafkaProducer = require('../kafka/producer');
          await kafkaProducer.sendAuditLog('USER_DELETED', id);
        } catch (kafkaError) {
          console.warn('Kafka not available for audit log:', kafkaError.message);
        }
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

async login(email, password) {
  try {
    // Always normalize email
    email = email.trim().toLowerCase();

    const user = await this.User.findOne({
      where: { email },
      attributes: { include: ['password'] } // IMPORTANT
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.password) {
      console.error('❌ Password field missing from DB query');
      throw new Error('Invalid credentials');
    }

    // Compare password using bcryptjs
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log('❌ Password mismatch');
      throw new Error('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new Error('Account is inactive');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Remove password before returning
    const userData = user.toJSON();
    delete userData.password;

    return userData;

  } catch (error) {
    throw new Error(`Login failed: ${error.message}`);
  }
}

  async getUsersCount() {
    try {
      return await this.User.count();
    } catch (error) {
      throw new Error(`Failed to get users count: ${error.message}`);
    }
  }

  async getUsersByRole(role) {
    try {
      const users = await this.User.findAll({
        where: { role },
        order: [['createdAt', 'DESC']]
      });
      
      return users;
    } catch (error) {
      throw new Error(`Failed to get users by role: ${error.message}`);
    }
  }
}

module.exports = new UserService();