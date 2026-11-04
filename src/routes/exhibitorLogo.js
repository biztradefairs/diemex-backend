const router = require('express').Router({ mergeParams: true });
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const modelFactory = require('../models');
const cloudinaryService = require('../services/CloudinaryService');
const types = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, done) {
    if (!types.includes(file.mimetype)) return done(new Error('Choose a PNG, JPG, WEBP or GIF image.'));
    return done(null, true);
  },
}).single('logo');

function matchesImageType(file) {
  const b = file.buffer;
  if (file.mimetype === 'image/png') return b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mimetype === 'image/jpeg') return b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (file.mimetype === 'image/gif') return ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('ascii'));
  return b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP';
}

router.post('/', authenticate, authorize(['admin']), (req, res) => {
  upload(req, res, async (error) => {
    if (error) return res.status(400).json({
      success: false,
      error: error.code === 'LIMIT_FILE_SIZE' ? 'The company logo must be 5 MB or smaller.' : error.message,
    });
    if (!req.file || !req.file.size || !matchesImageType(req.file)) {
      return res.status(400).json({ success: false, error: 'Choose a valid PNG, JPG, WEBP or GIF image.' });
    }
    try {
      const exhibitor = await modelFactory.getModel('Exhibitor').findByPk(req.params.id, { attributes: ['id'] });
      if (!exhibitor) return res.status(404).json({ success: false, error: 'Exhibitor not found.' });
      const result = await cloudinaryService.uploadFile(req.file.buffer, { folder: 'exhibitor-logos', resource_type: 'image' });
      if (!result.url || !result.publicId) throw new Error('Incomplete logo upload response');
      // The edit form saves the URL with the other profile changes.
      return res.status(201).json({ success: true, data: { url: result.url, publicId: result.publicId } });
    } catch (uploadError) {
      console.error('Company logo upload failed:', uploadError.message);
      return res.status(502).json({ success: false, error: 'Unable to upload the company logo. Please try again.' });
    }
  });
});
module.exports = router;
