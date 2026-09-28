// ImgBB provider — free image hosting, no bandwidth cap published, 32 MB per file.
// Env: IMGBB_API_KEY (get free at https://api.imgbb.com/)
// API: POST https://api.imgbb.com/1/upload?key=KEY  (base64 image)
const axios = require('axios');
const store = require('../metadata-store');

function isConfigured() {
  return Boolean(process.env.IMGBB_API_KEY);
}

async function uploadBuffer(buffer, { alt, author, category }) {
  const key = process.env.IMGBB_API_KEY;
  if (!key) throw new Error('IMGBB_API_KEY is not configured');
  const base64 = buffer.toString('base64');
  const params = new URLSearchParams();
  params.append('image', base64);
  params.append('name', String(alt || `wallpaper-${Date.now()}`).slice(0, 100));
  const { data } = await axios.post(`https://api.imgbb.com/1/upload?key=${key}`, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    maxBodyLength: 40 * 1024 * 1024,
  });
  if (!data || !data.data) throw new Error('ImgBB upload failed: empty response');
  const entry = {
    id: data.data.id || String(data.data.delete_url || Date.now()),
    url: data.data.display_url || data.data.url,
    thumbUrl: data.data.thumb?.url,
    deleteUrl: data.data.delete_url,
    alt: alt || data.data.title || 'Wallpaper',
    author: author || 'Unknown',
    category: category || 'Abstract',
    width: Number(data.data.width) || 1920,
    height: Number(data.data.height) || 1080,
    provider: 'imgbb',
    createdAt: new Date().toISOString(),
  };
  await store.add(entry);
  return entry;
}

async function list() {
  return store.readAll().then((all) => all.filter((w) => w.provider === 'imgbb'));
}

module.exports = { name: 'imgbb', isConfigured, uploadBuffer, list };
