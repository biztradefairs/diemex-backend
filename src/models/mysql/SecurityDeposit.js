const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SecurityDeposit = sequelize.define('SecurityDeposit', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    category: {
      type: DataTypes.ENUM('0-36', '37-100', '101+'),
      allowNull: false,
      unique: true,
      field: 'category'
    },
    minSqMtr: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'min_sq_mtr'
    },
    maxSqMtr: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'max_sq_mtr'
    },
    amountINR: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'amount_inr'
    },
    amountUSD: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'amount_usd'
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'display_order'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'description'
    }
  }, {
    tableName: 'security_deposits',
    timestamps: true,
    underscored: true
  });

  return SecurityDeposit;
};