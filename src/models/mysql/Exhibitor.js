// src/models/mysql/Exhibitor.js
const { DataTypes } = require('sequelize');
const database = require('../../config/database');

const sequelize = database.getConnection('mysql');

const Exhibitor = sequelize.define('Exhibitor', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING
  },
  company: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sector: {
    type: DataTypes.STRING
  },
  booth: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM('approved', 'pending', 'rejected'),
    defaultValue: 'pending'
  },
  website: {
    type: DataTypes.STRING
  },
  registrationDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  details: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
});

module.exports = Exhibitor;