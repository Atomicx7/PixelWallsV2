// Simple file-based metadata store for providers without a native listing API
// (ImgBB, Catbox, ImageKit-basic). On serverless (Vercel) the filesystem is
// ephemeral, so this is best-effort local persistence. Use Cloudinary or
// Google Drive as primary for persistent listings in production.
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = process.env.WALLPAPERS_DATA_DIR
  ? path.resolve(process.env.WALLPAPERS_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DATA_FILE = process.env.WALLPAPERS_JSON_PATH
  ? path.resolve(process.env.WALLPAPERS_JSON_PATH)
  : path.join(DATA_DIR, 'wallpapers.json');

async function ensureFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readAll() {
  try {
    await ensureFile();
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function add(entry) {
  const all = await readAll();
  all.unshift(entry);
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(all, null, 2), 'utf8');
  } catch (err) {
    // Ephemeral FS (Vercel) may fail — log and continue, upload URL is still valid.
    console.warn('[metadata-store] could not persist entry:', err.message);
  }
  return entry;
}

async function seedIfEmpty(seed = []) {
  const all = await readAll();
  if (all.length === 0 && seed.length > 0) {
    try {
      await fs.writeFile(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
    } catch {}
    return seed;
  }
  return all;
}

module.exports = { readAll, add, seedIfEmpty, DATA_FILE };
