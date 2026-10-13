const express = require('express');
const multer = require('multer');
const service = require('../services/BlogService');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const respond = (operation, status = 200) => async (req, res) => {
  try {
    res.status(status).json({ success: true, data: await operation(req) });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      error: error.status ? error.message : 'Unable to complete the blog request. Please try again.',
    });
    if (!error.status) console.error('Blog request failed:', error.message);
  }
};

// Public queries always enforce publication status, regardless of supplied filters.
router.get('/', respond(req => service.list(req.query)));
router.get('/slug/:slug', respond(req => service.bySlug(req.params.slug)));

router.use(authenticate, authorize(['admin', 'editor']));
router.get('/admin', respond(req => service.list(req.query, true)));
router.get('/admin/:id', respond(req => service.byId(req.params.id)));
router.post('/', respond(req => service.save(req.body), 201));
router.put('/:id', respond(req => service.save(req.body, req.params.id)));
router.delete('/:id', respond(async req => {
  await service.remove(req.params.id);
  return { message: 'Blog deleted.' };
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, done) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      const error = new Error('Upload a JPG, PNG or WebP image.');
      error.status = 400;
      return done(error);
    }
    return done(null, true);
  },
});
router.post('/upload', (req, res, next) => {
  upload.single('image')(req, res, error => {
    if (error) return res.status(400).json({
      success: false,
      error: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be smaller than 5 MB.' : error.message,
    });
    return next();
  });
}, respond(async req => {
  if (!req.file) {
    const error = new Error('Choose an image to upload.');
    error.status = 400;
    throw error;
  }
  const result = await require('../services/CloudinaryService').uploadImage(req.file.buffer, {
    folder: 'diemex/blogs',
    resource_type: 'image',
  });
  return { url: result.url };
}));

module.exports = router;
