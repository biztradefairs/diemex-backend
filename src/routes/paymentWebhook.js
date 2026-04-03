const express = require('express');
const router = express.Router();
const crypto = require('crypto');

router.post('/razorpay-webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');
    
    if (signature !== digest) {
      return res.status(400).send('Invalid signature');
    }
    
    const event = req.body.event;
    const payment = req.body.payload.payment.entity;
    
    if (event === 'payment.captured') {
      // Update your database
      const sequelize = require('../config/database').getConnection('mysql');
      
      await sequelize.query(`
        UPDATE invoices 
        SET status = 'paid', 
            payment_id = ?,
            paid_at = ?
        WHERE payment_order_id = ?
      `, {
        replacements: [payment.id, new Date(), payment.order_id]
      });
    }
    
    res.status(200).send('Webhook received');
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Webhook processing failed');
  }
});

module.exports = router;