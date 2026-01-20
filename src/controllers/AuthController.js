const userService = require('../services/UserService');
const { generateToken } = require('../utils/jwt');

class AuthController {
  async login(req, res) {
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
  }

  async register(req, res) {
    const user = await userService.createUser(req.body);
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: { user, token }
    });
  }

  async logout(req, res) {
    res.json({ success: true, message: 'Logged out' });
  }

  async refreshToken(req, res) {
    const token = generateToken(req.user);
    res.json({ success: true, token });
  }
}

module.exports = new AuthController();
