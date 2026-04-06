// src/routes/cashfreeRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateAny } = require('../middleware/auth');
const crypto = require('crypto');
const axios = require('axios');

// Cashfree Configuration - Add default values and error handling
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_MODE = process.env.CASHFREE_MODE || 'sandbox'; // Use sandbox for testing

// Define URLs based on mode - THIS WAS MISSING
const CASHFREE_API_URL = CASHFREE_MODE === 'sandbox'
    ? 'https://sandbox.cashfree.com/pg'
    : 'https://api.cashfree.com/pg';

const CASHFREE_ORDER_URL = `${CASHFREE_API_URL}/orders`;

// Log configuration on startup
console.log('🔧 Cashfree Configuration:');
console.log(`  Mode: ${CASHFREE_MODE}`);
console.log(`  API URL: ${CASHFREE_API_URL}`);
console.log(`  Order URL: ${CASHFREE_ORDER_URL}`);
console.log(`  App ID: ${CASHFREE_APP_ID ? '✓ Set' : '✗ Missing'}`);
console.log(`  Secret Key: ${CASHFREE_SECRET_KEY ? '✓ Set' : '✗ Missing'}`);

// Verify webhook signature
const verifyWebhookSignature = (body, signature, secretKey) => {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', secretKey)
            .update(JSON.stringify(body))
            .digest('base64');
        return signature === expectedSignature;
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
};

// Create Cashfree Order
router.post('/create-order', authenticateAny, async (req, res) => {
    try {
        console.log('📨 Creating Cashfree order...');
        
        // Validate environment variables
        if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
            console.error('❌ Cashfree credentials missing');
            console.error('  CASHFREE_APP_ID:', CASHFREE_APP_ID ? 'Set' : 'Missing');
            console.error('  CASHFREE_SECRET_KEY:', CASHFREE_SECRET_KEY ? 'Set' : 'Missing');
            return res.status(500).json({
                success: false,
                error: 'Payment gateway not configured. Please contact support.'
            });
        }

        if (!CASHFREE_ORDER_URL) {
            console.error('❌ CASHFREE_ORDER_URL is not defined');
            return res.status(500).json({
                success: false,
                error: 'Payment gateway configuration error. Please contact support.'
            });
        }

        const { amount, invoiceId, requirementsId, customerDetails } = req.body;

        if (!amount || !invoiceId) {
            return res.status(400).json({
                success: false,
                error: 'Amount and invoiceId are required'
            });
        }

        const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
        
        // Get backend URL from environment or use default
        const BACKEND_URL = process.env.BACKEND_URL || 'https://diemex-backend.onrender.com';
        const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.diemex.in';
        
        const webhookUrl = `${BACKEND_URL}/api/cashfree/webhook`;
        
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
                return_url: `${FRONTEND_URL}/dashboard/invoice/${invoiceId}?payment_status=success&order_id=${orderId}`,
                notify_url: webhookUrl
            }
        };

        console.log(`💰 Using Cashfree ${CASHFREE_MODE} mode`);
        console.log(`🌐 API URL: ${CASHFREE_ORDER_URL}`);
        console.log(`🔔 Webhook URL: ${webhookUrl}`);
        console.log(`📦 Order Data:`, JSON.stringify(orderData, null, 2));
        
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

        // Ensure table exists
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
            console.log('Table creation error:', err.message);
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
        console.error('Full error:', error);
        
        // Send detailed error for debugging
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.response?.data?.message || error.message || 'Payment initialization failed',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Webhook for payment status updates
router.post('/webhook', async (req, res) => {
    try {
        console.log('📨 Webhook received');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        
        const { order_id, payment_id, payment_status, order_amount, payment_message } = req.body;
        
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
        
        // Get the order details
        const [orders] = await sequelize.query(`
            SELECT * FROM cashfree_orders WHERE order_id = ?
        `, {
            replacements: [order_id]
        });
        
        if (orders.length > 0) {
            const order = orders[0];
            
            if (payment_status === 'SUCCESS' || payment_status === 'PAID') {
                console.log(`✅ Payment successful for order ${order_id}, updating invoice ${order.invoice_id}`);
                
                // Update invoice status to paid
                await sequelize.query(`
                    UPDATE invoices 
                    SET status = 'paid', 
                        paid_at = ?, 
                        updated_at = ?,
                        metadata = JSON_SET(COALESCE(metadata, '{}'), '$.paymentId', ?, '$.paymentDate', ?)
                    WHERE id = ?
                `, {
                    replacements: [now, now, payment_id, now.toISOString(), order.invoice_id]
                });
                
                // Update requirements if linked
                if (order.requirement_id) {
                    await sequelize.query(`
                        UPDATE requirements 
                        SET payment_status = 'completed', 
                            status = 'approved', 
                            updated_at = ? 
                        WHERE id = ?
                    `, {
                        replacements: [now, order.requirement_id]
                    });
                }
                
                console.log(`✅ Invoice ${order.invoice_id} marked as paid`);
            } else if (payment_status === 'FAILED' || payment_status === 'CANCELLED') {
                console.log(`❌ Payment failed for order ${order_id}`);
                
                await sequelize.query(`
                    UPDATE invoices 
                    SET status = 'pending', 
                        updated_at = ?,
                        metadata = JSON_SET(COALESCE(metadata, '{}'), '$.paymentError', ?)
                    WHERE id = ?
                `, {
                    replacements: [now, payment_message || 'Payment failed', order.invoice_id]
                });
            }
        }
        
        res.status(200).json({ success: true });
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        res.status(200).json({ success: false, error: error.message });
    }
});

// Verify payment status
router.get('/verify-payment/:orderId', authenticateAny, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
            return res.status(500).json({
                success: false,
                error: 'Payment gateway not configured'
            });
        }
        
        // Call Cashfree API to verify payment status
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
                
                await sequelize.query(`
                    UPDATE invoices 
                    SET status = 'paid', paid_at = ?, updated_at = ?
                    WHERE id = ?
                `, {
                    replacements: [now, now, order.invoice_id]
                });
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

        res.json({ success: true, message: 'Credentials valid!', data: response.data });
    } catch (error) {
        console.error('Test error:', error.response?.data || error.message);
        res.status(401).json({
            success: false,
            error: error.response?.data?.message || 'Invalid credentials'
        });
    }
});

module.exports = router;