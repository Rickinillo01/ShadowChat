// =============================================================================
// media.js — Multimedia management for ShadowChat 2.0
// Upload, compress, and manage media files via Firebase Storage
// =============================================================================



/**
 * Compress an image file using Canvas API.
 * @param {File} file - Image file to compress
 * @param {number} maxWidth - Maximum width in pixels
 * @returns {Promise<Blob>} Compressed JPEG blob
 */
export function compressImage(file, maxWidth = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Generate a small thumbnail as base64 data URL.
 * @param {File} file - Image file
 * @param {number} size - Thumbnail size in pixels
 * @returns {Promise<string>} Base64 data URL
 */
export function generateThumbnail(file, size = 80) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Crop to square from center
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);

      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to generate thumbnail'));
    };

    img.src = url;
  });
}

/**
 * Upload a media file to Firebase Storage with progress tracking.
 * @param {File} file - File to upload
 * @param {string} conversationId - Conversation ID for storage path
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<{url: string, path: string}>}
 */
export async function uploadMedia(file, conversationId, onProgress) {
  let uploadFile = file;

  // Compress images before upload
  if (file.type.startsWith('image/')) {
    try {
      const compressed = await compressImage(file);
      uploadFile = new File([compressed], file.name || 'image.jpg', { type: 'image/jpeg' });
    } catch (e) {
      console.warn('[Media] Compression failed, uploading original:', e);
    }
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // Use 'video/upload' for audio/video, 'image/upload' for images. 'auto/upload' is also safe.
    const resourceType = file.type.startsWith('image/') ? 'image' : 'video'; // Cloudinary treats audio as video resource type
    xhr.open('POST', `https://api.cloudinary.com/v1_1/hnbw3xnz/${resourceType}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        resolve({ url: response.secure_url, path: response.public_id });
      } else {
        reject(new Error('Cloudinary upload failed: ' + xhr.responseText));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('upload_preset', 'shadowchat_preset');
    
    xhr.send(formData);
  });
}

/**
 * Upload a profile photo (compressed to 256x256).
 * @param {File} file - Image file
 * @param {string} userId - User UID
 * @returns {Promise<string>} Download URL
 */
export async function uploadProfilePhoto(file, userId) {
  const compressed = await compressImage(file, 256);
  const uploadFile = new File([compressed], `${userId}.jpg`, { type: 'image/jpeg' });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/hnbw3xnz/image/upload');

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        resolve(response.secure_url);
      } else {
        reject(new Error('Cloudinary upload failed: ' + xhr.responseText));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('upload_preset', 'shadowchat_preset');
    
    xhr.send(formData);
  });
}

/**
 * Delete a file from Firebase Storage.
 * @param {string} path - Storage path
 */
export async function deleteMedia(path) {
  if (!path) return;
  // Cloudinary unsigned presets cannot delete files via client directly.
  // Files will remain until purged via Cloudinary settings if desired.
  console.log('[Media] Skipped Cloudinary deletion for:', path);
  return Promise.resolve();
}

/**
 * Determine media type from file MIME type.
 * @param {File} file
 * @returns {'image'|'video'|'audio'|'unknown'}
 */
export function getMediaType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'unknown';
}

/**
 * Validate a file for upload.
 * @param {File} file
 * @param {'image'|'video'|'audio'} type
 * @returns {{valid: boolean, error: string|null}}
 */
export function validateFile(file, type) {
  const limits = {
    image: { maxSize: 10 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
    video: { maxSize: 50 * 1024 * 1024, types: ['video/mp4', 'video/webm', 'video/quicktime'] },
    audio: { maxSize: 15 * 1024 * 1024, types: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'] }
  };

  const rule = limits[type];
  if (!rule) return { valid: false, error: 'Tipo de archivo no soportado' };

  if (!rule.types.includes(file.type)) {
    return { valid: false, error: `Formato no válido. Usa: ${rule.types.map(t => t.split('/')[1]).join(', ')}` };
  }

  if (file.size > rule.maxSize) {
    return { valid: false, error: `Archivo demasiado grande. Máximo: ${formatFileSize(rule.maxSize)}` };
  }

  return { valid: true, error: null };
}

/**
 * Format bytes to human-readable size.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
