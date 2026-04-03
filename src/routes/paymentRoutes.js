// src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateExhibitor, authenticateAdmin } = require('../middleware/auth');

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
    
    // Generate payment reference
    const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const paymentId = require('crypto').randomUUID();
    const now = new Date();

    // Insert payment record
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
        amount, amountPaid || amount, paymentMode, paymentDate || now.toISOString().split('T')[0],
        chequeNumber || null, chequeDate || null, bankName || null,
        ddNumber || null, ddDate || null,
        remarks || null, status, now, now
      ]
    });

    // Update invoice status to pending_verification
    if (invoiceId) {
      await sequelize.query(`
        UPDATE invoices 
        SET status = 'pending_verification', 
            payment_reference = ?,
            updated_at = ?
        WHERE id = ?
      `, {
        replacements: [paymentReference, now, invoiceId]
      });
    }

    // Update requirement status
    if (requirementId) {
      await sequelize.query(`
        UPDATE requirements 
        SET payment_status = 'pending',
            payment_reference = ?,
            updated_at = ?
        WHERE id = ?
      `, {
        replacements: [paymentReference, now, requirementId]
      });
    }

    res.json({
      success: true,
      message: 'Payment details submitted successfully',
      data: {
        paymentId,
        paymentReference,
        status
      }
    });

  } catch (error) {
    console.error('Cash payment submission error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get payment details for exhibitor
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

    res.json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single payment details
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

    if (!payments || payments.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      data: payments[0]
    });

  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all pending payments (admin)
router.get('/admin/pending', authenticateAdmin, async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [payments] = await sequelize.query(`
      SELECT p.*, e.company as exhibitor_company, e.name as exhibitor_name
      FROM payments p
      JOIN exhibitors e ON p.exhibitor_id = e.id
      WHERE p.status = 'pending_verification'
      ORDER BY p.created_at ASC
    `);

    res.json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all payments (admin)
router.get('/admin/all', authenticateAdmin, async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');
    
    const [payments] = await sequelize.query(`
      SELECT p.*, e.company as exhibitor_company, e.name as exhibitor_name
      FROM payments p
      JOIN exhibitors e ON p.exhibitor_id = e.id
      ORDER BY p.created_at DESC
    `);

    res.json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Verify payment (admin)
router.put('/admin/:paymentId/verify', authenticateAdmin, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status, adminRemarks } = req.body;
    
    const sequelize = require('../config/database').getConnection('mysql');
    const now = new Date();

    // Update payment status
    await sequelize.query(`
      UPDATE payments 
      SET status = ?, 
          admin_remarks = ?,
          verified_at = ?,
          updated_at = ?
      WHERE id = ?
    `, {
      replacements: [status, adminRemarks || null, now, now, paymentId]
    });

    // Get payment details to update related records
    const [payments] = await sequelize.query(`
      SELECT * FROM payments WHERE id = ?
    `, {
      replacements: [paymentId]
    });

    if (payments.length > 0) {
      const payment = payments[0];
      
      if (status === 'verified') {
        // Update invoice status
        if (payment.invoice_id) {
          await sequelize.query(`
            UPDATE invoices 
            SET status = 'paid', 
                paid_at = ?,
                updated_at = ?
            WHERE id = ?
          `, {
            replacements: [now, now, payment.invoice_id]
          });
        }

        // Update requirement status
        if (payment.requirement_id) {
          await sequelize.query(`
            UPDATE requirements 
            SET payment_status = 'completed',
                status = 'approved',
                updated_at = ?
            WHERE id = ?
          `, {
            replacements: [now, payment.requirement_id]
          });
        }
      }
    }

    res.json({
      success: true,
      message: `Payment ${status === 'verified' ? 'verified' : 'rejected'} successfully`
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get payment statistics (admin)
router.get('/admin/stats', authenticateAdmin, async (req, res) => {
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

    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;