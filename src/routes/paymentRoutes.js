// src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateExhibitor, authenticate, authorize } = require('../middleware/auth');
const crypto = require('crypto');

// ==================== CASH/CHEQUE/DD PAYMENT ROUTES ====================

// Submit cash payment details
router.post('/cash-payment', authenticateExhibitor, async (req, res) => {
  try {
    const {
      requirementId,
      invoiceId,
      amount,
      amountPaid,
      paymentMode,
      paymentDate,
      chequeNumber,
      chequeDate,
      bankName,
      ddNumber,
      ddDate,
      remarks,
      status = 'pending_verification'
    } = req.body;

    const sequelize = require('../config/database').getConnection('mysql');

    const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const paymentId = crypto.randomUUID();
    const now = new Date();

    await sequelize.query(`
      INSERT INTO payments (
        id, exhibitor_id, invoice_id, requirement_id, payment_reference,
        amount, amount_paid, payment_mode, payment_date,
        cheque_number, cheque_date, bank_name,
        dd_number, dd_date,
        remarks, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, {
      replacements: [
        paymentId, req.user.id, invoiceId, requirementId, paymentReference,
        amount, amountPaid || amount, paymentMode,
        paymentDate || now.toISOString().split('T')[0],
        chequeNumber || null, chequeDate || null, bankName || null,
        ddNumber || null, ddDate || null,
        remarks || null, status, now, now
      ]
    });

    if (invoiceId) {
      await sequelize.query(`
        UPDATE invoices 
        SET status = 'pending_verification', 
            payment_reference = ?, updated_at = ?
        WHERE id = ?
      `, {
        replacements: [paymentReference, now, invoiceId]
      });
    }

    if (requirementId) {
      await sequelize.query(`
        UPDATE requirements 
        SET payment_status = 'pending',
            payment_reference = ?, updated_at = ?
        WHERE id = ?
      `, {
        replacements: [paymentReference, now, requirementId]
      });
    }

    res.json({
      success: true,
      message: 'Payment submitted successfully',
      data: { paymentId, paymentReference, status }
    });

  } catch (error) {
    console.error('Cash payment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== USER ROUTES ====================

// Get my payments
router.get('/my-payments', authenticateExhibitor, async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');

    const [payments] = await sequelize.query(`
      SELECT * FROM payments 
      WHERE exhibitor_id = ?
      ORDER BY created_at DESC
    `, {
      replacements: [req.user.id]
    });

    res.json({ success: true, data: payments });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ADMIN ROUTES ====================

// Pending payments
router.get('/admin/pending', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');

    const [payments] = await sequelize.query(`
      SELECT p.*, e.company as exhibitor_company, e.name as exhibitor_name
      FROM payments p
      JOIN exhibitors e ON p.exhibitor_id = e.id
      WHERE p.status = 'pending_verification'
      ORDER BY p.created_at ASC
    `);

    res.json({ success: true, data: payments });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// All payments
router.get('/admin/all', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');

    const [payments] = await sequelize.query(`
      SELECT p.*, e.company as exhibitor_company, e.name as exhibitor_name
      FROM payments p
      JOIN exhibitors e ON p.exhibitor_id = e.id
      ORDER BY p.created_at DESC
    `);

    res.json({ success: true, data: payments });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify payment
router.put('/admin/:paymentId/verify', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status, adminRemarks } = req.body;

    const sequelize = require('../config/database').getConnection('mysql');
    const now = new Date();

    await sequelize.query(`
      UPDATE payments 
      SET status = ?, admin_remarks = ?, verified_at = ?, updated_at = ?
      WHERE id = ?
    `, {
      replacements: [status, adminRemarks || null, now, now, paymentId]
    });

    const [payments] = await sequelize.query(`SELECT * FROM payments WHERE id = ?`, {
      replacements: [paymentId]
    });

    if (payments.length > 0 && status === 'verified') {
      const payment = payments[0];

      if (payment.invoice_id) {
        await sequelize.query(`
          UPDATE invoices 
          SET status = 'paid', paid_at = ?, updated_at = ?
          WHERE id = ?
        `, {
          replacements: [now, now, payment.invoice_id]
        });
      }

      if (payment.requirement_id) {
        await sequelize.query(`
          UPDATE requirements 
          SET payment_status = 'completed', status = 'approved', updated_at = ?
          WHERE id = ?
        `, {
          replacements: [now, payment.requirement_id]
        });
      }
    }

    res.json({ success: true, message: 'Payment updated successfully' });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stats
router.get('/admin/stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');

    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending_verification' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END) as total_verified_amount
      FROM payments
    `);

    res.json({ success: true, data: stats[0] });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== IMPORTANT: KEEP THIS LAST ====================

// Get single payment
router.get('/:paymentId', authenticateExhibitor, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const sequelize = require('../config/database').getConnection('mysql');

    const [payments] = await sequelize.query(`
      SELECT * FROM payments 
      WHERE id = ? AND exhibitor_id = ?
    `, {
      replacements: [paymentId, req.user.id]
    });

    if (!payments.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    res.json({ success: true, data: payments[0] });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;