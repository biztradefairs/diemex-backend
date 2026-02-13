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
      defaultValue: 'Main Floor Plan'
    },
    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    booths: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const raw = this.getDataValue('booths');
        return raw ? JSON.parse(raw) : [];
      },
      set(value) {
        this.setDataValue('booths', JSON.stringify(value || []));
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'floor_plans',
    timestamps: true
  });

  return FloorPlan;
};