const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ExhibitorTeamMember = sequelize.define('ExhibitorTeamMember', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    teamId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'teamId'
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    designation: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'sortOrder'
    }
  }, {
    tableName: 'exhibitor_team_members',
    timestamps: true
  });

  ExhibitorTeamMember.associate = (models) => {
    ExhibitorTeamMember.belongsTo(models.ExhibitorTeam, {
      foreignKey: 'teamId',
      as: 'team'
    });
  };

  return ExhibitorTeamMember;
};
