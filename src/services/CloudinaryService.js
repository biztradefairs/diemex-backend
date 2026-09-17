const cloudinary = require('cloudinary').v2;

class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    console.log('☁️ Cloudinary configured');
  }

  // ================================
  // Upload File (Image / PDF / Any)
  // ================================
  async uploadFile(fileBuffer, options = {}) {
    try {
      const uploadOptions = {
        folder: 'exhibition-files',
        resource_type: options.resource_type || 'image',
        type: 'upload',
        access_mode: 'public',
        ...options
      };

      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(fileBuffer);
      });

      console.log('✅ Uploaded to Cloudinary:', result.public_id);

      return {
        url: result.secure_url,
        secure_url: result.secure_url,
        publicId: result.public_id,
        public_id: result.public_id,
        format: result.format,
        bytes: result.bytes
      };

    } catch (error) {
      console.error('❌ Cloudinary upload error:', error.message);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async uploadImage(fileBuffer, options = {}) {
    return this.uploadFile(fileBuffer, options);
  }

  // ================================
  // Delete File
  // ================================
 async deleteFile(publicId, resourceType = 'image') {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });

    if (result.result !== 'ok') {
      throw new Error(result.result);
    }

    console.log('🗑️ Deleted from Cloudinary:', publicId);
    return true;

  } catch (error) {
    console.error('❌ Cloudinary delete error:', error.message);
    throw new Error(`Delete failed: ${error.message}`);
  }
}

  async deleteImage(publicId) {
    try {
      return await this.deleteFile(publicId, 'raw');
    } catch (error) {
      return this.deleteFile(publicId, 'image');
    }
  }

  // ================================
  // Test Connection
  // ================================
  async testConnection() {
    try {
      await cloudinary.api.ping();
      console.log('✅ Cloudinary connection successful');
      return true;
    } catch (error) {
      console.error('❌ Cloudinary connection failed:', error.message);
      return false;
    }
  }
}

module.exports = new CloudinaryService();