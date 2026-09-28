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

function folder() {
  return process.env.CLOUDINARY_FOLDER || 'pixelwalls';
}

function uploadBuffer(buffer, { alt, author, category, mimetype, filename }) {
  init();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder(),
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
      (error, result) => (error ? reject(error) : resolve(result))
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

async function list() {
  init();
  // Cloudinary Search API (enabled on free clouds). Fallback handled by caller.
  const expr = `folder:${folder()} AND resource_type:image`;
  const res = await cloudinary.search
    .expression(expr)
    .with_field('context')
    .with_field('tags')
    .sort_by('created_at', 'desc')
    .max_results(100)
    .execute();
  return (res.resources || []).map(toWallpaper);
}

module.exports = { name: 'cloudinary', isConfigured, uploadBuffer, list, toWallpaper };
