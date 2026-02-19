const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const HostessCategory = sequelize.define('HostessCategory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    category: {
      type: DataTypes.ENUM('A', 'B'),
      allowNull: false,
      unique: true,
      validate: {
        isIn: [['A', 'B']]
      }
    },
    ratePerDay: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    workingHours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 8,
      validate: {
        min: 1,
        max: 24
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'HostessCategories',
    timestamps: true,
    indexes: [
      {
        fields: ['category']
      },
      {
        fields: ['isActive']
      }
    ]
  });

  return HostessCategory;
};