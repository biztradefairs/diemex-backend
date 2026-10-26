const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('VisitorBadgeSetting', {
  id: { type: DataTypes.STRING(40), primaryKey: true },
  design: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'design1' },
  updatedBy: { type: DataTypes.STRING(40), allowNull: true }
}, { tableName: 'visitor_badge_settings', timestamps: true });
