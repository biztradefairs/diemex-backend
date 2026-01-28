const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Exhibitor = sequelize.define('Exhibitor', {
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
      unique: true,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    company: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    resetPasswordToken: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    sector: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    boothNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'boothNumber' // Explicit field name
    },
    stallDetails: {
      type: DataTypes.JSON,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'inactive', 'approved', 'rejected'),
      defaultValue: 'pending',
      allowNull: false
    },
    registrationDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'registrationDate'
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
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
    tableName: 'exhibitors',
    timestamps: true,
    underscored: false, // Use camelCase for field names
    hooks: {
      beforeCreate: async (exhibitor) => {
        if (exhibitor.password) {
          const bcrypt = require('bcryptjs');
          const hashedPassword = await bcrypt.hash(exhibitor.password, 10);
          exhibitor.password = hashedPassword;
          
          // Store original password in metadata
          if (exhibitor.originalPassword) {
            const metadata = {
              originalPassword: exhibitor.originalPassword,
              createdBy: 'admin',
              createdAt: new Date().toISOString()
            };
            exhibitor.metadata = metadata;
          }
        }
      },
      beforeUpdate: async (exhibitor) => {
        // Only hash password if it's changed
        if (exhibitor.changed('password') && exhibitor.password) {
          const bcrypt = require('bcryptjs');
          const hashedPassword = await bcrypt.hash(exhibitor.password, 10);
          exhibitor.password = hashedPassword;
          
          // Update metadata with new password
          let metadata = exhibitor.metadata || {};
          if (typeof metadata === 'string') {
            try {
              metadata = JSON.parse(metadata);
            } catch {
              metadata = {};
            }
          }
          
          if (exhibitor.originalPassword) {
            metadata.originalPassword = exhibitor.originalPassword;
            metadata.updatedAt = new Date().toISOString();
            exhibitor.metadata = metadata;
          }
        }
        
        // Always update the updatedAt timestamp
        exhibitor.updatedAt = new Date();
      }
    }
  });

  // Instance method to check password
  Exhibitor.prototype.comparePassword = function(candidatePassword) {
    const bcrypt = require('bcryptjs');
    return bcrypt.compare(candidatePassword, this.password);
  };

  return Exhibitor;
};