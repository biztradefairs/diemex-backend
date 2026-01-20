// src/controllers/UserController.js
const userService = require('../services/UserService');
const { generateToken } = require('../utils/jwt');

class UserController {
  async register(req, res) {
    try {
      const user = await userService.createUser(req.body);
      const token = generateToken(user);
      
      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status
          },
          token
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const user = await userService.login(email, password);
      const token = generateToken(user);
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status
          },
          token
        }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 10, search, role, status } = req.query;
      
      const filters = {};
      if (search) filters.search = search;
      if (role) filters.role = role;
      if (status) filters.status = status;
      
      const result = await userService.getAllUsers(filters, parseInt(page), parseInt(limit));
      
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

  async getUser(req, res) {
    try {
      const user = await userService.getUserById(req.params.id);
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateUser(req, res) {
    try {
      const user = await userService.updateUser(req.params.id, req.body);
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteUser(req, res) {
    try {
      await userService.deleteUser(req.params.id);
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getProfile(req, res) {
    try {
      const user = await userService.getUserById(req.user.id);
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateProfile(req, res) {
    try {
      const user = await userService.updateUser(req.user.id, req.body);
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new UserController();