const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Requirement = sequelize.define('Requirement', {
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
    type: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'),
      defaultValue: 'pending'
    },
    cost: {
      type: DataTypes.DECIMAL(10, 2),
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
    tableName: 'requirements',
    timestamps: true
  });

  Requirement.associate = (models) => {
    Requirement.belongsTo(models.Exhibitor, {
      foreignKey: 'exhibitorId',
      as: 'exhibitor'
    });
  };

  return Requirement;
};