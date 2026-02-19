const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RentalItem = sequelize.define('RentalItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    itemKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    costFor3Days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    category: {
      type: DataTypes.ENUM('AV', 'IT', 'Other'),
      allowNull: false,
      defaultValue: 'Other'
    },
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    cloudinaryPublicId: {
      type: DataTypes.STRING,
      allowNull: true
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
    tableName: 'RentalItems',
    timestamps: true,
    indexes: [
      {
        fields: ['itemKey']
      },
      {
        fields: ['category']
      },
      {
        fields: ['isActive']
      },
      {
        fields: ['displayOrder']
      }
    ]
  });

  return RentalItem;
};