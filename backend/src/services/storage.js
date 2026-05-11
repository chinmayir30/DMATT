// MinIO Storage Service - S3-compatible object storage

import * as Minio from 'minio';
import dotenv from 'dotenv';

dotenv.config();

// MinIO client configuration
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'dmat-images';

/**
 * Initialize MinIO - create bucket if it doesn't exist
 * (Non-blocking - MinIO is optional)
 */
export async function initializeStorage() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);

    if (!exists) {
      console.log(`Creating MinIO bucket: ${BUCKET_NAME}`);
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');

      // Set public read policy for images
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
          },
        ],
      };

      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      console.log(`✅ MinIO bucket ${BUCKET_NAME} created successfully`);
    } else {
      console.log(`✅ MinIO bucket ${BUCKET_NAME} already exists`);
    }
  } catch (error) {
    // MinIO is optional - fail silently if not available
    console.warn(`⚠️ MinIO not available (optional): ${error.message}`);
    console.warn('ℹ️ To enable MinIO for file uploads, run: ./setup-minio.sh');
    // Don't throw - let the app continue without MinIO
  }
}

/**
 * Upload file to MinIO
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original filename
 * @param {string} mimeType - File MIME type
 * @returns {Promise<string>} - Public URL of uploaded file
 */
export async function uploadFile(fileBuffer, fileName, mimeType) {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Upload to MinIO
    await minioClient.putObject(BUCKET_NAME, uniqueFileName, fileBuffer, fileBuffer.length, {
      'Content-Type': mimeType,
    });

    // Generate public URL
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || 9000;
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const protocol = useSSL ? 'https' : 'http';
    const portSuffix = (useSSL && port === 443) || (!useSSL && port === 80) ? '' : `:${port}`;

    const publicUrl = `${protocol}://${endpoint}${portSuffix}/${BUCKET_NAME}/${uniqueFileName}`;

    console.log(`File uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading file to MinIO:', error);
    throw new Error(`File upload failed: ${error.message}`);
  }
}

/**
 * Delete file from MinIO
 * @param {string} fileUrl - Public URL of the file
 * @returns {Promise<void>}
 */
export async function deleteFile(fileUrl) {
  try {
    // Extract filename from URL
    const urlParts = fileUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    await minioClient.removeObject(BUCKET_NAME, fileName);
    console.log(`File deleted successfully: ${fileName}`);
  } catch (error) {
    console.error('Error deleting file from MinIO:', error);
    throw new Error(`File deletion failed: ${error.message}`);
  }
}

/**
 * Check if MinIO is accessible
 * @returns {Promise<boolean>}
 */
export async function checkHealth() {
  try {
    await minioClient.listBuckets();
    return true;
  } catch (error) {
    return false;
  }
}
