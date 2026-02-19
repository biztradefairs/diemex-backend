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
      defaultValue: 0,
      validate: {
        min: 0
      }
    }
  }, {
    tableName: 'WaterConnectionConfigs',
    timestamps: true,
    updatedAt: 'updatedAt',
    createdAt: 'createdAt'
  });

  return WaterConnectionConfig;
};