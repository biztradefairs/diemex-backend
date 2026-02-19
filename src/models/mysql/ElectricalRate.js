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
      validate: {
        min: 0
      }
    },
    effectiveFrom: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    effectiveTo: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'ElectricalRates',
    timestamps: true,
    indexes: [
      {
        fields: ['type']
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['effectiveFrom']
      }
    ]
  });

  return ElectricalRate;
};