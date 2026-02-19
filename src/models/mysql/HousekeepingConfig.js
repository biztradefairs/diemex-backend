const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const HousekeepingConfig = sequelize.define('HousekeepingConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ratePerStaffPerDay: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1200,
      validate: {
        min: 0
      }
    },
    shiftHours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 8,
      validate: {
        min: 1,
        max: 24
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'HousekeepingConfigs',
    timestamps: true
  });

  return HousekeepingConfig;
};
