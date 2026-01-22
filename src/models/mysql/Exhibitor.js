// src/models/mysql/Exhibitor.js (updated)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Exhibitor = sequelize.define('Exhibitor', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      unique: true
    },
    company: DataTypes.STRING,
    password: DataTypes.STRING, // Added
    resetPasswordToken: DataTypes.STRING, // Added
    resetPasswordExpires: DataTypes.DATE, // Added
    phone: DataTypes.STRING,
    address: DataTypes.TEXT,
    website: DataTypes.STRING,
    sector: DataTypes.STRING,
    boothNumber: DataTypes.STRING,
    stallDetails: DataTypes.JSON, // Added for stall information
    status: DataTypes.ENUM('pending', 'active', 'suspended', 'completed'),
    registrationDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    lastLogin: DataTypes.DATE,
    metadata: DataTypes.JSON
  }, {
    indexes: [
      {
        fields: ['email']
      },
      {
        fields: ['company']
      },
      {
        fields: ['status']
      },
      {
        fields: ['resetPasswordToken']
      }
    ]
  });

  return Exhibitor;
};