// server.js — PixelWalls multi-provider media backend (Vercel-ready)
// Providers: Cloudinary (recommended) → Google Drive (legacy) → ImageKit → ImgBB → Catbox
// Select via STORAGE_PROVIDER env: "auto" (default) or csv e.g. "cloudinary,imgbb"
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const storage = require('./lib/storage');
const db = require('./lib/db');
const { router: authRouter, authMiddleware } = require('./lib/auth');
const { accessRouter, adminRouter, resolveIdentity } = require('./lib/access');
const adminContentRouter = require('./lib/admin');
const manage = require('./lib/manage');

// Best-effort DB init on boot (auth needs Neon). Don't crash media API if DB is down.
db.initDb().then(
  () => console.log('[db] ready (Neon)'),
  (e) => console.warn('[db] not ready:', e.message)
);

const app = express();

// --- CORS ---
const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = [
  'https://pixelwalls.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  ...extraOrigins,
];
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        // Allow all in dev if explicitly enabled
        if (process.env.ALLOW_ALL_ORIGINS === 'true') return callback(null, true);
        return callback(new Error('CORS blocked for origin ' + origin), false);
      }
      return callback(null, true);
    },
  })
);

app.use(express.json({ limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 15) * 1024 * 1024 },
});
const VALID_CATEGORIES = ['Abstract', 'Pastel', 'Minimalist', 'Interiors', 'Avatars'];

const apiRouter = express.Router();

// Which providers are live? Used by frontend to show badge + choose UX.
apiRouter.get('/config', (req, res) => {
  res.json({
    providers: storage.availableProviders(),
    primary: storage.primaryProvider(),
    maxUploadMB: Number(process.env.MAX_UPLOAD_MB) || 15,
    features: { fileUpload: true, urlImport: true },
    auth: { enabled: db.isConfigured(), requiredForUpload: process.env.REQUIRE_AUTH_UPLOAD === 'true' },
  });
});

apiRouter.get('/health', (req, res) => {
  res.json({
    ok: true,
    primary: storage.primaryProvider(),
    providers: storage.availableProviders(),
    db: db.isConfigured() ? 'configured' : 'missing-DATABASE_URL',
  });
});

async function validateMeta({ alt, author, category }) {
  if (!alt || !author || !category) return 'Missing required fields: alt, author, category.';
  // Category must exist in the admin-managed taxonomy (DB) or the static fallback list.
  try {
    const sql = db.getSql();
    if (sql) {
      const rows = await sql`SELECT name FROM categories WHERE lower(name) = ${String(category).toLowerCase()} LIMIT 1`;
      if (rows.length > 0) return null;
    }
  } catch {}
  if (!VALID_CATEGORIES.map((c) => c.toLowerCase()).includes(String(category).toLowerCase())) {
    return `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')} (or a category created by the admin)`;
  }
  return null;
}

async function bufferFromUrl(imageUrl) {
  const { data, headers } = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    maxContentLength: 30 * 1024 * 1024,
    timeout: 20000,
    headers: { 'User-Agent': 'PixelWalls/2.0' },
  });
  const mimetype = headers['content-type'] || 'image/jpeg';
  if (!String(mimetype).startsWith('image/')) throw new Error('URL did not return an image.');
  return { buffer: Buffer.from(data), mimetype };
}

// POST /api/upload — multipart `image` file OR JSON { imageUrl, alt, author, category }
// Identity: guest / manual / app (offrecord & co).
// - Folder hierarchy: pixelwalls/apps/<client> | manual | guests
// - App uploads are visibility=private (admin-only). Others are public.
// - Quotas: premium bypasses; app free users limited by the admin-set
//   free_uploads_per_day; manual by FREE_UPLOADS_PER_DAY env.
// Gates (env): REQUIRE_AUTH_UPLOAD=true → guests blocked; REQUIRE_PREMIUM_UPLOAD=true → only premium.
apiRouter.post('/upload', resolveIdentity(), upload.single('image'), async (req, res) => {
  try {
    const identity = req.identity || { kind: 'guest', canUpload: true, premium: false };
    if (process.env.REQUIRE_AUTH_UPLOAD === 'true' && identity.kind === 'guest') {
      return res.status(401).json({ error: 'Sign in or open from your app to upload.' });
    }
    if (identity.kind === 'app' && identity.canUpload === false) {
      return res.status(403).json({ error: 'Your app plan does not allow uploads.' });
    }
    if (process.env.REQUIRE_PREMIUM_UPLOAD === 'true' && !identity.premium) {
      return res.status(403).json({ error: 'Uploading is a premium feature.', upgrade_required: true });
    }
    const quota = await manage.checkQuota(identity);
    if (!quota.ok) {
      return res.status(403).json({ error: quota.reason, upgrade_required: true, limit: quota.limit, used: quota.used });
    }
    const { alt, author, category } = req.body;
    const err = await validateMeta({ alt, author, category });
    if (err) return res.status(400).json({ error: err });

    let buffer;
    let mimetype;
    let filename;

    if (req.file) {
      ({ buffer, mimetype } = req.file);
      filename = req.file.originalname;
      if (!mimetype.startsWith('image/')) return res.status(400).json({ error: 'File must be an image.' });
    } else if (req.body.imageUrl) {
      try {
        const fetched = await bufferFromUrl(req.body.imageUrl);
        buffer = fetched.buffer;
        mimetype = fetched.mimetype;
        filename = String(req.body.imageUrl).split('/').pop()?.split('?')[0] || 'imported.jpg';
      } catch (e) {
        return res.status(400).json({ error: 'Could not fetch imageUrl.', details: e.message });
      }
    } else {
      return res.status(400).json({ error: 'No file uploaded. Send multipart `image` or JSON `imageUrl`.' });
    }

    const entry = await storage.upload(buffer, {
      alt, author, category, mimetype, filename,
      folder: manage.folderFor(identity),
    });
    // Registry: owner + visibility (app uploads are private/admin-only)
    let record = null;
    try {
      record = await manage.recordUpload({
        provider: entry.provider,
        providerId: entry.id,
        url: entry.fullUrl || entry.url,
        title: alt,
        category,
        identity,
      });
    } catch (e) {
      console.warn('[upload] registry write failed (upload itself succeeded):', e.message);
    }
    res.status(201).json({ ...entry, visibility: record ? record.visibility : 'public' });
  } catch (error) {
    console.error('Upload error:', error.response ? error.response.data : error);
    res.status(500).json({ error: 'Error uploading file.', details: error.message });
  }
});

