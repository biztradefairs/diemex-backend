const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CompressedAirOption = sequelize.define('CompressedAirOption', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    cfmRange: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'cfm_range'   // ✅ maps to DB column
    },
    costPerConnection: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'cost_per_connection'   // ✅
    },
    powerKW: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      field: 'power_kw'   // ✅
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'   // ✅
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'display_order'   // ✅
    }
  }, {
    tableName: 'compressed_air_options',
    timestamps: true,
    underscored: true,   // 🔥 important for created_at, updated_at
    indexes: [
      { fields: ['display_order'] },
      { fields: ['is_active'] },
      { fields: ['cfm_range'] }
    ]
  });

  return CompressedAirOption;
};
