const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ManualSection = sequelize.define('ManualSection', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'general'
    },
    status: {
      type: DataTypes.ENUM('published', 'draft'),
      allowNull: false,
      defaultValue: 'published'
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'sortOrder'
    }
  }, {
    tableName: 'manual_sections',
    timestamps: true
  });

  return ManualSection;
};
