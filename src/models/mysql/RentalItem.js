const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RentalItem = sequelize.define('RentalItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    itemKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'item_key'
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false
    },
    costFor3Days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'cost_for_3_days'
    },
    category: {
      type: DataTypes.ENUM('AV', 'IT', 'Other'),
      allowNull: false,
      defaultValue: 'Other'
    },
    imageUrl: {
      type: DataTypes.STRING,
      field: 'image_url'
    },
    cloudinaryPublicId: {
      type: DataTypes.STRING,
      field: 'cloudinary_public_id'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'display_order'
    }
  }, {
    tableName: 'rental_items',
    timestamps: true,
    underscored: true
  });

  return RentalItem;
};
