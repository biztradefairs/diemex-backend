const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VisitorPass = sequelize.define('VisitorPass', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    registrationNumber: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
      field: 'registrationNumber'
    },
    publicCode: {
      type: DataTypes.STRING(24),
      allowNull: false,
      unique: true,
      field: 'publicCode'
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    countryCode: {
      type: DataTypes.STRING(8),
      allowNull: false,
      field: 'countryCode'
    },
    nationalNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'nationalNumber'
    },
    channel: {
      type: DataTypes.ENUM('sms', 'whatsapp'),
      allowNull: false,
      defaultValue: 'whatsapp'
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    company: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    designation: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    area: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    city: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    state: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(120),
      allowNull: true,
      defaultValue: 'India'
    },
    pinCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'pinCode'
    },
    source: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    interests: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('interests');
        if (!rawValue) return [];
        if (typeof rawValue === 'string') {
          try {
            return JSON.parse(rawValue);
          } catch {
            return [];
          }
        }
        return rawValue;
      },
      set(value) {
        this.setDataValue('interests', Array.isArray(value) ? value : []);
      }
    },
    qrPayload: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'qrPayload'
    },
    status: {
      type: DataTypes.ENUM('issued', 'checked_in', 'cancelled'),
      defaultValue: 'issued'
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'issuedAt'
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'sentAt'
    },
    sentVia: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'sentVia'
    },
    sentStatus: {
      type: DataTypes.STRING(40),
      allowNull: true,
      field: 'sentStatus'
    },
    checkedInAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'checkedInAt'
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verifiedAt'
    }
  }, {
    tableName: 'visitor_passes',
    timestamps: true,
    indexes: [
      { fields: ['phone'] },
      { fields: ['registrationNumber'] },
      { fields: ['publicCode'] },
      { fields: ['status'] }
    ]
  });

  return VisitorPass;
};
