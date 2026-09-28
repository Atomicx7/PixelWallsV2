// ImageKit.io provider — free 20 GB bandwidth tier, real-time transforms.
// Env: IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT
// Uses ImageKit REST upload: POST https://upload.imagekit.io/api/v1/files/upload
// (Basic auth with private key)
const axios = require('axios');
const store = require('../metadata-store');

function isConfigured() {
  return Boolean(
    process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT
  );
}

async function uploadBuffer(buffer, { alt, author, category, filename, mimetype }) {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = (process.env.IMAGEKIT_URL_ENDPOINT || '').replace(/\/$/, '');
  if (!privateKey || !urlEndpoint) throw new Error('ImageKit is not configured');
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', buffer, {
    filename: filename || `wallpaper-${Date.now()}.jpg`,
    contentType: mimetype || 'image/jpeg',
  });
  form.append('fileName', String(alt || filename || `wallpaper-${Date.now()}`).slice(0, 120));
  form.append('folder', process.env.IMAGEKIT_FOLDER || '/pixelwalls');
  form.append('tags', `pixelwalls,${String(category || 'Abstract').toLowerCase()}`);
  const token = Buffer.from(`${privateKey}:`).toString('base64');
  const { data } = await axios.post('https://upload.imagekit.io/api/v1/files/upload', form, {
    headers: { ...form.getHeaders(), Authorization: `Basic ${token}` },
    maxBodyLength: 50 * 1024 * 1024,
  });
  const entry = {
    id: data.fileId || data.filePath,
    url: data.url,
    alt: alt || data.name || 'Wallpaper',
    author: author || 'Unknown',
    category: category || 'Abstract',
    width: data.width || 1920,
    height: data.height || 1080,
    provider: 'imagekit',
    createdAt: new Date().toISOString(),
  };
  await store.add(entry);
  return entry;
}

async function list() {
  const all = await store.readAll();
  return all.filter((w) => w.provider === 'imagekit');
}

module.exports = { name: 'imagekit', isConfigured, uploadBuffer, list };
