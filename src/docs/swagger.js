// src/docs/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Exhibition Admin API',
      version: '1.0.0',
      description: 'API documentation for Exhibition Admin Dashboard',
      contact: {
        name: 'API Support',
        email: 'support@exhibition.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development server'
      },
      {
        url: 'https://api.exhibition.com/api',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./src/routes/*.js', './src/docs/*.yaml']
};

const specs = swaggerJsdoc(options);

module.exports = specs;