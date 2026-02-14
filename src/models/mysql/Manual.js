// src/models/mysql/Manual.js
const { DataTypes } = require('sequelize');
const database = require('../../config/database');

const sequelize = database.getConnection('mysql');

const Manual = sequelize.define('Manual', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  version: {
    type: DataTypes.STRING,
    allowNull: false
  },
  file_path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  file_size: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mime_type: {
    type: DataTypes.STRING
  },
  last_updated: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_by: {
    type: DataTypes.STRING
  },
  downloads: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('published', 'draft'),
    defaultValue: 'draft'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  indexes: [
    {
      fields: ['category']
    },
    {
      fields: ['status']
    },
    {
      fields: ['title']
    }
  ]
});

module.exports = Manual;