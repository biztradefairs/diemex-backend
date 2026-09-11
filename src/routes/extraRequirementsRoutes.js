// src/routes/extraRequirementsRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

console.log('📦 extraRequirementsRoutes loaded (includes /admin/by-exhibitor and /admin/exhibitor/:id)');

// Helper function to extract items from requirement data
const extractRequirementItems = (data) => {
  const items = [];
  
  // Extract furniture items
  if (data.furnitureItems && Array.isArray(data.furnitureItems)) {
    data.furnitureItems.forEach(item => {
      items.push({
        id: item.id || `furniture_${Date.now()}_${Math.random()}`,
        type: 'Furniture',
        quantity: item.quantity || 1,
        description: item.description || `Furniture: ${item.code}`,
        specifications: `Code: ${item.code}, Cost: ₹${item.cost}`,
        unitPrice: item.cost,
        totalPrice: item.cost * (item.quantity || 1)
      });
    });
  }
  
  // Extract AV & IT Rentals
  if (data.rentalItems && Array.isArray(data.rentalItems)) {
    data.rentalItems.forEach(item => {
      items.push({
        id: item.id || `rental_${Date.now()}_${Math.random()}`,
        type: 'AV & IT Rentals',
        quantity: item.quantity || 1,
        description: item.description || `Rental: ${item.type}`,
        specifications: `Type: ${item.type}, Cost: ₹${item.costFor3Days}`,
        unitPrice: item.costFor3Days,
        totalPrice: item.totalCost
      });
    });
  }
  
  // Extract Electrical Load
  if (data.electricalLoad) {
    if (data.electricalLoad.exhibitionLoad && data.electricalLoad.exhibitionLoad !== '') {
      items.push({
        id: `electrical_exhibition_${Date.now()}_${Math.random()}`,
        type: 'Electrical Load',
        quantity: parseInt(data.electricalLoad.exhibitionLoad) || 0,
        description: 'Exhibition Electrical Load',
        specifications: `Load: ${data.electricalLoad.exhibitionLoad} kW, Total: ₹${data.electricalLoad.exhibitionTotal}`,
        unitPrice: data.electricalLoad.exhibitionTotal,
        totalPrice: data.electricalLoad.exhibitionTotal
      });
    }
    if (data.electricalLoad.temporaryLoad && data.electricalLoad.temporaryLoad !== '') {
      items.push({
        id: `electrical_temporary_${Date.now()}_${Math.random()}`,
        type: 'Electrical Load',
        quantity: parseInt(data.electricalLoad.temporaryLoad) || 0,
        description: 'Temporary Electrical Load',
        specifications: `Load: ${data.electricalLoad.temporaryLoad} kW, Total: ₹${data.electricalLoad.temporaryTotal}`,
        unitPrice: data.electricalLoad.temporaryTotal,
        totalPrice: data.electricalLoad.temporaryTotal
      });
    }
  }
  
  // Extract Hostess Requirements
  if (data.hostessRequirements && Array.isArray(data.hostessRequirements)) {
    data.hostessRequirements.forEach((item, index) => {
      items.push({
        id: `hostess_${index}_${Date.now()}_${Math.random()}`,
        type: 'Hostess Services',
        quantity: item.quantity || 1,
        description: `Hostess Category ${item.category}`,
        specifications: `${item.noOfDays} days at ₹${item.ratePerDay}/day`,
        unitPrice: item.ratePerDay,
        totalPrice: item.amount
      });
    });
  }
  
  // Extract Compressed Air
  if (data.compressedAir && data.compressedAir.qty) {
    items.push({
      id: `compressed_air_${Date.now()}_${Math.random()}`,
      type: 'Compressed Air',
      quantity: data.compressedAir.qty || 1,
      description: 'Compressed Air Connection',
      specifications: `CFM: ${data.compressedAir.cfmRange || 'Standard'}, Power: ${data.compressedAir.powerKW} kW`,
      unitPrice: data.compressedAir.costPerConnection,
      totalPrice: data.compressedAir.totalCost
    });
  }
  
  // Extract Water Connection
  if (data.waterConnection && data.waterConnection.connections) {
    items.push({
      id: `water_${Date.now()}_${Math.random()}`,
      type: 'Water Connection',
      quantity: data.waterConnection.connections || 1,
      description: 'Water Connection',
      specifications: `${data.waterConnection.connections} connections at ₹${data.waterConnection.costPerConnection}/each`,
      unitPrice: data.waterConnection.costPerConnection,
      totalPrice: data.waterConnection.totalCost
    });
  }
  
  // Extract Security Guard
  if (data.securityGuard && data.securityGuard.quantity) {
    items.push({
      id: `security_${Date.now()}_${Math.random()}`,
      type: 'Security Guard',
      quantity: data.securityGuard.quantity || 1,
      description: 'Security Guard Service',
      specifications: `${data.securityGuard.noOfDays} days`,
      unitPrice: data.securityGuard.totalCost / data.securityGuard.quantity,
      totalPrice: data.securityGuard.totalCost
    });
  }
  
  // Extract Housekeeping
  if (data.housekeepingStaff && data.housekeepingStaff.quantity) {
    items.push({
      id: `housekeeping_${Date.now()}_${Math.random()}`,
      type: 'Housekeeping',
      quantity: data.housekeepingStaff.quantity || 1,
      description: 'Housekeeping Staff',
      specifications: `${data.housekeepingStaff.noOfDays} days at ₹${data.housekeepingStaff.chargesPerShift}/shift`,
      unitPrice: data.housekeepingStaff.chargesPerShift,
      totalPrice: data.housekeepingStaff.totalCost
    });
  }
  
  // Extract Security Deposit
  if (data.securityDeposit && data.securityDeposit.amountINR > 0) {
    items.push({
      id: `deposit_${Date.now()}_${Math.random()}`,
      type: 'Security Deposit',
      quantity: 1,
      description: 'Security Deposit',
      specifications: `Booth Size: ${data.securityDeposit.boothSq || 'Standard'}`,
      unitPrice: data.securityDeposit.amountINR,
      totalPrice: data.securityDeposit.amountINR
    });
  }
  
  return items;
};

function parseMaybeJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function roundMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

async function loadRelatedFinance(sequelize) {
  let invoices = [];
  let orders = [];
  try {
    const [rows] = await sequelize.query('SELECT * FROM invoices');
    invoices = rows || [];
  } catch (error) {
    console.warn('Could not load invoices for extra requirements:', error.message);
  }
  try {
    const [rows] = await sequelize.query('SELECT * FROM cashfree_orders');
    orders = rows || [];
  } catch (error) {
    console.warn('Could not load cashfree orders for extra requirements:', error.message);
  }
  return { invoices, orders };
}

function findPaymentForRequirement(requirementId, exhibitorId, invoices, orders) {
  const matchingOrder = (orders || []).find(
    (order) => order.requirement_id === requirementId || order.requirementId === requirementId
  );

  let invoice = null;
  if (matchingOrder?.invoice_id) {
    invoice = (invoices || []).find((row) => row.id === matchingOrder.invoice_id);
  }

  if (!invoice) {
    invoice = (invoices || []).find((row) => {
      const metadata = parseMaybeJson(row.metadata);
      return metadata?.requirementsId === requirementId;
    });
  }

  if (!invoice) return null;

  const relatedOrders = (orders || []).filter((order) => order.invoice_id === invoice.id);
  const successfulOrder = relatedOrders.find((order) => {
    const status = String(order.order_status || '').toUpperCase();
    return status === 'PAID' || status === 'SUCCESS' || status === 'COMPLETED';
  });
  const invoiceStatus = String(invoice.status || '').toLowerCase();
  const metadata = parseMaybeJson(invoice.metadata);
  const isPaid = invoiceStatus === 'paid' || Boolean(successfulOrder);

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    amount: roundMoney(invoice.amount || successfulOrder?.amount || matchingOrder?.amount || 0),
    status: isPaid ? 'paid' : invoiceStatus || 'pending',
    paymentMethod:
      successfulOrder || matchingOrder
        ? 'Online (Cashfree)'
        : metadata?.paymentInfo?.paymentMode || 'Invoice',
    paymentId: successfulOrder?.payment_id || relatedOrders[0]?.payment_id || null,
    orderId: successfulOrder?.order_id || relatedOrders[0]?.order_id || matchingOrder?.order_id || null,
    paidAt: invoice.paidDate || invoice.paid_at || null,
    dueDate: invoice.dueDate,
    issueDate: invoice.issueDate,
  };
}

