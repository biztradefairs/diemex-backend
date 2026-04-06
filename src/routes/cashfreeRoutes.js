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

// Webhook for payment status updates - THIS MARKS INVOICE AS PAID ON SUCCESS
router.post('/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook received');
    console.log('Body:', req.body);
    
    const { order_id, payment_id, payment_status } = req.body;
    
    if (!order_id) {
      console.error('No order_id in webhook');
      return res.status(400).json({ success: false, error: 'Missing order_id' });
    }
    
    const sequelize = require('../config/database').getConnection('mysql');
    const now = new Date();
    
    // Update cashfree_orders table
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
      
      // CRITICAL: On successful payment, mark invoice as PAID automatically
      if (payment_status === 'SUCCESS' || payment_status === 'PAID') {
        console.log(`✅ Payment successful for order ${order_id}, updating invoice ${order.invoice_id} to PAID`);
        
        // Get current invoice to check status
        const [invoices] = await sequelize.query(`
          SELECT * FROM invoices WHERE id = ?
        `, {
          replacements: [order.invoice_id]
        });
        
        if (invoices.length > 0) {
          const invoice = invoices[0];
          let metadata = {};
          
          if (invoice.metadata) {
            metadata = typeof invoice.metadata === 'string' 
              ? JSON.parse(invoice.metadata) 
              : invoice.metadata;
          }
          
          // Add payment info to metadata
          metadata.paymentInfo = {
            paymentId: payment_id,
            orderId: order_id,
            paidAt: now.toISOString(),
            amount: order.amount,
            gateway: 'cashfree',
            status: 'success'
          };
          
          // Update invoice status to PAID
          await sequelize.query(`
            UPDATE invoices 
            SET status = 'paid', 
                paid_at = ?, 
                metadata = ?,
                updated_at = ?
            WHERE id = ?
          `, {
            replacements: [now, JSON.stringify(metadata), now, order.invoice_id]
          });
          
          console.log(`✅✅✅ Invoice ${order.invoice_id} marked as PAID successfully!`);
        } else {
          console.log(`⚠️ Invoice ${order.invoice_id} not found`);
        }
      } else {
        console.log(`⚠️ Payment status for order ${order_id} is ${payment_status} - not marking as paid`);
      }
    } else {
      console.log(`⚠️ No order found for order_id: ${order_id}`);
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

    const sequelize = require('../config/database').getConnection('mysql');
    const now = new Date();

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

// Verify payment status - THIS ALSO MARKS INVOICE AS PAID ON VERIFICATION
router.get('/verify-payment/:orderId', authenticateAny, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const response = await axios.get(`${CASHFREE_ORDER_URL}/${orderId}/payments`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY
      }
    });
    
    const payments = response.data;
    const payment = payments[0];
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    if (payment && payment.payment_status === 'SUCCESS') {
      const [orders] = await sequelize.query(`
        SELECT * FROM cashfree_orders WHERE order_id = ?
      `, {
        replacements: [orderId]
      });
      
      if (orders.length > 0) {
        const order = orders[0];
        const now = new Date();
        
        // Get current invoice
        const [invoices] = await sequelize.query(`
          SELECT * FROM invoices WHERE id = ?
        `, {
          replacements: [order.invoice_id]
        });
        
        if (invoices.length > 0 && invoices[0].status !== 'paid') {
          const invoice = invoices[0];
          let metadata = {};
          
          if (invoice.metadata) {
            metadata = typeof invoice.metadata === 'string' 
              ? JSON.parse(invoice.metadata) 
              : invoice.metadata;
          }
          
          metadata.paymentInfo = {
            paymentId: payment.payment_id,
            orderId: orderId,
            paidAt: now.toISOString(),
            amount: order.amount,
            gateway: 'cashfree',
            status: 'success'
          };
          
          await sequelize.query(`
            UPDATE invoices 
            SET status = 'paid', paid_at = ?, metadata = ?, updated_at = ?
            WHERE id = ?
          `, {
            replacements: [now, JSON.stringify(metadata), now, order.invoice_id]
          });
          
          console.log(`✅ Payment verified and invoice ${order.invoice_id} marked as PAID`);
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        orderId,
        paymentStatus: payment?.payment_status || 'PENDING',
        paymentId: payment?.payment_id,
        amount: payment?.order_amount
      }
    });
    
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, error: error.message });
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