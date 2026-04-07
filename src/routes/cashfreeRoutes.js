// src/routes/cashfreeRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateAny } = require('../middleware/auth');
const crypto = require('crypto');
const axios = require('axios');

// Cashfree Configuration
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_MODE = process.env.CASHFREE_ENVIRONMENT || process.env.CASHFREE_MODE || 'production';

const CASHFREE_API_URL = CASHFREE_MODE === 'sandbox'
    ? 'https://sandbox.cashfree.com/pg'
    : 'https://api.cashfree.com/pg';

const CASHFREE_ORDER_URL = `${CASHFREE_API_URL}/orders`;

console.log('🔧 Cashfree Configuration:');
console.log(`  Mode: ${CASHFREE_MODE}`);
console.log(`  API URL: ${CASHFREE_API_URL}`);
console.log(`  App ID: ${CASHFREE_APP_ID ? '✓ Set' : '✗ Missing'}`);
console.log(`  Secret Key: ${CASHFREE_SECRET_KEY ? '✓ Set' : '✗ Missing'}`);

// Helper function to get the correct paid date column name
async function getPaidDateColumnName(sequelize) {
  try {
    const [columns] = await sequelize.query(`SHOW COLUMNS FROM invoices`);
    const columnNames = columns.map(c => c.Field);
    
    if (columnNames.includes('paid_at')) {
      return 'paid_at';
    } else if (columnNames.includes('paidDate')) {
      return 'paidDate';
    } else if (columnNames.includes('paid_date')) {
      return 'paid_date';
    }
    return null;
  } catch (error) {
    console.error('Error checking columns:', error);
    return null;
  }
}

// Webhook for payment status updates - MARKS INVOICE AS PAID ON SUCCESS
router.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook received');
    console.log('Body:', req.body);

    // ✅ FIXED extraction
    const order_id = req.body?.data?.order?.order_id;
    const payment_id = req.body?.data?.payment?.cf_payment_id;
    const payment_status = req.body?.data?.payment?.payment_status;

    if (!order_id) {
      console.error('❌ No order_id in webhook');
      return res.status(400).json({ success: false, error: 'Missing order_id' });
    }

    console.log('✅ Order ID:', order_id);
    console.log('💰 Payment Status:', payment_status);

    const sequelize = require('../config/database').getConnection('mysql');
    const now = new Date();

    // ✅ Update order
    await sequelize.query(`
      UPDATE cashfree_orders 
      SET order_status = ?, payment_id = ?, updated_at = ?
      WHERE order_id = ?
    `, {
      replacements: [payment_status, payment_id || null, now, order_id]
    });

    const [orders] = await sequelize.query(`
      SELECT * FROM cashfree_orders WHERE order_id = ?
    `, {
      replacements: [order_id]
    });

    if (orders.length > 0) {
      const order = orders[0];

      if (payment_status === 'SUCCESS') {
        console.log(`🎉 Payment SUCCESS for ${order_id}`);

        await sequelize.query(`
          UPDATE invoices 
          SET status = 'paid',
              paidDate = ?,
              updated_at = ?
          WHERE id = ?
        `, {
          replacements: [now, now, order.invoice_id]
        });

        console.log(`✅ Invoice ${order.invoice_id} marked as PAID`);
      }
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(200).json({ success: false, error: error.message });
  }
});