async function getExhibitorRow(sequelize, exhibitorId) {
  if (!exhibitorId) return {};
  try {
    const [rows] = await sequelize.query(`SELECT * FROM exhibitors WHERE id = ? LIMIT 1`, {
      replacements: [exhibitorId],
    });
    return rows?.[0] || {};
  } catch {
    return {};
  }
}

function formatRequirementRecord(reqRecord, exhibitor, finance) {
  const parsedData = parseMaybeJson(reqRecord.data);
  const generalInfo = parsedData.generalInfo || {};
  const boothDetails = parsedData.boothDetails || {};
  const items = extractRequirementItems(parsedData);
  const totals = parsedData.totals || {};
  const itemsTotal = roundMoney(items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0));
  const payment = findPaymentForRequirement(
    reqRecord.id,
    reqRecord.exhibitorId,
    finance.invoices,
    finance.orders
  );

  return {
    id: reqRecord.id,
    requirementId: reqRecord.id,
    exhibitorId: reqRecord.exhibitorId,
    stallNumber: boothDetails.boothNo || exhibitor.booth || exhibitor.boothNumber || exhibitor.stallNumber,
    companyName: generalInfo.companyName || exhibitor.company || exhibitor.name || 'Unknown',
    contactPerson:
      boothDetails.contactPerson ||
      `${generalInfo.firstName || ''} ${generalInfo.lastName || ''}`.trim() ||
      exhibitor.name ||
      'Unknown',
    email: generalInfo.email || exhibitor.email || 'unknown@email.com',
    phone: generalInfo.mobile || exhibitor.phone || 'N/A',
    status: reqRecord.status,
    submittedAt: reqRecord.createdAt || reqRecord.created_at,
    updatedAt: reqRecord.updatedAt || reqRecord.updated_at,
    items,
    totals: {
      servicesTotal: roundMoney(totals.servicesTotal || itemsTotal),
      gst: roundMoney(totals.gst || 0),
      deposit: roundMoney(totals.deposit || 0),
      total: roundMoney(totals.total || payment?.amount || itemsTotal),
    },
    payment,
  };
}

// =============================================
// ADMIN ROUTES
// =============================================

