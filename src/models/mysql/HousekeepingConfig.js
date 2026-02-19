const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const HousekeepingConfig = sequelize.define('HousekeepingConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    // ✅ MAIN FIELD
    chargesPerShift: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2000,
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
    }

  }, {
    tableName: 'HousekeepingConfigs',
    timestamps: true
  });

  return HousekeepingConfig;
};
