// src/routes/cashfreeRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateAny } = require('../middleware/auth');
const crypto = require('crypto');
const axios = require('axios');

// Cashfree Configuration
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_MODE = process.env.CASHFREE_MODE || 'production';

// Use production URLs
const CASHFREE_API_URL =
  process.env.CASHFREE_MODE === 'sandbox'
    ? 'https://sandbox.cashfree.com/pg'
    : 'https://api.cashfree.com/pg';
const CASHFREE_ORDER_URL = `${CASHFREE_API_URL}/orders`;

// Create Cashfree Order
router.post('/create-order', authenticateAny, async (req, res) => {
  try {
    console.log('📨 Creating Cashfree order...');
    
    const { amount, invoiceId, requirementsId, customerDetails } = req.body;

    if (!amount || !invoiceId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Amount and invoiceId are required' 
      });
    }

    // Validate credentials
    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      console.error('❌ Cashfree credentials missing');
      return res.status(500).json({
        success: false,
        error: 'Payment gateway not configured'
      });
    }

    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    
    const orderData = {
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      order_note: `Payment for Invoice: ${invoiceId}`,
      customer_details: {
        customer_id: customerDetails?.customerId || req.user.id,
        customer_name: customerDetails?.customerName || req.user.name || 'Customer',
        customer_email: customerDetails?.customerEmail || req.user.email,
        customer_phone: customerDetails?.customerPhone || req.user.phone || '9999999999'
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL || 'https://www.diemex.in'}/dashboard/requirements/payment-status?order_id={order_id}&invoiceId=${invoiceId}`
      }
    };

    console.log(`💰 Using Cashfree PRODUCTION mode`);
    console.log(`🌐 API URL: ${CASHFREE_ORDER_URL}`);
    
    const response = await axios.post(CASHFREE_ORDER_URL, orderData, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY
      }
    });

    console.log('✅ Cashfree order created:', response.data.order_id);

    // Store in database
    const sequelize = require('../config/database').getConnection('mysql');
    const now = new Date();

    // Check if table exists, create if not
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS cashfree_orders (
          id VARCHAR(36) PRIMARY KEY,
          order_id VARCHAR(100) UNIQUE NOT NULL,
          invoice_id VARCHAR(36),
          requirement_id VARCHAR(36),
          exhibitor_id VARCHAR(36),
          amount DECIMAL(10,2),
          order_status VARCHAR(50) DEFAULT 'PENDING',
          payment_id VARCHAR(100),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_order_id (order_id),
          INDEX idx_exhibitor_id (exhibitor_id)
        )
      `);
    } catch (err) {
      console.log('Table may already exist:', err.message);
    }

    await sequelize.query(`
      INSERT INTO cashfree_orders (
        id, order_id, invoice_id, requirement_id, exhibitor_id, 
        amount, order_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, {
      replacements: [
        crypto.randomUUID(), orderId, invoiceId, requirementsId, req.user.id,
        amount, 'PENDING', now, now
      ]
    });

    res.json({
      success: true,
      data: {
        orderId: response.data.order_id,
        paymentSessionId: response.data.payment_session_id,
        orderAmount: response.data.order_amount
      }
    });

  } catch (error) {
    console.error('❌ Cashfree error:', error.response?.data || error.message);
    
    if (error.response?.status === 401 || error.response?.data?.message === 'authentication Failed') {
      return res.status(401).json({
        success: false,
        error: 'Payment gateway authentication failed. Please check API credentials.'
      });
    }
    
    res.status(error.response?.status || 500).json({ 
      success: false, 
      error: error.response?.data?.message || error.message 
    });
  }
});

// Webhook for payment status updates
router.post('/webhook', async (req, res) => {
  try {
    const { order_id, payment_id, payment_status } = req.body;
    
    const sequelize = require('../config/database').getConnection('mysql');
    const now = new Date();
    
    await sequelize.query(`
      UPDATE cashfree_orders 
      SET order_status = ?, payment_id = ?, updated_at = ?
      WHERE order_id = ?
    `, {
      replacements: [payment_status, payment_id, now, order_id]
    });
    
    if (payment_status === 'SUCCESS') {
      const [orders] = await sequelize.query(`
        SELECT * FROM cashfree_orders WHERE order_id = ?
      `, {
        replacements: [order_id]
      });
      
      if (orders.length > 0) {
        const order = orders[0];
        
        await sequelize.query(`
          UPDATE invoices SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?
        `, {
          replacements: [now, now, order.invoice_id]
        });
        
        await sequelize.query(`
          UPDATE requirements SET payment_status = 'completed', status = 'approved', updated_at = ? WHERE id = ?
        `, {
          replacements: [now, order.requirement_id]
        });
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false });
  }
});

// Get payment status
router.get('/payment-status/:orderId', authenticateAny, async (req, res) => {
  try {
    const { orderId } = req.params;
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [orders] = await sequelize.query(`
      SELECT * FROM cashfree_orders WHERE order_id = ? AND exhibitor_id = ?
    `, {
      replacements: [orderId, req.user.id]
    });
    
    res.json({ success: true, data: orders[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint
router.get('/test-credentials', async (req, res) => {
  try {
    const testOrder = {
      order_id: `TEST_${Date.now()}`,
      order_amount: 1,
      order_currency: 'INR',
      order_note: 'Test order',
      customer_details: {
        customer_id: 'test',
        customer_name: 'Test',
        customer_email: 'test@example.com',
        customer_phone: '9999999999'
      }
    };

    const response = await axios.post(CASHFREE_ORDER_URL, testOrder, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY
      }
    });

    res.json({ success: true, message: 'Credentials valid!' });
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      error: error.response?.data?.message || 'Invalid credentials' 
    });
  }
});

module.exports = router;