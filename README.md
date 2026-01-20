# Exhibition Admin Dashboard Backend

A robust, scalable backend system for managing exhibition administration with support for MySQL, MongoDB, and Kafka.

## Features

- **Dual Database Support**: MySQL & MongoDB with unified API
- **Real-time Updates**: WebSocket & Kafka integration
- **Comprehensive API**: RESTful endpoints for all dashboard features
- **Authentication & Authorization**: JWT-based with role-based access control
- **File Upload**: Media management with storage
- **Scheduled Tasks**: Automated maintenance and reporting
- **Monitoring & Logging**: Comprehensive logging and health checks
- **Testing**: Complete test suite with Jest
- **Docker Support**: Easy deployment with Docker Compose

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Databases**: MySQL 8.0, MongoDB 6.0
- **Message Queue**: Kafka
- **Cache**: Redis
- **Authentication**: JWT, bcrypt
- **File Upload**: Multer
- **Validation**: Express Validator, Joi
- **Logging**: Winston
- **Testing**: Jest, Supertest
- **Documentation**: Swagger/OpenAPI

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (recommended)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd admin-backend