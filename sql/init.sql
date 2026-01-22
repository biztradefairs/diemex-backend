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


-- Create initial database tables
CREATE DATABASE IF NOT EXISTS exhibition_db;
USE exhibition_db;

-- Exhibitors table
CREATE TABLE IF NOT EXISTS Exhibitors (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  company VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  resetPasswordToken VARCHAR(255),
  resetPasswordExpires DATETIME,
  phone VARCHAR(50),
  address TEXT,
  website VARCHAR(255),
  sector VARCHAR(100),
  boothNumber VARCHAR(50),
  stallDetails JSON,
  status ENUM('pending', 'active', 'suspended', 'completed') DEFAULT 'active',
  registrationDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  lastLogin DATETIME,
  metadata JSON,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE IF NOT EXISTS Invoices (
  id CHAR(36) PRIMARY KEY,
  invoiceNumber VARCHAR(100) UNIQUE NOT NULL,
  exhibitorId CHAR(36),
  company VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  issueDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  dueDate DATETIME NOT NULL,
  paidDate DATETIME,
  status ENUM('pending', 'paid', 'overdue', 'cancelled') DEFAULT 'pending',
  items JSON,
  notes TEXT,
  metadata JSON,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (exhibitorId) REFERENCES Exhibitors(id) ON DELETE SET NULL
);

-- Payments table
CREATE TABLE IF NOT EXISTS Payments (
  id CHAR(36) PRIMARY KEY,
  invoiceNumber VARCHAR(100),
  invoiceId CHAR(36),
  exhibitorId CHAR(36),
  userId CHAR(36),
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  method ENUM('credit_card', 'bank_transfer', 'check', 'cash', 'online') NOT NULL,
  transactionId VARCHAR(255),
  date DATETIME DEFAULT CURRENT_TIMESTAMP,
  dueDate DATETIME,
  processedBy VARCHAR(255),
  notes TEXT,
  metadata JSON,
  source VARCHAR(255) DEFAULT 'exhibition',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (exhibitorId) REFERENCES Exhibitors(id) ON DELETE SET NULL,
  FOREIGN KEY (invoiceId) REFERENCES Invoices(id) ON DELETE SET NULL
);

-- Floor plans table
CREATE TABLE IF NOT EXISTS FloorPlans (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  floor VARCHAR(100),
  image VARCHAR(255),
  scale DECIMAL(5,2) DEFAULT 1.0,
  gridSize INT DEFAULT 10,
  shapes JSON,
  createdBy VARCHAR(255),
  updatedBy VARCHAR(255),
  version VARCHAR(50) DEFAULT '1.0',
  metadata JSON,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Requirements table
CREATE TABLE IF NOT EXISTS Requirements (
  id CHAR(36) PRIMARY KEY,
  exhibitorId CHAR(36) NOT NULL,
  type ENUM('electrical', 'furniture', 'display', 'other') NOT NULL,
  description TEXT NOT NULL,
  quantity INT DEFAULT 1,
  status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
  cost DECIMAL(10,2),
  notes TEXT,
  metadata JSON,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (exhibitorId) REFERENCES Exhibitors(id) ON DELETE CASCADE
);