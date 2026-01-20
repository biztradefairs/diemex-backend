-- sql/init.sql
-- Create database and user
CREATE DATABASE IF NOT EXISTS exhibition_db;
USE exhibition_db;

-- Create tables
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'editor', 'viewer') DEFAULT 'viewer',
  status ENUM('active', 'inactive') DEFAULT 'active',
  phone VARCHAR(50),
  lastLogin DATETIME,
  settings JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  category VARCHAR(100),
  status ENUM('published', 'draft') DEFAULT 'draft',
  author VARCHAR(255),
  views INT DEFAULT 0,
  image VARCHAR(500),
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (slug),
  INDEX idx_category (category),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS exhibitors (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  company VARCHAR(255) NOT NULL,
  sector VARCHAR(100),
  booth VARCHAR(50),
  status ENUM('approved', 'pending', 'rejected') DEFAULT 'pending',
  website VARCHAR(500),
  registrationDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  details JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_user_role ON users(role);
CREATE INDEX idx_user_status ON users(status);

CREATE INDEX idx_exhibitor_email ON exhibitors(email);
CREATE INDEX idx_exhibitor_company ON exhibitors(company);
CREATE INDEX idx_exhibitor_status ON exhibitors(status);
CREATE INDEX idx_exhibitor_sector ON exhibitors(sector);