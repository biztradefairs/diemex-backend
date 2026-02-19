const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const HousekeepingConfig = sequelize.define('HousekeepingConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    chargesPerShift: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    shiftHours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      validate: {
        min: 1,
        max: 24
      }
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Charges per shift (10 hours)'
    }
  }, {
    tableName: 'HousekeepingConfigs',
    timestamps: true,
    updatedAt: 'updatedAt',
    createdAt: 'createdAt'
  });

  return HousekeepingConfig;
};