const { DataTypes } = require('sequelize');
const database = require('../../config/database');

// Export a function that returns the model, not the model itself
const getInvoiceModel = () => {
  const sequelize = database.getConnection('mysql');
  
  if (!sequelize) {
    throw new Error(
      'MySQL connection not initialized. Call database.connect() before loading models.'
    );
  }
  
  return sequelize.define('Invoice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    invoiceNumber: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    exhibitorId: {
      type: DataTypes.UUID
    },
    company: {
      type: DataTypes.STRING,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('draft', 'pending', 'paid', 'overdue', 'cancelled'),
      defaultValue: 'draft'
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    issueDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    paidDate: {
      type: DataTypes.DATE
    },
    items: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    notes: {
      type: DataTypes.TEXT
    },
    terms: {
      type: DataTypes.TEXT
    },
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {}
    }
  }, {
    tableName: 'invoices',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['invoiceNumber']
      },
      {
        fields: ['status']
      },
      {
        fields: ['dueDate']
      },
      {
        fields: ['exhibitorId']
      }
    ]
  });
};

module.exports = getInvoiceModel;