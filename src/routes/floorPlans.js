const express = require('express');
const router = express.Router();
const floorPlanController = require('../controllers/FloorPlanController');
const { authenticateExhibitor } = require('../middleware/auth');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');

/* ======================
   MULTER CONFIG
====================== */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid image type'));
  }
});

/* ======================
   PUBLIC ROUTES
====================== */
router.get('/test', floorPlanController.testEndpoint);
router.get('/public', floorPlanController.getPublicFloorPlans);
router.get('/public/:id', floorPlanController.getPublicFloorPlanById);
router.get('/shared/:shareToken', floorPlanController.getSharedFloorPlan);

router.get(
  '/master/exhibitor-view',
  authenticateExhibitor,
  floorPlanController.getFloorPlanForExhibitor
);

/* ======================
   AUTHENTICATED ROUTES
====================== */
router.use(authenticate);

/* ======================
   MASTER FLOOR PLAN (IMPORTANT: BEFORE :id)
====================== */
router.get(
  '/master',
  authorize(['admin', 'editor', 'viewer']),
  floorPlanController.getMasterFloorPlan
);

router.post(
  '/master',
  authorize(['admin', 'editor']),
  floorPlanController.createOrUpdateMasterFloorPlan
);

router.put(
  '/master',
  authorize(['admin', 'editor']),
  floorPlanController.createOrUpdateMasterFloorPlan
);

/* ======================
   IMAGE UPLOAD
====================== */
router.post(
  '/upload-image',
  authorize(['admin', 'editor']),
  upload.single('image'),
  floorPlanController.uploadImage
);

/* ======================
   STATS / ANALYTICS
====================== */
router.get(
  '/statistics',
  authorize(['admin', 'editor', 'viewer']),
  floorPlanController.getStatistics
);

router.get(
  '/analytics/booths',
  authorize(['admin', 'editor']),
  floorPlanController.getBoothAnalytics
);

/* ======================
   SEARCH & FILTER
====================== */
router.get(
  '/search/by-name',
  authorize(['admin', 'editor', 'viewer']),
  floorPlanController.searchFloorPlansByName
);

router.get(
  '/search/by-tags',
  authorize(['admin', 'editor', 'viewer']),
  floorPlanController.searchFloorPlansByTags
);

router.get(
  '/filter/by-status',
  authorize(['admin', 'editor', 'viewer']),
  floorPlanController.filterFloorPlansByBoothStatus
);

/* ======================
   CRUD
====================== */
router.get(
  '/',
  authorize(['admin', 'editor', 'viewer']),
  floorPlanController.getAllFloorPlans
);

router.post(
  '/',
  authorize(['admin', 'editor']),
  floorPlanController.createFloorPlan
);

/* ======================
   EXHIBITOR ROUTES
====================== */





router.get(
  '/exhibitor/visible',
  authorize(['exhibitor', 'admin', 'editor', 'viewer']),
  floorPlanController.getExhibitorVisibleFloorPlans
);

router.get(
  '/exhibitor/my-booth',
  authorize(['exhibitor']),
  floorPlanController.getExhibitorBoothDetails
);

router.get(
  '/exhibitor/statistics',
  authorize(['exhibitor']),
  floorPlanController.getExhibitorStatistics
);

router.get(
  '/find-booth/:boothNumber',
  authorize(['admin', 'editor', 'viewer', 'exhibitor']),
  floorPlanController.findBoothByNumber
);

/* ======================
   FLOOR PLAN ID ROUTES (KEEP LAST)
====================== */
router.get(
  '/:id',
  authorize(['admin', 'editor', 'viewer']),
  floorPlanController.getFloorPlan
);

router.put(
  '/:id',
  authorize(['admin', 'editor']),
  floorPlanController.updateFloorPlan
);

router.delete(
  '/:id',
  authorize(['admin']),
  floorPlanController.deleteFloorPlan
);

/* ======================
   BOOTHS
====================== */
router.get(
  '/:floorPlanId/booths',
  authorize(['admin', 'editor', 'viewer']),
  floorPlanController.getBoothsByFloorPlan
);

router.patch(
  '/:floorPlanId/booths/:shapeId/status',
  authorize(['admin', 'editor']),
  floorPlanController.updateBoothStatus
);

router.put(
  '/:floorPlanId/booths/:shapeId',
  authorize(['admin', 'editor']),
  floorPlanController.updateBoothDetails
);

/* ======================
   EXPORT / IMPORT
====================== */
router.get(
  '/:id/export',
  authorize(['admin', 'editor', 'viewer']),
  floorPlanController.exportFloorPlan
);

router.post(
  '/:id/import-shapes',
  authorize(['admin', 'editor']),
  floorPlanController.importShapes
);

/* ======================
   WEBHOOKS
====================== */
router.post('/webhooks/booth-status', floorPlanController.handleBoothStatusWebhook);
router.post('/webhooks/exhibitor-registered', floorPlanController.handleExhibitorRegisteredWebhook);

module.exports = router;
