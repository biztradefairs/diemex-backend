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
      if (!this._userModel) {
        throw new Error('User model not found. Make sure models are initialized.');
      }
    }
    return this._userModel;
  }

  async createUser(userData) {
    try {
      // Hash password if provided
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      // Use Sequelize create method
      const user = await this.User.create(userData);
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
      
      // Build query using Sequelize operators
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

      // Use Sequelize findAndCountAll for pagination
      const result = await this.User.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['password'] } // Don't return password
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
      // Use Sequelize findByPk
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

      // Use Sequelize update
      const user = await this.User.findByPk(id);
      if (!user) throw new Error('User not found');
      
      await user.update(updateData);
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
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  async login(email, password) {
    try {
      // Use Sequelize findOne
      const user = await this.User.findOne({ where: { email } });
      
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

      return user;
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }
}

module.exports = new UserService();