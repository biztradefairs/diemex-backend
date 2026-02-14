const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Brochure = sequelize.define('Brochure', {
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
    fileUrl: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    publicId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    fileSize: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    downloads: {
      type: DataTypes.INTEGER,
      defaultValue: 0
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
    tableName: 'brochures',
    timestamps: true
  });

  // Define associations
  Brochure.associate = (models) => {
    Brochure.belongsTo(models.Exhibitor, {
      foreignKey: 'exhibitorId',
      as: 'exhibitor'
    });
  };

  return Brochure;
};