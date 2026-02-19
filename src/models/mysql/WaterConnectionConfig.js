const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WaterConnectionConfig = sequelize.define('WaterConnectionConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ratePerConnection: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'rate_per_connection'
    }
  }, {
    tableName: 'water_connection_configs',
    timestamps: true,
    underscored: true
  });

  return WaterConnectionConfig;
};
