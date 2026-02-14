// src/models/mysql/Manual.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Manual = sequelize.define('Manual', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'General'
    },
    version: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '1.0'
    },
    file_path: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
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
      type: DataTypes.STRING,
      allowNull: true
    },
    last_updated: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_by: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Admin'
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
    tableName: 'Manuals',
    timestamps: true,
    underscored: false,
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

  return Manual;
};