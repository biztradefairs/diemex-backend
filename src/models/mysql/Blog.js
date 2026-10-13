const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Blog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  slug: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  excerpt: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
  content: { type: DataTypes.TEXT('long'), allowNull: false },
  author: { type: DataTypes.STRING(120), allowNull: false, defaultValue: 'DIEMEX Team' },
  category: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'Industry Insights' },
  image: { type: DataTypes.STRING(2048), allowNull: true },
  status: { type: DataTypes.ENUM('draft', 'published'), allowNull: false, defaultValue: 'draft' },
  publishedAt: { type: DataTypes.DATE, allowNull: true },
  metaTitle: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
  metaDescription: { type: DataTypes.STRING(320), allowNull: false, defaultValue: '' },
}, {
  tableName: 'blogs',
  timestamps: true,
  indexes: [{ fields: ['status', 'publishedAt'] }],
});
