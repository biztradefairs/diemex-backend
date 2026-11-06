const { DataTypes } = require('sequelize');

module.exports = sequelize => {
  const Sync = sequelize.define('VisitorPassCmsSync', {
    visitorPassId: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    payload: { type: DataTypes.JSON, allowNull: false },
    payloadHash: { type: DataTypes.STRING(64), allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    leadId: { type: DataTypes.STRING(100), allowNull: true },
    lastError: { type: DataTypes.TEXT, allowNull: true },
    nextAttemptAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    syncedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'visitor_pass_cms_sync',
    timestamps: true,
    indexes: [{ fields: ['status', 'nextAttemptAt'] }],
  });
  Sync.associate = models => {
    Sync.belongsTo(models.VisitorPass, { foreignKey: 'visitorPassId', constraints: false });
    models.VisitorPass.hasOne(Sync, { as: 'cmsSync', foreignKey: 'visitorPassId', constraints: false });
  };
  return Sync;
};
