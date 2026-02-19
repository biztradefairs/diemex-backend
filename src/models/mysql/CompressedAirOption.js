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
      validate: {
        notEmpty: true
      }
    },
    costPerConnection: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    powerKW: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1
      }
    }
  }, {
    tableName: 'compressed_air_options',
    timestamps: true,
    indexes: [
      {
        fields: ['displayOrder']
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['cfmRange']
      }
    ]
  });

  return CompressedAirOption;
};