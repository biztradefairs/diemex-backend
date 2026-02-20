// models/mysql/WaterConnectionConfig.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WaterConnectionConfig = sequelize.define('WaterConnectionConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    costPerConnection: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15000,
      field: 'cost_per_connection' // This will create column 'cost_per_connection' in database
    }
  }, {
    tableName: 'water_connection_configs',
    timestamps: true,
    underscored: true
  });

  return WaterConnectionConfig;
};