// Get all extra requirements (admin)
router.get('/admin/all', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    if (!sequelize) {
      throw new Error('Database connection not available');
    }
    
    // Build WHERE clause for requirements
    let whereClause = "WHERE type = 'exhibitor'";
    const replacements = [];
    
    // Add status filter
    if (status && status !== 'all') {
      whereClause += ' AND status = ?';
      replacements.push(status);
    }
    
    // Add search filter
    if (search) {
      whereClause += ' AND (data LIKE ? OR id LIKE ?)';
      replacements.push(`%${search}%`, `%${search}%`);
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get all requirements
    const [requirements] = await sequelize.query(`
      SELECT * FROM requirements 
      ${whereClause}
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `, {
      replacements: [...replacements, parseInt(limit), offset]
    });
    
    // Get total count
    const [totalResult] = await sequelize.query(`
      SELECT COUNT(*) as total FROM requirements ${whereClause}
    `, {
      replacements
    });
    
    const total = totalResult[0]?.total || 0;
    
    // Parse and group requirements by exhibitor
    const groupedRequirements = {};
    
    for (const req of requirements) {
      let parsedData = {};
      if (req.data) {
        try {
          parsedData = typeof req.data === 'string' ? JSON.parse(req.data) : req.data;
        } catch (e) {
          console.error('Error parsing requirement data:', e);
          parsedData = {};
        }
      }
      
      const exhibitorId = req.exhibitorId;
      const generalInfo = parsedData.generalInfo || {};
      const boothDetails = parsedData.boothDetails || {};
      
      if (!groupedRequirements[exhibitorId]) {
        // Get exhibitor details
        let exhibitor = {};
        try {
          const [exhibitors] = await sequelize.query(`
            SELECT id, name, companyName, email, phone, stallNumber, contactPerson 
            FROM exhibitors 
            WHERE id = ?
          `, {
            replacements: [exhibitorId]
          });
          exhibitor = exhibitors[0] || {};
        } catch (err) {
          console.error('Error fetching exhibitor:', err);
        }
        
        groupedRequirements[exhibitorId] = {
          id: req.id,
          requirementId: req.id,
          exhibitorId: exhibitorId,
          stallNumber: boothDetails.boothNo || exhibitor.stallNumber,
          companyName: generalInfo.companyName || exhibitor.companyName || exhibitor.name || 'Unknown',
          contactPerson: boothDetails.contactPerson || generalInfo.firstName || exhibitor.contactPerson || 'Unknown',
          email: generalInfo.email || exhibitor.email || 'unknown@email.com',
          phone: generalInfo.mobile || exhibitor.phone || 'N/A',
          status: req.status,
          submittedAt: req.createdAt,
          updatedAt: req.updatedAt,
          notes: '',
          items: [],
          metadata: {
            boothArea: boothDetails.sqMtrBooked,
            boothLocation: boothDetails.boothNo,
            eventName: parsedData.eventName || 'DiemEx 2024',
            eventDate: parsedData.eventDate,
            address: parsedData.companyDetails?.address
          }
        };
      }
      
      // Extract items from the parsed data
      const items = extractRequirementItems(parsedData);
      groupedRequirements[exhibitorId].items.push(...items);
    }
    
    const formattedRequirements = Object.values(groupedRequirements);
    
    res.json({
      success: true,
      data: formattedRequirements,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Error fetching extra requirements:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.get('/admin/by-exhibitor', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');
    if (!sequelize) throw new Error('Database connection not available');

    const [requirements] = await sequelize.query(`
      SELECT * FROM requirements
      WHERE type = 'exhibitor'
      ORDER BY createdAt DESC
    `);

    const finance = await loadRelatedFinance(sequelize);
    const grouped = {};
    const exhibitorCache = {};

    for (const reqRecord of requirements || []) {
      if (reqRecord.exhibitorId && !exhibitorCache[reqRecord.exhibitorId]) {
        exhibitorCache[reqRecord.exhibitorId] = await getExhibitorRow(sequelize, reqRecord.exhibitorId);
      }
      const exhibitor = exhibitorCache[reqRecord.exhibitorId] || {};
      const formatted = formatRequirementRecord(reqRecord, exhibitor, finance);
      const key = reqRecord.exhibitorId || formatted.email;

      if (!grouped[key]) {
        grouped[key] = {
          exhibitorId: reqRecord.exhibitorId,
          companyName: formatted.companyName,
          contactPerson: formatted.contactPerson,
          email: formatted.email,
          phone: formatted.phone,
          stallNumber: formatted.stallNumber,
          requestCount: 0,
          paidCount: 0,
          pendingCount: 0,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          latestSubmittedAt: formatted.submittedAt,
        };
      }

      const amount = formatted.payment?.amount || formatted.totals.total || 0;
      const isPaid = formatted.payment?.status === 'paid';
      grouped[key].requestCount += 1;
      grouped[key].totalAmount = roundMoney(grouped[key].totalAmount + amount);
      if (isPaid) {
        grouped[key].paidCount += 1;
        grouped[key].paidAmount = roundMoney(grouped[key].paidAmount + amount);
      } else {
        grouped[key].pendingCount += 1;
        grouped[key].pendingAmount = roundMoney(grouped[key].pendingAmount + amount);
      }
    }

    res.json({
      success: true,
      data: Object.values(grouped),
    });
  } catch (error) {
    console.error('Error fetching exhibitor extra requirements summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/exhibitor/:exhibitorId', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { exhibitorId } = req.params;
    const sequelize = require('../config/database').getConnection('mysql');
    if (!sequelize) throw new Error('Database connection not available');

    const exhibitor = await getExhibitorRow(sequelize, exhibitorId);
    const finance = await loadRelatedFinance(sequelize);

    const [requirements] = await sequelize.query(`
      SELECT * FROM requirements
      WHERE type = 'exhibitor' AND exhibitorId = ?
      ORDER BY createdAt DESC
    `, {
      replacements: [exhibitorId],
    });

    const requests = (requirements || []).map((reqRecord) =>
      formatRequirementRecord(reqRecord, exhibitor, finance)
    );

    const summary = requests.reduce(
      (acc, request) => {
        const amount = request.payment?.amount || request.totals.total || 0;
        acc.requestCount += 1;
        acc.itemCount += (request.items || []).length;
        acc.totalAmount = roundMoney(acc.totalAmount + amount);
        if (request.payment?.status === 'paid') {
          acc.paidCount += 1;
          acc.paidAmount = roundMoney(acc.paidAmount + amount);
        } else {
          acc.pendingCount += 1;
          acc.pendingAmount = roundMoney(acc.pendingAmount + amount);
        }
        return acc;
      },
      {
        requestCount: 0,
        itemCount: 0,
        paidCount: 0,
        pendingCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
      }
    );

    res.json({
      success: true,
      data: {
        exhibitor: {
          id: exhibitor.id || exhibitorId,
          name: exhibitor.name || requests[0]?.contactPerson || '',
          company: exhibitor.company || requests[0]?.companyName || '',
          email: exhibitor.email || requests[0]?.email || '',
          phone: exhibitor.phone || requests[0]?.phone || '',
          booth: exhibitor.booth || exhibitor.boothNumber || requests[0]?.stallNumber || '',
        },
        summary,
        requests,
      },
    });
  } catch (error) {
    console.error('Error fetching exhibitor extra requirements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single requirement by ID (admin)
router.get('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    if (!sequelize) {
      throw new Error('Database connection not available');
    }
    
    // Get requirement by ID
    const [requirements] = await sequelize.query(`
      SELECT * FROM requirements 
      WHERE id = ?
    `, {
      replacements: [id]
    });
    
    if (!requirements || requirements.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found'
      });
    }
    
    const reqRecord = requirements[0];
    let parsedData = {};
    
    if (reqRecord.data) {
      try {
        parsedData = typeof reqRecord.data === 'string' ? JSON.parse(reqRecord.data) : reqRecord.data;
      } catch (e) {
        console.error('Error parsing requirement data:', e);
        parsedData = {};
      }
    }
    
    // Get exhibitor details
    const exhibitorId = reqRecord.exhibitorId;
    let exhibitor = {};
    try {
      const [exhibitors] = await sequelize.query(`
        SELECT id, name, companyName, email, phone, stallNumber, contactPerson 
        FROM exhibitors 
        WHERE id = ?
      `, {
        replacements: [exhibitorId]
      });
      exhibitor = exhibitors[0] || {};
    } catch (err) {
      console.error('Error fetching exhibitor:', err);
    }
    
    const generalInfo = parsedData.generalInfo || {};
    const boothDetails = parsedData.boothDetails || {};
    const items = extractRequirementItems(parsedData);
    
    const requirement = {
      id: reqRecord.id,
      requirementId: reqRecord.id,
      exhibitorId: exhibitorId,
      stallNumber: boothDetails.boothNo || exhibitor.stallNumber,
      companyName: generalInfo.companyName || exhibitor.companyName || exhibitor.name || 'Unknown',
      contactPerson: boothDetails.contactPerson || generalInfo.firstName || exhibitor.contactPerson || 'Unknown',
      email: generalInfo.email || exhibitor.email || 'unknown@email.com',
      phone: generalInfo.mobile || exhibitor.phone || 'N/A',
      status: reqRecord.status,
      submittedAt: reqRecord.createdAt,
      updatedAt: reqRecord.updatedAt,
      notes: parsedData.notes || '',
      adminNotes: parsedData.adminNotes || '',
      items: items,
      metadata: {
        boothArea: boothDetails.sqMtrBooked,
        boothLocation: boothDetails.boothNo,
        eventName: parsedData.eventName || 'DiemEx 2024',
        eventDate: parsedData.eventDate,
        address: parsedData.companyDetails?.address,
        city: parsedData.companyDetails?.city,
        state: parsedData.companyDetails?.state,
        pincode: parsedData.companyDetails?.pincode
      }
    };
    
    res.json({
      success: true,
      data: requirement
    });
    
  } catch (error) {
    console.error('Error fetching requirement details:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update requirement status (admin)
router.put('/admin/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    
    const sequelize = require('../config/database').getConnection('mysql');
    
    if (!sequelize) {
      throw new Error('Database connection not available');
    }
    
    // Get existing requirement
    const [existing] = await sequelize.query(`
      SELECT * FROM requirements WHERE id = ?
    `, {
      replacements: [id]
    });
    
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found'
      });
    }
    
    const reqRecord = existing[0];
    let parsedData = {};
    if (reqRecord.data) {
      try {
        parsedData = typeof reqRecord.data === 'string' ? JSON.parse(reqRecord.data) : reqRecord.data;
      } catch (e) {
        parsedData = {};
      }
    }
    
    // Update admin notes in the data field
    parsedData.adminNotes = adminNotes;
    parsedData.updatedBy = req.user?.id;
    parsedData.updatedAt = new Date().toISOString();
    
    // Update requirement
    await sequelize.query(`
      UPDATE requirements 
      SET status = ?, data = ?, updatedAt = NOW()
      WHERE id = ?
    `, {
      replacements: [status, JSON.stringify(parsedData), id]
    });
    
    // Get updated requirement
    const [updated] = await sequelize.query(`
      SELECT * FROM requirements WHERE id = ?
    `, {
      replacements: [id]
    });
    
    const updatedReq = updated[0];
    let updatedData = {};
    if (updatedReq.data) {
      try {
        updatedData = typeof updatedReq.data === 'string' ? JSON.parse(updatedReq.data) : updatedReq.data;
      } catch (e) {
        updatedData = {};
      }
    }
    
    // Get exhibitor details
    const exhibitorId = updatedReq.exhibitorId;
    let exhibitor = {};
    try {
      const [exhibitors] = await sequelize.query(`
        SELECT id, name, companyName, email, phone, stallNumber, contactPerson 
        FROM exhibitors 
        WHERE id = ?
      `, {
        replacements: [exhibitorId]
      });
      exhibitor = exhibitors[0] || {};
    } catch (err) {
      console.error('Error fetching exhibitor:', err);
    }
    
    const generalInfo = updatedData.generalInfo || {};
    const boothDetails = updatedData.boothDetails || {};
    const items = extractRequirementItems(updatedData);
    
    const requirement = {
      id: updatedReq.id,
      requirementId: updatedReq.id,
      exhibitorId: exhibitorId,
      stallNumber: boothDetails.boothNo || exhibitor.stallNumber,
      companyName: generalInfo.companyName || exhibitor.companyName || exhibitor.name || 'Unknown',
      contactPerson: boothDetails.contactPerson || generalInfo.firstName || exhibitor.contactPerson || 'Unknown',
      email: generalInfo.email || exhibitor.email || 'unknown@email.com',
      phone: generalInfo.mobile || exhibitor.phone || 'N/A',
      status: status,
      submittedAt: updatedReq.createdAt,
      updatedAt: new Date().toISOString(),
      notes: updatedData.notes || '',
      adminNotes: adminNotes,
      items: items,
      metadata: {
        boothArea: boothDetails.sqMtrBooked,
        boothLocation: boothDetails.boothNo,
        eventName: updatedData.eventName || 'DiemEx 2024',
        eventDate: updatedData.eventDate
      }
    };
    
    res.json({
      success: true,
      data: requirement,
      message: 'Requirement updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating requirement:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get requirement stats (admin)
router.get('/admin/stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const sequelize = require('../config/database').getConnection('mysql');
    
    if (!sequelize) {
      throw new Error('Database connection not available');
    }
    
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        COUNT(DISTINCT exhibitorId) as uniqueExhibitors
      FROM requirements
      WHERE type = 'exhibitor'
    `);
    
    res.json({
      success: true,
      data: stats[0] || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        completed: 0,
        uniqueExhibitors: 0
      }
    });
    
  } catch (error) {
    console.error('Error fetching requirement stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;