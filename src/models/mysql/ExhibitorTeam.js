const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ExhibitorTeam = sequelize.define('ExhibitorTeam', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    exhibitorId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'exhibitorId'
    },
    companyName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'companyName'
    },
    city: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'submittedAt'
    }
  }, {
    tableName: 'exhibitor_teams',
    timestamps: true
  });

  ExhibitorTeam.associate = (models) => {
    ExhibitorTeam.belongsTo(models.Exhibitor, {
      foreignKey: 'exhibitorId',
      as: 'exhibitor'
    });
    ExhibitorTeam.hasMany(models.ExhibitorTeamMember, {
      foreignKey: 'teamId',
      as: 'members',
      onDelete: 'CASCADE'
    });
  };

  return ExhibitorTeam;
};
