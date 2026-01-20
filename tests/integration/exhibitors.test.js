// tests/integration/exhibitors.test.js
const request = require('supertest');
const app = require('../../src/app');

describe('Exhibitor API Tests', () => {
  let authToken;
  let testExhibitor;

  beforeAll(async () => {
    // Login as admin
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
      });
    
    authToken = response.body.data.token;
  });

  describe('Exhibitor Management', () => {
    it('should create a new exhibitor', async () => {
      const newExhibitor = {
        name: 'Test Exhibitor',
        email: 'exhibitor@example.com',
        company: 'Test Company Inc.',
        phone: '+1234567890',
        sector: 'Technology',
        booth: 'A-101',
        status: 'pending'
      };

      const response = await request(app)
        .post('/api/exhibitors')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newExhibitor);
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.company).toBe(newExhibitor.company);
      
      testExhibitor = response.body.data;
    });

    it('should get all exhibitors', async () => {
      const response = await request(app)
        .get('/api/exhibitors')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.exhibitors)).toBe(true);
    });

    it('should search exhibitors', async () => {
      const response = await request(app)
        .get('/api/exhibitors?search=Test')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exhibitors.length).toBeGreaterThan(0);
    });

    it('should filter exhibitors by status', async () => {
      const response = await request(app)
        .get('/api/exhibitors?status=pending')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exhibitors[0].status).toBe('pending');
    });

    it('should update exhibitor status', async () => {
      const response = await request(app)
        .put(`/api/exhibitors/${testExhibitor.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');
    });

    it('should get exhibitor stats', async () => {
      const response = await request(app)
        .get('/api/exhibitors/stats')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.byStatus).toBeDefined();
    });
  });
});