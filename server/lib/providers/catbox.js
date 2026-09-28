// Catbox.moe provider — 100% free, no API key, permanent files (200 MB limit).
// API: POST https://catbox.moe/user/api.php  reqtype=fileupload fileToUpload=@file
// Docs: https://catbox.moe/faq.php
const axios = require('axios');
const FormData = require('form-data');
const store = require('../metadata-store');

const ENDPOINT = process.env.CATBOX_ENDPOINT || 'https://catbox.moe/user/api.php';

function isConfigured() {
  // Enabled by default unless explicitly disabled: CATBOX_ENABLED=false
  if (process.env.CATBOX_ENABLED === 'false') return false;
  return true;
}

async function uploadBuffer(buffer, { alt, author, category, filename, mimetype }) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', buffer, {
    filename: filename || `wallpaper-${Date.now()}.jpg`,
    contentType: mimetype || 'image/jpeg',
  });
  const { data } = await axios.post(ENDPOINT, form, {
    headers: form.getHeaders(),
    maxBodyLength: 200 * 1024 * 1024,
  });
  const url = String(data || '').trim();
  if (!url.startsWith('http')) throw new Error(`Catbox upload failed: ${url}`);
  const entry = {
    id: url.split('/').pop() || String(Date.now()),
    url,
    alt: alt || filename || 'Wallpaper',
    author: author || 'Unknown',
    category: category || 'Abstract',
    width: 1920,
    height: 1080,
    provider: 'catbox',
    createdAt: new Date().toISOString(),
  };
  await store.add(entry);
  return entry;
}

async function list() {
  const all = await store.readAll();
  return all.filter((w) => w.provider === 'catbox');
}

module.exports = { name: 'catbox', isConfigured, uploadBuffer, list };
