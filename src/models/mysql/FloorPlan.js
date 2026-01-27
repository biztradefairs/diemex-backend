// src/models/mysql/FloorPlan.js
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
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    floor: {
      type: DataTypes.STRING,
      allowNull: true
    },
    version: {
      type: DataTypes.STRING,
      defaultValue: '1.0'
    },
    image: {
      type: DataTypes.TEXT('long'),
      allowNull: true
    },
    // Store shapes as JSON
    shapes: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('shapes');
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value) {
        this.setDataValue('shapes', JSON.stringify(value || []));
      }
    },
    scale: {
      type: DataTypes.FLOAT,
      defaultValue: 0.1
    },
    gridSize: {
      type: DataTypes.INTEGER,
      defaultValue: 20
    },
    showGrid: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Store tags as JSON array
    tags: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('tags');
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value) {
        this.setDataValue('tags', JSON.stringify(value || []));
      }
    },
    // Store metadata as JSON
    metadata: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('metadata');
        return rawValue ? JSON.parse(rawValue) : {};
      },
      set(value) {
        this.setDataValue('metadata', JSON.stringify(value || {}));
      }
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    thumbnail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1
    }
  }, {
    tableName: 'floor_plans',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_floor_plan_name',
        fields: ['name']
      },
      {
        name: 'idx_floor_plan_floor',
        fields: ['floor']
      },
      {
        name: 'idx_floor_plan_created_by',
        fields: ['created_by']
      }
    ],
    hooks: {
      beforeValidate: (floorPlan) => {
        // Ensure shapes is an array
        if (!floorPlan.shapes) {
          floorPlan.shapes = [];
        }
        // Ensure tags is an array
        if (!floorPlan.tags) {
          floorPlan.tags = [];
        }
        // Ensure metadata is an object
        if (!floorPlan.metadata) {
          floorPlan.metadata = {};
        }
      }
    }
  });

  // Define associations
  FloorPlan.associate = (models) => {
    FloorPlan.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator'
    });
    FloorPlan.belongsTo(models.User, {
      foreignKey: 'updatedBy',
      as: 'updater'
    });
  };

  // Instance method to add a shape
  FloorPlan.prototype.addShape = function(shape) {
    const shapes = this.shapes || [];
    shapes.push({
      ...shape,
      id: Date.now() + Math.random().toString(36).substr(2, 9) // Generate unique ID
    });
    this.shapes = shapes;
    return this.save();
  };

  // Instance method to update a shape
  FloorPlan.prototype.updateShape = function(shapeId, updates) {
    const shapes = this.shapes || [];
    const shapeIndex = shapes.findIndex(shape => shape.id === shapeId);
    
    if (shapeIndex === -1) {
      throw new Error('Shape not found');
    }
    
    shapes[shapeIndex] = { ...shapes[shapeIndex], ...updates };
    this.shapes = shapes;
    return this.save();
  };

  // Instance method to remove a shape
  FloorPlan.prototype.removeShape = function(shapeId) {
    const shapes = this.shapes || [];
    const filteredShapes = shapes.filter(shape => shape.id !== shapeId);
    
    if (filteredShapes.length === shapes.length) {
      throw new Error('Shape not found');
    }
    
    this.shapes = filteredShapes;
    return this.save();
  };

  return FloorPlan;
};