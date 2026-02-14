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
      type: DataTypes.JSON,  // or DataTypes.TEXT for MySQL < 5.7
      allowNull: true,
      field: 'stallDetails'
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
    underscored: false,
    hooks: {
      beforeCreate: async (exhibitor) => {
        console.log('🔄 beforeCreate hook called for:', exhibitor.email);
        
        // Only hash if password is provided and not already hashed
        if (exhibitor.password && !exhibitor.password.startsWith('$2')) {
          console.log('🔑 Hashing password for new exhibitor');
          const bcrypt = require('bcryptjs');
          const hashedPassword = await bcrypt.hash(exhibitor.password, 10);
          exhibitor.password = hashedPassword;
          console.log('✅ Password hashed');
        } else if (exhibitor.password?.startsWith('$2')) {
          console.log('⚠️ Password already hashed, skipping re-hash');
        }
        
        // Store original password in metadata if provided via _originalPassword
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
        
        // Check if password field is being updated
        if (exhibitor.changed('password')) {
          console.log('📝 Password field changed');
          
          // Only hash if it's not already a bcrypt hash
          if (exhibitor.password && !exhibitor.password.startsWith('$2')) {
            console.log('🔑 Hashing updated password');
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(exhibitor.password, 10);
            exhibitor.password = hashedPassword;
            console.log('✅ Updated password hashed');
          } else if (exhibitor.password?.startsWith('$2')) {
            console.log('⚠️ Updated password already hashed, using as-is');
          }
          
          // Update metadata with new original password if provided
          if (exhibitor._originalPassword) {
            console.log('📝 Updating metadata with new original password');
            let metadata = exhibitor.metadata || {};
            if (typeof metadata === 'string') {
              try {
                metadata = JSON.parse(metadata);
              } catch {
                metadata = {};
              }
            }
            
            metadata.originalPassword = exhibitor._originalPassword;
            metadata.passwordUpdatedAt = new Date().toISOString();
            exhibitor.metadata = metadata;
            console.log('✅ Metadata updated');
          }
        }
        
        // Always update timestamp
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