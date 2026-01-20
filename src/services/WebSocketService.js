// src/services/WebSocketService.js
const jwt = require('jsonwebtoken');

class WebSocketService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map();
  }

  initialize() {
    this.io.use(this.authenticate.bind(this));
    
    this.io.on('connection', (socket) => {
      console.log('New client connected:', socket.user?.id);
      
      // Store user connection
      if (socket.user) {
        this.connectedUsers.set(socket.user.id, socket.id);
        
        // Join user to their room
        socket.join(`user:${socket.user.id}`);
        
        // Join user to role-based room
        socket.join(`role:${socket.user.role}`);
        
        // Join user to admin room if admin
        if (socket.user.role === 'admin') {
          socket.join('admin');
        }
      }
      
      // Handle dashboard updates
      socket.on('dashboard:subscribe', () => {
        socket.join('dashboard');
      });
      
      // Handle notifications
      socket.on('notification:subscribe', () => {
        socket.join('notifications');
      });
      
      // Handle real-time updates for specific entities
      socket.on('entity:subscribe', (entityId) => {
        socket.join(`entity:${entityId}`);
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.user?.id);
        if (socket.user) {
          this.connectedUsers.delete(socket.user.id);
        }
      });
    });
  }

  async authenticate(socket, next) {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  }

  // Send notification to specific user
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // Send notification to all users in a room
  sendToRoom(room, event, data) {
    this.io.to(room).emit(event, data);
  }

  // Broadcast to all connected clients
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  // Send dashboard update
  sendDashboardUpdate(data) {
    this.sendToRoom('dashboard', 'dashboard:update', data);
  }

  // Send notification
  sendNotification(userId, notification) {
    this.sendToUser(userId, 'notification:new', notification);
  }

  // Send entity update
  sendEntityUpdate(entityType, entityId, data) {
    this.sendToRoom(`entity:${entityId}`, `${entityType}:update`, data);
  }

  // Send system alert to admins
  sendSystemAlert(alert) {
    this.sendToRoom('admin', 'system:alert', alert);
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get connected users by role
  getConnectedUsersByRole(role) {
    // This would require additional tracking
    return Array.from(this.connectedUsers.keys()).length;
  }
}

module.exports = WebSocketService;