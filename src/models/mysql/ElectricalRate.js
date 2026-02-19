const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ElectricalRate = sequelize.define('ElectricalRate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    type: {
      type: DataTypes.ENUM('temporary', 'exhibition', 'both'),
      allowNull: false,
      defaultValue: 'both'
    },
    ratePerKW: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'rate_per_kw'
    },
    effectiveFrom: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'effective_from'
    },
    effectiveTo: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'effective_to'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'electrical_rates',
    timestamps: true,
    underscored: true
  });

  return ElectricalRate;
};
