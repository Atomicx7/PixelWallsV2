// Unified storage factory.
// Priority: STORAGE_PROVIDER env (csv, e.g. "cloudinary,imgbb,catbox").
// Default auto: first configured provider in [cloudinary, googledrive, imagekit, imgbb, catbox].
// List merges across providers (Cloudinary/Drive native + JSON store for others).
const store = require('./metadata-store');

const providers = {
  cloudinary: require('./providers/cloudinary'),
  googledrive: require('./providers/googledrive'),
  imagekit: require('./providers/imagekit'),
  imgbb: require('./providers/imgbb'),
  catbox: require('./providers/catbox'),
};

const DEFAULT_ORDER = ['cloudinary', 'googledrive', 'imagekit', 'imgbb', 'catbox'];

function parseOrder() {
  const raw = (process.env.STORAGE_PROVIDER || '').toLowerCase().trim();
  if (!raw || raw === 'auto') return DEFAULT_ORDER;
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  // allow alias "drive" -> googledrive
  return parts.map((p) => (p === 'drive' ? 'googledrive' : p)).filter((p) => providers[p]);
}

function availableProviders() {
  return parseOrder().filter((name) => {
    try {
      return providers[name].isConfigured();
    } catch {
      return false;
    }
  });
}

function primaryProvider() {
  const avail = availableProviders();
  if (avail.length > 0) return avail[0];
  // Catbox needs no keys — always usable as last-resort unless disabled
  try {
    if (providers.catbox.isConfigured()) return 'catbox';
  } catch {}
  return null;
}

async function upload(buffer, meta) {
  const avail = availableProviders();
  if (avail.length === 0) throw new Error('No storage provider configured. Set Cloudinary / ImgBB / ImageKit / Google Drive env vars.');
  let lastError = null;
  for (const name of avail) {
    try {
      const entry = await providers[name].uploadBuffer(buffer, meta);
      return { ...entry, provider: entry.provider || name };
    } catch (err) {
      lastError = err;
      console.warn(`[storage] ${name} upload failed, trying next fallback:`, err.message);
    }
  }
  throw lastError || new Error('All storage providers failed.');
}

async function listAll() {
  const avail = availableProviders();
  const results = await Promise.allSettled(
    avail.map((name) => providers[name].list().then((items) => ({ name, items })))
  );
  let merged = [];
  for (const r of results) {
    if (r.status === 'fulfilled') merged = merged.concat(r.value.items || []);
  }
  // If nothing configured at all, surface local JSON store (seeded samples survive)
  if (merged.length === 0) {
    try {
      merged = await store.readAll();
    } catch {
      merged = [];
    }
  }
  // Newest first when createdAt present; otherwise keep provider order
  merged.sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return tb - ta;
  });
  // Dedupe by provider+id (metadata store can hold repeats)
  const seen = new Set();
  merged = merged.filter((w) => {
    const k = `${w.provider || ''}:${w.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return merged;
}

module.exports = { providers, availableProviders, primaryProvider, upload, listAll };
