// src/models/mysql/Requirement.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Requirement = sequelize.define('Requirement', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    exhibitorId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    
    // ✅ STORE COMPLETE FORM DATA
    data: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'data'  // Store all form data here
    },
    
    // Store metadata separately if needed
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    },

    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
      defaultValue: 'pending'
    },
    cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    }
  }, {
    tableName: 'requirements',
    timestamps: true
  });

  return Requirement;
};