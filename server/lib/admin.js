// lib/admin.js — Content administration for the offrecord admin panel.
// Guarded by x-admin-secret (ADMIN_SECRET). Admin sees EVERYTHING, including
// private app uploads that are hidden from the public gallery and picker.
//
// Uploads:   GET  /api/admin/uploads?source=&status=&visibility=&limit=
//            POST /api/admin/uploads/:id/takedown | /restore
//            PATCH /api/admin/uploads/:id { category, pickerVisible }
// Categories: GET /api/admin/categories
//            POST /api/admin/categories { name, visibility, showInPicker }
//            PATCH /api/admin/categories/:name { visibility, showInPicker }
// Avatars:   GET /api/admin/avatars (incl. inactive)
//            POST /api/admin/avatars { url, sortOrder }
//            PATCH /api/admin/avatars/:id { url, sortOrder, isActive }
const express = require('express');
const db = require('./db');

const router = express.Router();

function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET || '';
  if (!secret) {
    return res.status(500).json({ error: 'ADMIN_SECRET not configured.' });
  }
  if (req.headers['x-admin-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden: bad admin secret.' });
  }
  next();
}

router.use(requireAdmin);

function needDb(req, res) {
  if (!db.isConfigured()) {
    res.status(503).json({ error: 'DATABASE_URL not configured.' });
    return false;
  }
  return true;
}

