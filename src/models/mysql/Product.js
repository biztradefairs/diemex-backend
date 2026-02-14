const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
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
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    price: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    imageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    imagePublicId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    specifications: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
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
    tableName: 'products',
    timestamps: true
  });

  // Define associations
  Product.associate = (models) => {
    Product.belongsTo(models.Exhibitor, {
      foreignKey: 'exhibitorId',
      as: 'exhibitor'
    });
  };

  return Product;
};