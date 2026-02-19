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
      field: 'rate_per_guard_per_day'
    }
  }, {
    tableName: 'security_guard_configs',
    timestamps: true,
    underscored: true
  });

  return SecurityGuardConfig;
};
