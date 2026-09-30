const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VisitorPassScan = sequelize.define('VisitorPassScan', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    visitorPassId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'visitorPassId'
    },
    scannerId: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'scannerId'
    },
    scannedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'scannedAt'
    }
  }, {
    tableName: 'visitor_pass_scans',
    timestamps: true,
    indexes: [
      { fields: ['visitorPassId', 'scannedAt'] },
      { fields: ['scannedAt'] },
      { fields: ['scannerId'] }
    ]
  });

  return VisitorPassScan;
};
