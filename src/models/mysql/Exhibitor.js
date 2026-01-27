const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Exhibitor = sequelize.define('Exhibitor', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    company: {
      type: DataTypes.STRING,
      allowNull: false
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    resetPasswordToken: DataTypes.STRING,
    resetPasswordExpires: DataTypes.DATE,
    phone: DataTypes.STRING,
    address: DataTypes.TEXT,
    website: DataTypes.STRING,
    sector: DataTypes.STRING,
    boothNumber: DataTypes.STRING,
    stallDetails: DataTypes.JSON,
    status: {
      type: DataTypes.ENUM('pending', 'active', 'suspended', 'completed'),
      defaultValue: 'pending'
    },
    registrationDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    lastLogin: DataTypes.DATE,
    metadata: DataTypes.JSON
  }, {
    tableName: 'exhibitors',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      {
        fields: ['email']
      },
      {
        fields: ['company']
      },
      {
        fields: ['status']
      },
      {
        fields: ['resetPasswordToken']
      },
      {
        fields: ['sector']
      }
    ]
  });

  return Exhibitor;
};