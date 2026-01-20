// tests/integration/users.test.js
const request = require('supertest');
const app = require('../../src/app');
const database = require('../../src/config/database');

describe('User API Tests', () => {
  let authToken;
  let adminUser;
  let testUser;

  beforeAll(async () => {
    await database.connect();
  });

  afterAll(async () => {
    await database.disconnect();
  });

  describe('Authentication', () => {
    it('should login with admin credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.role).toBe('admin');
      
      authToken = response.body.data.token;
      adminUser = response.body.data.user;
    });

    it('should fail login with wrong credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('User Management', () => {
    it('should create a new user', async () => {
      const newUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'test123',
        role: 'editor',
        phone: '+1234567890'
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newUser);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(newUser.email);
      
      testUser = response.body.data;
    });

    it('should get all users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.users)).toBe(true);
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it('should get a specific user', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testUser.email);
    });

    it('should update a user', async () => {
      const updateData = {
        name: 'Updated Test User',
        status: 'inactive'
      };

      const response = await request(app)
        .put(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.status).toBe(updateData.status);
    });

    it('should delete a user', async () => {
      const response = await request(app)
        .delete(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Authorization', () => {
    it('should prevent non-admin from accessing users', async () => {
      // Create a non-admin user
      const userResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Viewer User',
          email: 'viewer@example.com',
          password: 'viewer123',
          role: 'viewer'
        });
      
      const viewerToken = userResponse.body.data.token;
      
      // Try to access users endpoint
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${viewerToken}`);
      
      expect(response.status).toBe(403);
      
      // Clean up
      await request(app)
        .delete(`/api/users/${userResponse.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });
  });
});