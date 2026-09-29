// Cloudinary provider — recommended free primary.
// Free tier (as of 2026): ~25 GB storage + 25 GB bandwidth, fetch + resize via URL.
// Env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// Optional: CLOUDINARY_FOLDER (default "pixelwalls")
const cloudinary = require('cloudinary').v2;

let configured = false;

function init() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return configured;
}

function isConfigured() {
  if (!configured) init();
  return configured;
}

function baseFolder() {
  return process.env.CLOUDINARY_FOLDER || 'pixelwalls';
}

function uploadBuffer(buffer, { alt, author, category, mimetype, filename, folder }) {
  init();
  // Per-origin hierarchy: pixelwalls/apps/<client> | manual | guests | avatars.
  // Sanitized to safe path segments.
  const target = String(folder || baseFolder())
    .split('/')
    .map((s) => s.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64))
    .filter(Boolean)
    .join('/') || baseFolder();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: target,
        resource_type: 'image',
        // Keep original filename-ish public id readable
        public_id: undefined,
        // Persist wallpaper metadata where Cloudinary search/listing can read it
        context: {
          alt: String(alt || filename || 'Wallpaper').slice(0, 255),
          author: String(author || 'Unknown').slice(0, 120),
          category: String(category || 'Abstract').slice(0, 60),
        },
        tags: ['pixelwalls', String(category || 'Abstract').toLowerCase()],
      },
      (error, result) => {
        if (error) return reject(error);
        // Normalize to the Wallpaper shape (and never leak api_key/secret).
        try {
          resolve(toWallpaper(result));
        } catch (e) {
          reject(e);
        }
      }
    );
    stream.end(buffer);
  });
}

function toWallpaper(r) {
  const ctx = r.context && r.context.custom ? r.context.custom : {};
  // Optimized delivery URL: auto format/quality + limit width for gallery
  const url =
    cloudinary.url(r.public_id, {
      resource_type: 'image',
      type: r.type || 'upload',
      secure: true,
      transformation: [{ fetch_format: 'auto', quality: 'auto', width: 2048, crop: 'limit' }],
    }) || r.secure_url;
  return {
    id: r.public_id,
    url,
    // Keep raw too for downloads
    fullUrl: r.secure_url,
    alt: ctx.alt || r.public_id,
    author: ctx.author || 'Unknown',
    category: ctx.category || 'Abstract',
    width: r.width || 1920,
    height: r.height || 1080,
    provider: 'cloudinary',
  };
}

/** Extract a Cloudinary public_id from a delivery URL, or null. Handles plain,
 * versioned (v123/…), and single-transformation URLs (w_256,…/…) — the stored
 * avatar URLs now carry the 256px transformation segment. */
function publicIdFromUrl(url) {
  try {
    const m = String(url).match(/\/image\/upload\/(?:[a-zA-Z]+_[^/]*\/)?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Delete one Cloudinary asset by URL. SAFETY: only user-owned avatar paths
 * (…/avatars/apps/… or …/avatars/manual/…) are ever deleted — shared
 * predefined avatars, gallery images, and non-Cloudinary URLs are refused.
 * Returns true if an asset was deleted.
 */
async function destroyUserAvatar(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.includes('res.cloudinary.com')) return false;
  if (!url.includes('/avatars/apps/') && !url.includes('/avatars/manual/')) return false;
  const publicId = publicIdFromUrl(url);
  if (!publicId) return false;
  init();
  try {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    return res && res.result === 'ok';
  } catch (e) {
    console.warn('[cloudinary] avatar destroy failed:', e.message);
    return false;
  }
}

async function list() {  init();
  // Cloudinary Search API (enabled on free clouds). `base/*` covers per-origin
  // subfolders (apps/<client>, manual, guests). Fallback handled by caller.
  // `base OR base/*` covers legacy assets in the root folder plus per-origin subfolders.
  const expr = `(folder:${baseFolder()} OR folder:${baseFolder()}/*) AND resource_type:image`;
  const res = await cloudinary.search
    .expression(expr)
    .with_field('context')
    .with_field('tags')
    .sort_by('created_at', 'desc')
    .max_results(100)
    .execute();
  return (res.resources || []).map(toWallpaper);
}

/**
 * Small pre-transformed delivery URL for profile avatars: 256px square crop,
 * auto format/quality (WebP/AVIF where supported). Feed cards load this
 * instead of the multi-MB original — same bytes swapped server-side, no app
 * update needed to change the recipe.
 */
function avatarUrl(publicId) {
  if (!publicId) return null;
  init();
  try {
    return (
      cloudinary.url(publicId, {
        resource_type: 'image',
        secure: true,
        transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'auto', fetch_format: 'auto', quality: 'auto' }],
      }) || null
    );
  } catch {
    return null;
  }
}

module.exports = { name: 'cloudinary', isConfigured, uploadBuffer, list, toWallpaper, baseFolder, destroyUserAvatar, avatarUrl };
