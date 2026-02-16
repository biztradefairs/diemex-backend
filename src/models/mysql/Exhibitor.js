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
      field: 'boothNumber'
    },
    stallDetails: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'stallDetails',
      get() {
        const rawValue = this.getDataValue('stallDetails');
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
          this.setDataValue('stallDetails', JSON.stringify(value));
        } else {
          this.setDataValue('stallDetails', value);
        }
      }
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
    tableName: 'exhibitors',
    timestamps: true,
    underscored: false,
    hooks: {
      beforeCreate: async (exhibitor) => {
        console.log('🔄 beforeCreate hook called for:', exhibitor.email);
        
        if (exhibitor.password && !exhibitor.password.startsWith('$2')) {
          console.log('🔑 Hashing password for new exhibitor');
          const bcrypt = require('bcryptjs');
          const hashedPassword = await bcrypt.hash(exhibitor.password, 10);
          exhibitor.password = hashedPassword;
          console.log('✅ Password hashed');
        }
        
        if (exhibitor._originalPassword) {
          console.log('📝 Storing original password in metadata');
          const metadata = exhibitor.metadata || {};
          metadata.originalPassword = exhibitor._originalPassword;
          metadata.createdBy = 'admin';
          metadata.createdAt = new Date().toISOString();
          exhibitor.metadata = metadata;
          console.log('✅ Metadata updated with original password');
        }
      },
      
      beforeUpdate: async (exhibitor) => {
        console.log('🔄 beforeUpdate hook called for:', exhibitor.email);
        
        if (exhibitor.changed('password')) {
          console.log('📝 Password field changed');
          
          if (exhibitor.password && !exhibitor.password.startsWith('$2')) {
            console.log('🔑 Hashing updated password');
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(exhibitor.password, 10);
            exhibitor.password = hashedPassword;
            console.log('✅ Updated password hashed');
          }
          
          if (exhibitor._originalPassword) {
            console.log('📝 Updating metadata with new original password');
            let metadata = exhibitor.metadata || {};
            metadata.originalPassword = exhibitor._originalPassword;
            metadata.passwordUpdatedAt = new Date().toISOString();
            exhibitor.metadata = metadata;
            console.log('✅ Metadata updated');
          }
        }
        
        exhibitor.updatedAt = new Date();
      }
    }
  });

  Exhibitor.prototype.comparePassword = function(candidatePassword) {
    const bcrypt = require('bcryptjs');
    return bcrypt.compare(candidatePassword, this.password);
  };

  return Exhibitor;
};