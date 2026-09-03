const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContactSubmission = sequelize.define('ContactSubmission', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    formType: {
      type: DataTypes.STRING(60),
      allowNull: false,
      field: 'formType'
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    company: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true
    },
    emailStatus: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'pending',
      field: 'emailStatus'
    }
  }, {
    tableName: 'contact_submissions',
    timestamps: true,
    indexes: [
      { fields: ['email'] },
      { fields: ['formType'] }
    ]
  });

  return ContactSubmission;
};