// --- Analytics -------------------------------------------------------------
// Per-application breakdown + totals for the admin panel dashboard:
// connected apps, uploads (public/private, live/taken down), users
// (free/premium), quotas, categories, avatars.
router.get('/stats', async (req, res) => {
  try {
    if (!needDb(req, res)) return;
    await db.initDb();
    const sql = db.getSql();
    const clients = await sql`SELECT client_id, name, can_grant_premium AS "canGrantPremium",
      can_grant_upload AS "canGrantUpload", free_uploads_per_day AS "freeUploadsPerDay",
      is_active AS "isActive", created_at AS "createdAt"
      FROM app_clients ORDER BY created_at DESC`;
    const upBySource = await sql`SELECT author_source AS source,
      COUNT(*)::int AS uploads,
      COUNT(*) FILTER (WHERE visibility = 'private')::int AS "privateUploads",
      COUNT(*) FILTER (WHERE status = 'taken_down')::int AS "takenDown"
      FROM uploads GROUP BY author_source`;
    const usersBySource = await sql`SELECT auth_source AS source,
      COUNT(*)::int AS users,
      COUNT(*) FILTER (WHERE is_premium = TRUE)::int AS "premiumUsers"
      FROM users GROUP BY auth_source`;
    const upMap = Object.fromEntries(upBySource.map((r) => [r.source, r]));
    const userMap = Object.fromEntries(usersBySource.map((r) => [r.source, r]));
    const apps = clients.map((c) => ({
      ...c,
      uploads: (upMap[c.client_id] || {}).uploads || 0,
      privateUploads: (upMap[c.client_id] || {}).privateUploads || 0,
      takenDown: (upMap[c.client_id] || {}).takenDown || 0,
      users: (userMap[c.client_id] || {}).users || 0,
      premiumUsers: (userMap[c.client_id] || {}).premiumUsers || 0,
    }));
    const totals = await sql`SELECT
      (SELECT COUNT(*)::int FROM uploads) AS uploads,
      (SELECT COUNT(*)::int FROM uploads WHERE visibility = 'private') AS "privateUploads",
      (SELECT COUNT(*)::int FROM uploads WHERE status = 'taken_down') AS "takenDown",
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM users WHERE is_premium = TRUE) AS "premiumUsers",
      (SELECT COUNT(*)::int FROM categories) AS categories,
      (SELECT COUNT(*)::int FROM avatars WHERE is_active = TRUE) AS avatars`;
    res.json({
      totals: totals[0],
      apps,
      // Non-app origins (manual accounts, guests) for completeness
      others: ['manual', 'guest']
        .map((s) => ({ source: s, ...(upMap[s] || { uploads: 0 }), ...(userMap[s] || { users: 0 }) }))
        .filter((o) => o.uploads > 0 || o.users > 0),
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load stats.', details: e.message });
  }
});

// --- Uploads ---------------------------------------------------------------
router.get('/uploads', async (req, res) => {
  try {
    if (!needDb(req, res)) return;
    await db.initDb();
    const { source, status, visibility, limit } = req.query;
    const n = Math.max(1, Math.min(200, parseInt(String(limit || 50), 10) || 50));
    const sql = db.getSql();
    const rows = await sql`SELECT id, provider, provider_id AS "providerId", url, title,
      category, author_user_id AS "authorUserId", author_source AS "authorSource",
      visibility, picker_visible AS "pickerVisible", status, created_at AS "createdAt"
      FROM uploads
      WHERE (${source || null}::text IS NULL OR author_source = ${source || ''})
        AND (${status || null}::text IS NULL OR status = ${status || ''})
        AND (${visibility || null}::text IS NULL OR visibility = ${visibility || ''})
      ORDER BY created_at DESC LIMIT ${n}`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list uploads.', details: e.message });
  }
});

router.post('/uploads/:id/takedown', async (req, res) => {
  try {
    if (!needDb(req, res)) return;
    await db.initDb();
    const sql = db.getSql();
    const rows = await sql`UPDATE uploads SET status = 'taken_down' WHERE id = ${req.params.id} RETURNING id`;
    if (rows.length === 0) return res.status(404).json({ error: 'Upload not found.' });
    res.json({ id: rows[0].id, status: 'taken_down' });
  } catch (e) {
    res.status(500).json({ error: 'Takedown failed.', details: e.message });
  }
});

router.post('/uploads/:id/restore', async (req, res) => {
  try {
    if (!needDb(req, res)) return;
    await db.initDb();
    const sql = db.getSql();
    const rows = await sql`UPDATE uploads SET status = 'live' WHERE id = ${req.params.id} RETURNING id`;
    if (rows.length === 0) return res.status(404).json({ error: 'Upload not found.' });
    res.json({ id: rows[0].id, status: 'live' });
  } catch (e) {
    res.status(500).json({ error: 'Restore failed.', details: e.message });
  }
});

router.patch('/uploads/:id', async (req, res) => {
  try {
    if (!needDb(req, res)) return;
    await db.initDb();
    const { category, pickerVisible } = req.body || {};
    const sql = db.getSql();
    const rows = await sql`UPDATE uploads SET
      category = COALESCE(${category === undefined ? null : String(category).slice(0, 60)}, category),
      picker_visible = COALESCE(${pickerVisible === undefined ? null : !!pickerVisible}, picker_visible)
      WHERE id = ${req.params.id}
      RETURNING id, category, picker_visible AS "pickerVisible"`;
    if (rows.length === 0) return res.status(404).json({ error: 'Upload not found.' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Update failed.', details: e.message });
  }
});

// --- Categories ------------------------------------------------------------
router.get('/categories', async (req, res) => {
  try {
    if (!needDb(req, res)) return;
    await db.initDb();
    const sql = db.getSql();
    const rows = await sql`SELECT name, visibility, show_in_picker AS "showInPicker" FROM categories ORDER BY name`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list categories.', details: e.message });
  }
});

router.post('/categories', async (req, res) => {
  try {
    if (!needDb(req, res)) return;
    await db.initDb();
    const { name, visibility = 'free', showInPicker = true } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required.' });
    if (!['free', 'premium', 'hidden'].includes(visibility)) {
      return res.status(400).json({ error: 'visibility must be free|premium|hidden.' });
    }
    const sql = db.getSql();
    const rows = await sql`INSERT INTO categories (name, visibility, show_in_picker)
      VALUES (${String(name).trim().slice(0, 60)}, ${visibility}, ${!!showInPicker})
      ON CONFLICT (name) DO UPDATE SET visibility = EXCLUDED.visibility, show_in_picker = EXCLUDED.show_in_picker
      RETURNING name, visibility, show_in_picker AS "showInPicker"`;
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to save category.', details: e.message });
  }
});

router.patch('/categories/:name', async (req, res) => {
  try {
    if (!needDb(req, res)) return;
    await db.initDb();
    const { visibility, showInPicker } = req.body || {};
    if (visibility !== undefined && !['free', 'premium', 'hidden'].includes(visibility)) {
      return res.status(400).json({ error: 'visibility must be free|premium|hidden.' });
    }
    const sql = db.getSql();
    const rows = await sql`UPDATE categories SET
      visibility = COALESCE(${visibility === undefined ? null : visibility}, visibility),
      show_in_picker = COALESCE(${showInPicker === undefined ? null : !!showInPicker}, show_in_picker)
      WHERE name = ${req.params.name}
      RETURNING name, visibility, show_in_picker AS "showInPicker"`;
    if (rows.length === 0) return res.status(404).json({ error: 'Category not found.' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update category.', details: e.message });
  }
});

// --- Avatars (fixed predefined set) ----------------------------------------
router.get('/avatars', async (req, res) => {
  try {
    if (!needDb(req, res)) return;
    await db.initDb();
    const sql = db.getSql();
    const rows = await sql`SELECT id, url, sort_order AS "sortOrder", is_active AS "isActive"
      FROM avatars ORDER BY sort_order, created_at`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list avatars.', details: e.message });
  }
});

router.post('/avatars', async (req, res) => {
  try {
    if (!needDb(req, res)) return;
    await db.initDb();
    const { url, sortOrder = 0 } = req.body || {};
    if (!url || !String(url).startsWith('http')) return res.status(400).json({ error: 'A valid http(s) url is required.' });
    const sql = db.getSql();
    const rows = await sql`INSERT INTO avatars (url, sort_order) VALUES (${String(url)}, ${Number(sortOrder) || 0})
      RETURNING id, url, sort_order AS "sortOrder"`;
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add avatar.', details: e.message });
  }
});

router.patch('/avatars/:id', async (req, res) => {
  try {
    if (!needDb(req, res)) return;
    await db.initDb();
    const { url, sortOrder, isActive } = req.body || {};
    const sql = db.getSql();
    const rows = await sql`UPDATE avatars SET
      url = COALESCE(${url === undefined ? null : String(url)}, url),
      sort_order = COALESCE(${sortOrder === undefined ? null : Number(sortOrder) || 0}, sort_order),
      is_active = COALESCE(${isActive === undefined ? null : !!isActive}, is_active)
      WHERE id = ${req.params.id}
      RETURNING id, url, sort_order AS "sortOrder", is_active AS "isActive"`;
    if (rows.length === 0) return res.status(404).json({ error: 'Avatar not found.' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update avatar.', details: e.message });
  }
});

module.exports = router;
