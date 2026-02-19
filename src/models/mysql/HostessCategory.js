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
      unique: true
    },
    ratePerDay: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'rate_per_day'
    },
    workingHours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 8,
      field: 'working_hours'
    },
    description: {
      type: DataTypes.TEXT
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    tableName: 'hostess_categories',
    timestamps: true,
    underscored: true
  });

  return HostessCategory;
};
