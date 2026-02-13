// models/FloorPlan.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FloorPlan = sequelize.define('FloorPlan', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Exhibition Floor Plan'
    },
    // Store the base image URL from Cloudinary
    baseImageUrl: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Store Cloudinary public ID for management
    cloudinaryPublicId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Store booth positions relative to image (percentage-based)
    booths: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('booths');
        if (!rawValue) return [];
        try {
          return JSON.parse(rawValue);
        } catch {
          return [];
        }
      },
      set(value) {
        this.setDataValue('booths', JSON.stringify(value || []));
      }
    },
    // Original image dimensions
    imageWidth: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    imageHeight: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Store fixed reference points for scaling
    referencePoints: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('referencePoints');
        if (!rawValue) return [];
        try {
          return JSON.parse(rawValue);
        } catch {
          return [];
        }
      },
      set(value) {
        this.setDataValue('referencePoints', JSON.stringify(value || []));
      }
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'floor_plans',
    timestamps: true,
    underscored: true
  });

  return FloorPlan;
};