const express = require('express');
const router = express.Router();
const { authenticateExhibitor } = require('../middleware/auth');
const crypto = require('crypto');

// Initialize Cashfree
const { Cashfree } = require('cashfree-pg');

// Configure Cashfree
Cashfree.XClientId = process.env.CASHFREE_APP_ID;
Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
Cashfree.XEnvironment = process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION' 
  ? Cashfree.Environment.PRODUCTION 
  : Cashfree.Environment.SANDBOX;

// Create order endpoint
router.post('/create-order', authenticateExhibitor, async (req, res) => {
  try {
    const { amount, invoiceId, requirementsId, customerDetails } = req.body;

    // Generate unique order ID
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    // Prepare customer details
    const customerId = customerDetails?.customerId || `CUST_${req.user.id}_${Date.now()}`;
    const customerPhone = customerDetails?.phone || '9999999999';
    const customerEmail = customerDetails?.email || 'customer@example.com';
    const customerName = customerDetails?.name || 'Customer';

    // Create order request
    const request = {
      order_amount: amount,
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: customerId,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_name: customerName
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/dashboard/requirements/success?order_id={order_id}`,
        notify_url: `${process.env.BACKEND_URL}/api/cashfree/webhook`
      },
      order_note: `Payment for Invoice ${invoiceId || 'Exhibition Registration'}`
    };

    console.log('Creating Cashfree order:', request);

    // Create order with Cashfree
    const response = await Cashfree.PGCreateOrder('2023-08-01', request);

    if (response.status === 200 || response.status === 201) {
      // Store order info in database
      const sequelize = require('../config/database').getConnection('mysql');
      
      await sequelize.query(`
        INSERT INTO payment_orders (order_id, exhibitor_id, invoice_id, requirements_id, amount, status, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', NOW())
      `, {
        replacements: [orderId, req.user.id, invoiceId, requirementsId, amount]
      });

      res.json({
        success: true,
        data: {
          order_id: orderId,
          payment_session_id: response.data.payment_session_id,
          order_amount: response.data.order_amount,
          order_currency: response.data.order_currency
        }
      });
    } else {
      throw new Error('Failed to create order');
    }

  } catch (error) {
    console.error('Cashfree order creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create payment order'
    });
  }
});

// Verify payment endpoint
router.post('/verify-payment', authenticateExhibitor, async (req, res) => {
  try {
    const { order_id, payment_session_id, invoiceId, requirementsId } = req.body;

    // Fetch order details from Cashfree
    const response = await Cashfree.PGFetchOrder('2023-08-01', order_id);

    if (response.status === 200 && response.data) {
      const order = response.data;
      const paymentStatus = order.order_status;

      const sequelize = require('../config/database').getConnection('mysql');
      
      if (paymentStatus === 'PAID') {
        // Update order status
        await sequelize.query(`
          UPDATE payment_orders 
          SET status = 'completed', 
              payment_session_id = ?,
              updated_at = NOW()
          WHERE order_id = ?
        `, {
          replacements: [payment_session_id, order_id]
        });

        // Update invoice status
        if (invoiceId) {
          await sequelize.query(`
            UPDATE invoices 
            SET status = 'paid', 
                payment_id = ?,
                payment_order_id = ?,
                paid_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
          `, {
            replacements: [payment_session_id, order_id, invoiceId]
          });
        }

        // Update requirement status
        if (requirementsId) {
          await sequelize.query(`
            UPDATE requirements 
            SET payment_status = 'completed',
                status = 'approved',
                updated_at = NOW()
            WHERE id = ?
          `, {
            replacements: [requirementsId]
          });
        }

        res.json({
          success: true,
          message: 'Payment verified successfully',
          data: {
            order_id: order_id,
            payment_status: paymentStatus,
            amount: order.order_amount
          }
        });
      } else {
        res.json({
          success: false,
          message: 'Payment not completed',
          data: { order_status: paymentStatus }
        });
      }
    } else {
      throw new Error('Failed to fetch order details');
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Webhook for payment status updates
router.post('/webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    const signature = req.headers['x-webhook-signature'];
    
    // Verify webhook signature
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(JSON.stringify(webhookData))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { order_id, payment_status, payment_id } = webhookData;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    if (payment_status === 'SUCCESS') {
      await sequelize.query(`
        UPDATE payment_orders 
        SET status = 'completed', 
            payment_id = ?,
            updated_at = NOW()
        WHERE order_id = ?
      `, {
        replacements: [payment_id, order_id]
      });
    }
    
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order status
router.get('/order-status/:orderId', authenticateExhibitor, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const response = await Cashfree.PGFetchOrder('2023-08-01', orderId);
    
    if (response.status === 200) {
      res.json({
        success: true,
        data: {
          order_id: response.data.order_id,
          order_status: response.data.order_status,
          order_amount: response.data.order_amount,
          payment_method: response.data.payment_method
        }
      });
    } else {
      throw new Error('Failed to fetch order');
    }
    
  } catch (error) {
    console.error('Order status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;