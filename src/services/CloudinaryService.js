// src/services/CloudinaryService.js
const cloudinary = require('cloudinary').v2;

class CloudinaryService {
  constructor() {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dkdigc9he',
      api_key: process.env.CLOUDINARY_API_KEY || '639325423572894',
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    
    console.log('☁️ Cloudinary configured:', cloudinary.config().cloud_name);
  }

  // Upload image to Cloudinary
  async uploadImage(file, options = {}) {
    try {
      console.log('📤 Uploading image to Cloudinary...');
      
      const uploadOptions = {
        folder: 'exhibition-floor-plans',
        resource_type: 'auto',
        ...options
      };

      // If file is base64 string
      if (typeof file === 'string' && file.startsWith('data:')) {
        const result = await cloudinary.uploader.upload(file, uploadOptions);
        console.log('✅ Image uploaded to Cloudinary:', result.public_id);
        return {
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes
        };
      }
      
      // If file is buffer
      if (Buffer.isBuffer(file)) {
        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          uploadStream.end(file);
        });
        
        console.log('✅ Image uploaded to Cloudinary:', result.public_id);
        return {
          url: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
          bytes: result.bytes
        };
      }
      
      throw new Error('Unsupported file format');
      
    } catch (error) {
      console.error('❌ Cloudinary upload error:', error.message);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  // Upload from URL
  async uploadFromUrl(imageUrl, options = {}) {
    try {
      console.log('📤 Uploading from URL:', imageUrl);
      
      const result = await cloudinary.uploader.upload(imageUrl, {
        folder: 'exhibition-floor-plans',
        resource_type: 'auto',
        ...options
      });
      
      console.log('✅ Image uploaded from URL:', result.public_id);
      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes
      };
    } catch (error) {
      console.error('❌ Cloudinary upload from URL error:', error.message);
      throw new Error(`Failed to upload from URL: ${error.message}`);
    }
  }

  // Delete image from Cloudinary
  async deleteImage(publicId) {
    try {
      console.log('🗑️ Deleting image from Cloudinary:', publicId);
      
      const result = await cloudinary.uploader.destroy(publicId);
      
      if (result.result === 'ok') {
        console.log('✅ Image deleted from Cloudinary');
        return true;
      } else {
        throw new Error(result.result);
      }
    } catch (error) {
      console.error('❌ Cloudinary delete error:', error.message);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  // Generate thumbnail URL
  generateThumbnailUrl(publicId, options = {}) {
    const defaultOptions = {
      width: 300,
      height: 200,
      crop: 'fill',
      quality: 'auto',
      format: 'webp'
    };
    
    return cloudinary.url(publicId, {
      ...defaultOptions,
      ...options
    });
  }

  // Generate optimized image URL
  generateOptimizedUrl(publicId, options = {}) {
    const defaultOptions = {
      quality: 'auto',
      fetch_format: 'auto',
      width: 1200
    };
    
    return cloudinary.url(publicId, {
      ...defaultOptions,
      ...options
    });
  }

  // Test Cloudinary connection
  async testConnection() {
    try {
      // Try to ping Cloudinary
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