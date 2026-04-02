// models/mysql/Visitor.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Visitor = sequelize.define('Visitor', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    mobile: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    company: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    designation: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    pinCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'pinCode'
    },
    registeredAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'registeredAt'
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ipAddress'
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'userAgent'
    },
    referrer: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'cancelled'),
      defaultValue: 'confirmed'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('metadata');
        if (!rawValue) return {};
        if (typeof rawValue === 'string') {
          try {
            return JSON.parse(rawValue);
          } catch {
            return {};
          }
        }
        return rawValue;
      },
      set(value) {
        if (typeof value === 'object') {
          this.setDataValue('metadata', JSON.stringify(value));
        } else {
          this.setDataValue('metadata', value);
        }
      }
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'visitors',
    timestamps: true,
    underscored: false,
    indexes: [
      {
        fields: ['email']
      },
      {
        fields: ['company']
      },
      {
        fields: ['registeredAt']
      },
      {
        fields: ['status']
      }
    ]
  });

  // Method to check if visitor is an exhibitor
  Visitor.prototype.isExhibitor = async function() {
    const Exhibitor = sequelize.models.Exhibitor;
    const exhibitor = await Exhibitor.findOne({
      where: { company: this.company }
    });
    return !!exhibitor;
  };

  return Visitor;
};