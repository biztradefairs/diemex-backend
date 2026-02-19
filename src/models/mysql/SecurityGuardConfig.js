const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SecurityGuardConfig = sequelize.define('SecurityGuardConfig', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ratePerGuardPerDay: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    }
  }, {
    tableName: 'SecurityGuardConfigs',
    timestamps: true,
    updatedAt: 'updatedAt',
    createdAt: 'createdAt'
  });

  return SecurityGuardConfig;
};