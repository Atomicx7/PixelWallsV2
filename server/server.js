// server.js — PixelWalls multi-provider media backend (Vercel-ready)
// Providers: Cloudinary (recommended) → Google Drive (legacy) → ImageKit → ImgBB → Catbox
// Select via STORAGE_PROVIDER env: "auto" (default) or csv e.g. "cloudinary,imgbb"
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const storage = require('./lib/storage');

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
const VALID_CATEGORIES = ['Abstract', 'Pastel', 'Minimalist', 'Interiors'];

const apiRouter = express.Router();

// Which providers are live? Used by frontend to show badge + choose UX.
apiRouter.get('/config', (req, res) => {
  res.json({
    providers: storage.availableProviders(),
    primary: storage.primaryProvider(),
    maxUploadMB: Number(process.env.MAX_UPLOAD_MB) || 15,
    features: { fileUpload: true, urlImport: true },
  });
});

apiRouter.get('/health', (req, res) => {
  res.json({ ok: true, primary: storage.primaryProvider(), providers: storage.availableProviders() });
});

function validateMeta({ alt, author, category }) {
  if (!alt || !author || !category) return 'Missing required fields: alt, author, category.';
  if (!VALID_CATEGORIES.includes(category)) return `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`;
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
apiRouter.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { alt, author, category } = req.body;
    const err = validateMeta({ alt, author, category });
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

    const entry = await storage.upload(buffer, { alt, author, category, mimetype, filename });
    res.status(201).json(entry);
  } catch (error) {
    console.error('Upload error:', error.response ? error.response.data : error);
    res.status(500).json({ error: 'Error uploading file.', details: error.message });
  }
});

apiRouter.get('/wallpapers', async (req, res) => {
  try {
    let wallpapers = await storage.listAll();
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

app.get('/', (req, res) => {
  res.json({ name: 'PixelWalls media API', primary: storage.primaryProvider() });
});

// Local dev: `node server.js` listens; on Vercel the exported app is used.
if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`PixelWalls API listening on :${port} (primary: ${storage.primaryProvider()})`));
}

module.exports = app;
