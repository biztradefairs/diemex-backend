const express = require('express');
const router = express.Router();
const { authenticateAny } = require('../middleware/auth');
const crypto = require('crypto');
const axios = require('axios');

// Cashfree Configuration
const CASHFREE_API_URL = process.env.CASHFREE_API_URL || 'https://sandbox.cashfree.com/pg';
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;

// Create Cashfree Order
router.post('/create-order', authenticateAny, async (req, res) => {
  try {
    const { amount, invoiceId, requirementsId, customerDetails } = req.body;

    if (!amount || !invoiceId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Amount and invoiceId are required' 
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
        customer_name: customerDetails?.customerName || req.user.name,
        customer_email: customerDetails?.customerEmail || req.user.email,
        customer_phone: customerDetails?.customerPhone || req.user.phone
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/dashboard/requirements/payment-status?order_id={order_id}&invoiceId=${invoiceId}`
      }
    };

    // If using sandbox/test mode
    const isSandbox = process.env.CASHFREE_MODE === 'sandbox' || true;
    const apiUrl = isSandbox ? 'https://sandbox.cashfree.com/pg/orders' : 'https://api.cashfree.com/pg/orders';

    const response = await axios.post(apiUrl, orderData, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': CASHFREE_APP_ID,
        'x-client-secret': CASHFREE_SECRET_KEY
      }
    });

    // Store order in database
    const sequelize = require('../config/database').getConnection('mysql');
    const now = new Date();

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
    console.error('Cashfree create order error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.message || error.message 
    });
  }
});

// Verify Payment (Webhook)
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const body = req.body;
    
    // Verify webhook signature (implement based on Cashfree docs)
    
    const { order_id, order_amount, payment_id, payment_status } = body;
    
    const sequelize = require('../config/database').getConnection('mysql');
    const now = new Date();
    
    // Update order status
    await sequelize.query(`
      UPDATE cashfree_orders 
      SET order_status = ?, payment_id = ?, updated_at = ?
      WHERE order_id = ?
    `, {
      replacements: [payment_status, payment_id, now, order_id]
    });
    
    if (payment_status === 'SUCCESS') {
      // Get order details
      const [orders] = await sequelize.query(`
        SELECT * FROM cashfree_orders WHERE order_id = ?
      `, {
        replacements: [order_id]
      });
      
      if (orders.length > 0) {
        const order = orders[0];
        
        // Update invoice
        await sequelize.query(`
          UPDATE invoices 
          SET status = 'paid', paid_at = ?, updated_at = ?
          WHERE id = ?
        `, {
          replacements: [now, now, order.invoice_id]
        });
        
        // Update requirement
        await sequelize.query(`
          UPDATE requirements 
          SET payment_status = 'completed', status = 'approved', updated_at = ?
          WHERE id = ?
        `, {
          replacements: [now, order.requirement_id]
        });
        
        // Create payment record
        await sequelize.query(`
          INSERT INTO payments (
            id, exhibitor_id, invoice_id, requirement_id, payment_reference,
            amount, amount_paid, payment_mode, payment_date, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, {
          replacements: [
            crypto.randomUUID(), order.exhibitor_id, order.invoice_id, order.requirement_id,
            payment_id, order.amount, order.amount, 'CASHFREE', now, 'verified', now, now
          ]
        });
      }
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false });
  }
});

// Get Payment Status
router.get('/payment-status/:orderId', authenticateAny, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [orders] = await sequelize.query(`
      SELECT * FROM cashfree_orders 
      WHERE order_id = ? AND exhibitor_id = ?
    `, {
      replacements: [orderId, req.user.id]
    });
    
    if (!orders.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    res.json({ success: true, data: orders[0] });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;