apiRouter.get('/wallpapers', resolveIdentity(), async (req, res) => {
  try {
    let wallpapers = await storage.listAll();
    // Privacy policy: takedowns hidden, private (app) uploads admin-only,
    // premium/hidden categories gated. Unregistered legacy items stay public.
    wallpapers = await manage.applyPolicy(wallpapers, {
      identity: req.identity,
      isAdmin: manage.isAdminRequest(req),
    });
    // Picker-friendly filters for external apps (e.g. Anonymous Voices):
    // ?category=Abstract&search=sunset&provider=cloudinary&limit=20
    const { category, search, provider, limit } = req.query;
    if (category && category !== 'All') {
      wallpapers = wallpapers.filter(
        (w) => String(w.category || '').toLowerCase() === String(category).toLowerCase()
      );
    }
    if (provider) {
      wallpapers = wallpapers.filter(
        (w) => String(w.provider || '').toLowerCase() === String(provider).toLowerCase()
      );
    }
    if (search) {
      const q = String(search).toLowerCase();
      wallpapers = wallpapers.filter((w) =>
        `${w.alt || ''} ${w.author || ''} ${w.category || ''}`.toLowerCase().includes(q)
      );
    }
    if (limit) {
      const n = Math.max(1, Math.min(200, parseInt(String(limit), 10) || 0));
      if (n) wallpapers = wallpapers.slice(0, n);
    }
    res.json(wallpapers);
  } catch (error) {
    console.error('List error:', error.response ? error.response.data : error);
    res.status(500).json({ error: 'Error fetching wallpapers.', details: error.message });
  }
});

app.use('/api', apiRouter);
app.use('/api/auth', authRouter);
app.use('/api/access', accessRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin', adminContentRouter);

// GET /api/avatars — the fixed predefined set (6). Visible to everyone, incl. free users.
apiRouter.get('/avatars', async (req, res) => {
  try {
    await db.initDb();
    res.json(await manage.getAvatars());
  } catch (e) {
    res.status(500).json({ error: 'Failed to list avatars.', details: e.message });
  }
});

// GET /api/me/uploads — the caller's OWN uploads only (private per user).
// Manual → own account; app → own (source, external_id); guests → 401.
apiRouter.get('/me/uploads', resolveIdentity({ required: true }), async (req, res) => {
  try {
    const identity = req.identity;
    if (!identity || identity.kind === 'guest' || !identity.user) {
      return res.status(401).json({ error: 'Sign in or open from your app to see your uploads.' });
    }
    await db.initDb();
    const sql = db.getSql();
    const source = identity.kind === 'app' ? identity.source : 'manual';
    const rows = await sql`SELECT id, provider, provider_id AS "providerId", url, title,
      category, visibility, picker_visible AS "pickerVisible", status,
      created_at AS "createdAt"
      FROM uploads WHERE author_source = ${source} AND author_user_id = ${identity.user.id}
      ORDER BY created_at DESC LIMIT 100`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list your uploads.', details: e.message });
  }
});

// GET /api/picker?type=wallpapers|avatars&category=&limit= — curated picker for
// embedding in offrecord & co. Requires an APP token (manual/guest get 403).
// Content is exactly what the admin configured: public + picker-visible items in
// picker-enabled categories; premium categories only for premium tokens.
apiRouter.get('/picker', resolveIdentity({ required: true }), async (req, res) => {
  try {
    const identity = req.identity;
    if (!identity || identity.kind !== 'app') {
      return res.status(403).json({ error: 'The picker is available to integrated apps only.' });
    }
    await db.initDb();
    const { type = 'wallpapers', category, limit } = req.query;
    if (type === 'avatars') {
      return res.json(await manage.getAvatars());
    }
    let wallpapers = await storage.listAll();
    wallpapers = await manage.applyPolicy(wallpapers, { identity, isAdmin: false, forPicker: true });
    if (category && category !== 'All') {
      wallpapers = wallpapers.filter(
        (w) => String(w.category || '').toLowerCase() === String(category).toLowerCase()
      );
    }
    if (limit) {
      const n = Math.max(1, Math.min(200, parseInt(String(limit), 10) || 0));
      if (n) wallpapers = wallpapers.slice(0, n);
    }
    res.json(wallpapers);
  } catch (e) {
    console.error('Picker error:', e);
    res.status(500).json({ error: 'Picker failed.', details: e.message });
  }
});

app.get('/', (req, res) => {
  res.json({ name: 'PixelWalls media API', primary: storage.primaryProvider() });
});

// Local dev: `node server.js` listens; on Vercel the exported app is used.
if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`PixelWalls API listening on :${port} (primary: ${storage.primaryProvider()})`));
}

module.exports = app;
