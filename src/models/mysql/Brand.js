const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Brand = sequelize.define('Brand', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    exhibitorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'exhibitors',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    logoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    logoPublicId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'brands',
    timestamps: true
  });

  // Define associations
  Brand.associate = (models) => {
    Brand.belongsTo(models.Exhibitor, {
      foreignKey: 'exhibitorId',
      as: 'exhibitor'
    });
  };

  return Brand;
};