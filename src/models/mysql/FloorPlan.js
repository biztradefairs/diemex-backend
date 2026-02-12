const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const FloorPlan = sequelize.define('FloorPlan', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Exhibition Floor Plan'
    },
    // Store only booths, no complex shapes
    booths: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('booths');
        if (!rawValue) return [];
        try {
          return JSON.parse(rawValue);
        } catch {
          return [];
        }
      },
      set(value) {
        this.setDataValue('booths', JSON.stringify(value || []));
      }
    },
    backgroundImage: {
      type: DataTypes.TEXT('long'),
      allowNull: true
    },
    gridSize: {
      type: DataTypes.INTEGER,
      defaultValue: 20
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'floor_plans',
    timestamps: true,
    underscored: true
  });

  FloorPlan.associate = (models) => {
    FloorPlan.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator'
    });
  };

  return FloorPlan;
};