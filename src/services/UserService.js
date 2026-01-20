// src/services/UserService.js
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

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('USER_CREATED', user.id, {
          email: user.email,
          role: user.role
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
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
      
      let query = {};
      
      // Build query based on database type
      if (process.env.DB_TYPE === 'mysql') {
        // MySQL query
        const where = {};
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

        const { count, rows } = await this.User.findAndCountAll({
          where,
          limit,
          offset,
          order: [['createdAt', 'DESC']]
        });

        return {
          users: rows,
          total: count,
          page,
          totalPages: Math.ceil(count / limit)
        };
      } else {
        // MongoDB query
        if (filters.search) {
          query.$or = [
            { name: { $regex: filters.search, $options: 'i' } },
            { email: { $regex: filters.search, $options: 'i' } }
          ];
        }
        
        if (filters.role) {
          query.role = filters.role;
        }
        
        if (filters.status) {
          query.status = filters.status;
        }

        const users = await this.User.find(query)
          .skip(offset)
          .limit(limit)
          .sort({ createdAt: -1 });

        const total = await this.User.countDocuments(query);

        return {
          users,
          total,
          page,
          totalPages: Math.ceil(total / limit)
        };
      }
    } catch (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
  }

  async getUserById(id) {
    try {
      let user;
      
      if (process.env.DB_TYPE === 'mysql') {
        user = await this.User.findByPk(id);
      } else {
        user = await this.User.findById(id);
      }
      
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

      let user;
      
      if (process.env.DB_TYPE === 'mysql') {
        user = await this.User.findByPk(id);
        if (!user) throw new Error('User not found');
        await user.update(updateData);
      } else {
        user = await this.User.findByIdAndUpdate(
          id,
          updateData,
          { new: true, runValidators: true }
        );
        if (!user) throw new Error('User not found');
      }

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('USER_UPDATED', id, {
          updatedFields: Object.keys(updateData)
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
      }

      return user;
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async deleteUser(id) {
    try {
      let result;
      
      if (process.env.DB_TYPE === 'mysql') {
        const user = await this.User.findByPk(id);
        if (!user) throw new Error('User not found');
        await user.destroy();
        result = { success: true };
      } else {
        result = await this.User.findByIdAndDelete(id);
        if (!result) throw new Error('User not found');
      }

      // Send audit log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.sendAuditLog('USER_DELETED', id);
      } catch (kafkaError) {
        console.warn('Kafka not available for audit log:', kafkaError.message);
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  async login(email, password) {
    try {
      let user;
      
      if (process.env.DB_TYPE === 'mysql') {
        user = await this.User.findOne({ where: { email } });
      } else {
        user = await this.User.findOne({ email });
      }
      
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new Error('Invalid credentials');
      }

      // Check user status
      if (user.status !== 'active') {
        throw new Error('Account is inactive');
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Send activity log
      try {
        const kafkaProducer = require('../kafka/producer');
        await kafkaProducer.send('user-activity', {
          key: user.id,
          value: JSON.stringify({
            userId: user.id,
            action: 'LOGIN',
            timestamp: new Date().toISOString()
          })
        });
      } catch (kafkaError) {
        console.warn('Kafka not available for activity log:', kafkaError.message);
      }

      return user;
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async getUsersCount() {
    try {
      if (process.env.DB_TYPE === 'mysql') {
        return await this.User.count();
      } else {
        return await this.User.countDocuments();
      }
    } catch (error) {
      throw new Error(`Failed to get users count: ${error.message}`);
    }
  }

  async getUsersByRole(role) {
    try {
      let users;
      
      if (process.env.DB_TYPE === 'mysql') {
        users = await this.User.findAll({
          where: { role },
          order: [['createdAt', 'DESC']]
        });
      } else {
        users = await this.User.find({ role }).sort({ createdAt: -1 });
      }
      
      return users;
    } catch (error) {
      throw new Error(`Failed to get users by role: ${error.message}`);
    }
  }
}

module.exports = new UserService();