// Create Cashfree Order
router.post('/create-order', authenticateAny, async (req, res) => {
  try {
    console.log('📨 Creating Cashfree order...');
    console.log('Request body:', req.body);
    
    const { amount, invoiceId, requirementsId, customerDetails } = req.body;

    if (!amount || !invoiceId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Amount and invoiceId are required' 
      });
    }

    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      console.error('❌ Cashfree credentials missing');
      return res.status(500).json({
        success: false,
        error: 'Payment gateway not configured'
      });
    }

    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    
    const webhookUrl = `${process.env.BACKEND_URL || 'https://diemex-backend.onrender.com'}/api/cashfree/webhook`;
    const returnUrl = `${process.env.FRONTEND_URL || 'https://www.diemex.in'}/dashboard/invoice/${invoiceId}?payment_status=success&order_id=${orderId}`;
    
    const orderData = {
      order_id: orderId,
      order_amount: Number(amount),
      order_currency: 'INR',
      order_note: `Payment for Invoice: ${invoiceId}`,
      customer_details: {
        customer_id: customerDetails?.customerId || req.user?.id || 'guest_' + Date.now(),
        customer_name: customerDetails?.customerName || req.user?.name || 'Customer',
        customer_email: customerDetails?.customerEmail || req.user?.email || 'customer@example.com',
        customer_phone: customerDetails?.customerPhone || req.user?.phone || '9999999999'
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: webhookUrl
      }
    };

    console.log(`💰 Using Cashfree ${CASHFREE_MODE} mode`);
    console.log(`📦 Order amount: ${amount}`);
    
    const response = await axios.post(CASHFREE_ORDER_URL, orderData, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY
      }
    });

    console.log('✅ Cashfree order created:', response.data.order_id);
    console.log('✅ Payment Session ID:', response.data.payment_session_id);

    const sequelize = require('../config/database').getConnection('mysql');
    const now = new Date();

    // Create table if not exists
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
        INDEX idx_invoice_id (invoice_id)
      )
    `);

    await sequelize.query(`
      INSERT INTO cashfree_orders (
        id, order_id, invoice_id, requirement_id, exhibitor_id, 
        amount, order_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, {
      replacements: [
        crypto.randomUUID(), orderId, invoiceId, requirementsId, req.user?.id || 'guest',
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
    
    let errorMessage = error.response?.data?.message || error.message;
    let statusCode = error.response?.status || 500;
    
    if (statusCode === 401) {
      errorMessage = `Authentication failed. Please check your ${CASHFREE_MODE} credentials.`;
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      mode: CASHFREE_MODE
    });
  }
});

// Verify payment AND update invoice status
router.get('/verify-payment/:orderId', authenticateAny, async (req, res) => {
  try {
    const { orderId } = req.params;

    const sequelize = require('../config/database').getConnection('mysql');

    // 1. Get order from DB
    const [orders] = await sequelize.query(`
      SELECT * FROM cashfree_orders WHERE order_id = ?
    `, {
      replacements: [orderId]
    });

    if (!orders.length) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orders[0];

    // 2. Call Cashfree API to verify payment
    const axios = require('axios');

    const response = await axios.get(
      `${process.env.CASHFREE_ENVIRONMENT === 'sandbox'
        ? 'https://sandbox.cashfree.com/pg'
        : 'https://api.cashfree.com/pg'
      }/orders/${orderId}/payments`,
      {
        headers: {
          'x-api-version': '2022-09-01',
          'x-client-id': process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY
        }
      }
    );

    const payments = response.data;

    // 3. Find SUCCESS payment
    const successfulPayment = payments.find(
      p => p.payment_status === 'SUCCESS'
    );

    if (!successfulPayment) {
      return res.json({
        success: true,
        data: {
          paymentStatus: 'PENDING'
        }
      });
    }

    // ✅ 4. UPDATE INVOICE TO PAID (THIS IS THE MAIN FIX)
    const now = new Date();

    await sequelize.query(`
      UPDATE invoices
      SET status = 'paid',
          paidDate = ?,
          updated_at = ?
      WHERE id = ?
    `, {
      replacements: [now, now, order.invoice_id]
    });

    console.log(`✅ Invoice ${order.invoice_id} marked as PAID`);

    return res.json({
      success: true,
      data: {
        paymentStatus: 'SUCCESS',
        orderId,
        paymentId: successfulPayment.cf_payment_id
      }
    });

  } catch (error) {
    console.error('❌ Verify payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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
    console.error('Error fetching payment status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get payment details by invoice ID
router.get('/invoice/:invoiceId', authenticateAny, async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [orders] = await sequelize.query(`
      SELECT * FROM cashfree_orders WHERE invoice_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, {
      replacements: [invoiceId]
    });
    
    res.json({ success: true, data: orders[0] || null });
  } catch (error) {
    console.error('Error fetching payment by invoice:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint
router.get('/test-credentials', async (req, res) => {
  try {
    if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Cashfree credentials not configured'
      });
    }
    
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

    res.json({ 
      success: true, 
      message: `✅ Credentials valid for ${CASHFREE_MODE} mode!`,
      data: response.data 
    });
  } catch (error) {
    console.error('Test error:', error.response?.data || error.message);
    res.status(401).json({ 
      success: false, 
      error: `❌ Invalid ${CASHFREE_MODE} credentials: ${error.response?.data?.message || error.message}`,
      mode: CASHFREE_MODE,
      expectedApiUrl: CASHFREE_API_URL
    });
  }
});

module.exports = router;