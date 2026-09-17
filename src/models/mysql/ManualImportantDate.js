const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ManualImportantDate = sequelize.define('ManualImportantDate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    label: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    dateLabel: {
      type: DataTypes.STRING(120),
      allowNull: false,
      field: 'dateLabel'
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'sortOrder'
    }
  }, {
    tableName: 'manual_important_dates',
    timestamps: true
  });

  return ManualImportantDate;
};
