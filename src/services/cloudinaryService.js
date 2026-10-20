import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

export function isCloudinaryConfigured() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function client() {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

export async function uploadDocumentFile(filePath, { userId, filename }) {
  if (!isCloudinaryConfigured()) return null;
  const result = await client().uploader.upload(filePath, {
    resource_type: 'raw',
    folder: `linkedin-ai/${userId}`,
    use_filename: true,
    unique_filename: true,
    filename_override: filename,
  });
  return { fileUrl: result.secure_url, publicId: result.public_id };
}

export async function deleteCloudinaryFile(publicId) {
  if (!isCloudinaryConfigured() || !publicId) return;
  await client().uploader.destroy(publicId, { resource_type: 'raw' });
}
