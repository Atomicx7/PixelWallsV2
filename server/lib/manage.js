// lib/manage.js — Upload registry, quotas, categories, avatars, listing policy.
//
// Privacy model:
// - Every upload row carries (author_source, author_user_id). Users can only
//   ever see/manage their OWN rows via /me/* endpoints.
// - App uploads are visibility='private' → hidden from the public gallery AND
//   the picker; visible only through admin endpoints (x-admin-secret).
// - Admin (offrecord panel) sees everything and moderates (takedown/restore,
//   recategorize, quotas, category visibility, avatar set).
const db = require('./db');

function isAdminRequest(req) {
  const secret = process.env.ADMIN_SECRET || '';
  return !!secret && req.headers['x-admin-secret'] === secret;
}

// ---------------------------------------------------------------------------
// Upload registry
// ---------------------------------------------------------------------------
async function recordUpload({ provider, providerId, url, title, category, identity, visibility }) {
  const sql = db.getSql();
  if (!sql) return null;
  const vis = visibility || (identity && identity.kind === 'app' ? 'private' : 'public');
  const rows = await sql`INSERT INTO uploads
    (provider, provider_id, url, title, category, author_user_id, author_source, visibility)
    VALUES (${provider || 'unknown'}, ${String(providerId || '')}, ${url || ''},
      ${String(title || '').slice(0, 255)}, ${String(category || 'Abstract').slice(0, 60)},
      ${identity && identity.user ? identity.user.id : null},
      ${identity ? identity.kind === 'app' ? identity.source : identity.kind : 'guest'},
      ${vis})
    RETURNING id, visibility, created_at`;
  return rows[0];
}

async function uploadsToday({ source, userId }) {
  const sql = db.getSql();
  if (!sql || !userId) return 0;
  const rows = await sql`SELECT COUNT(*)::int AS n FROM uploads
    WHERE author_source = ${source} AND author_user_id = ${userId}
      AND created_at > NOW() - INTERVAL '24 hours'`;
  return rows[0].n;
}

/**
 * Daily upload quota for an identity. Premium bypasses (Infinity).
 * Quotas live on the offrecord side, per app client (free_uploads_per_day,
 * managed from the admin panel; 0 = free users of that app cannot upload).
 * Manual accounts and guests are NOT quota-limited here — they are governed
 * by REQUIRE_AUTH_UPLOAD / REQUIRE_PREMIUM_UPLOAD instead.
 */
async function checkQuota(identity) {
  if (!identity || identity.kind === 'guest') return { ok: true, limit: null, used: null };
  if (identity.premium) return { ok: true, limit: null, used: null, premium: true };
  if (identity.kind === 'manual') return { ok: true, limit: null, used: null };
  const sql = db.getSql();
  const rows = await sql`SELECT free_uploads_per_day FROM app_clients WHERE client_id = ${identity.source} LIMIT 1`;
  const limit = rows.length ? rows[0].free_uploads_per_day : 0;
  const scopeName = identity.sourceName || 'your app';
  if (!limit || limit <= 0) {
    return { ok: false, limit: 0, used: 0, reason: `Uploads are disabled for ${scopeName}. Upgrade for access.` };
  }
  const used = await uploadsToday({ source: identity.source, userId: identity.user.id });
  if (used >= limit) {
    return { ok: false, limit, used, reason: `Daily upload limit reached (${limit}/day). Try again tomorrow or upgrade.` };
  }
  return { ok: true, limit, used };
}

/** Cloudinary folder hierarchy per origin: pixelwalls/apps/<client> | manual | guests */
function folderFor(identity) {
  const base = process.env.CLOUDINARY_FOLDER || 'pixelwalls';
  if (!identity) return `${base}/guests`;
  if (identity.kind === 'app') return `${base}/apps/${identity.source}`;
  if (identity.kind === 'manual') return `${base}/manual`;
  return `${base}/guests`;
}

/**
 * Per-user private avatar upload (any user, incl. app users like OffRecord).
 * Stores under pixelwalls/avatars/<origin>/<owner>, sets users.avatar_url
 * (re-upload replaces it), and records a PRIVATE registry row so nobody but
 * the owner (and admin) can ever see it. Guests are rejected (no identity).
 */
async function saveUserAvatar({ file, identity }) {
  if (!identity || identity.kind === 'guest' || !identity.user) {
    const err = new Error('Sign in or open from your app to upload an avatar.');
    err.status = 401;
    throw err;
  }
  if (!file || !file.mimetype.startsWith('image/')) {
    const err = new Error('File must be an image.');
    err.status = 400;
    throw err;
  }
  const storage = require('./storage');
  const base = process.env.CLOUDINARY_FOLDER || 'pixelwalls';
  const owner =
    identity.kind === 'app'
      ? `apps/${identity.source}/${String(identity.externalId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)}`
      : `manual/${identity.user.id}`;
  const entry = await storage.upload(file.buffer, {
    alt: 'Profile avatar',
    author: identity.user.name || 'User',
    category: 'Avatars',
    mimetype: file.mimetype,
    filename: file.originalname || 'avatar',
    folder: `${base}/avatars/${owner}`,
  });
  // Serve a pre-transformed 256px avatar URL when the bytes live on
  // Cloudinary (tiny feed loads); otherwise the original file URL.
  // Re-upload simply overwrites avatar_url.
  let avatarUrl = entry.fullUrl || entry.url;
  if (entry.provider === 'cloudinary' && entry.id) {
    try {
      const cloudinary = require('./providers/cloudinary');
      avatarUrl = cloudinary.avatarUrl(entry.id) || avatarUrl;
    } catch (e) {
      console.warn('[avatar] transformed URL skipped:', e.message);
    }
  }
  const sql = db.getSql();
  // Remember the previous avatar so it can be deleted from Cloudinary below.
  let previousUrl = null;
  if (identity.kind === 'app') {
    const cur = await sql`SELECT avatar_url FROM users WHERE auth_source = ${identity.source} AND external_id = ${String(identity.externalId)} LIMIT 1`;
    previousUrl = cur.length ? cur[0].avatar_url : null;
    await sql`UPDATE users SET avatar_url = ${avatarUrl}
      WHERE auth_source = ${identity.source} AND external_id = ${String(identity.externalId)}`;
  } else {
    const cur = await sql`SELECT avatar_url FROM users WHERE id = ${identity.user.id} LIMIT 1`;
    previousUrl = cur.length ? cur[0].avatar_url : null;
    await sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${identity.user.id}`;
  }
  // Delete the replaced image from Cloudinary (best-effort, never fails the
  // upload). destroyUserAvatar only accepts user-owned avatar paths, so
  // shared predefined avatars can never be deleted this way.
  if (previousUrl && previousUrl !== avatarUrl) {
    try {
      const cloudinary = require('./providers/cloudinary');
      void cloudinary.destroyUserAvatar(previousUrl).then((deleted) => {
        if (deleted) console.log(`[avatar] replaced image deleted from Cloudinary`);
      });
    } catch (e) {
      console.warn('[avatar] cleanup skipped:', e.message);
    }
  }
  try {
    await recordUpload({
      provider: entry.provider,
      providerId: entry.id,
      url: avatarUrl,
      title: 'Profile avatar',
      category: 'Avatars',
      identity,
      visibility: 'private',
    });
  } catch (e) {
    console.warn('[avatar] registry write failed (avatar itself saved):', e.message);
  }
  return { avatarUrl };
}

// ---------------------------------------------------------------------------
// Categories + avatars
// ---------------------------------------------------------------------------
async function getCategories() {
  const sql = db.getSql();
  if (!sql) return [];
  return sql`SELECT name, visibility, show_in_picker AS "showInPicker" FROM categories ORDER BY name`;
}

async function getAvatars() {
  const sql = db.getSql();
  if (!sql) return [];
  return sql`SELECT id, url FROM avatars WHERE is_active = TRUE ORDER BY sort_order, created_at LIMIT 100`;
}

// ---------------------------------------------------------------------------
// Listing policy: apply registry (takedown/private/recategorize) + category
// visibility to a merged provider listing.
// - Unregistered items (uploaded before the registry) are treated as public.
// - Private items: admin only. Premium-category items: premium identities only.
// - forPicker: additionally requires picker_visible + category.show_in_picker.
// ---------------------------------------------------------------------------
async function applyPolicy(items, { identity, isAdmin = false, forPicker = false } = {}) {
  const sql = db.getSql();
  let regByKey = new Map();
  let catByName = new Map();
  if (sql) {
    try {
      const regs = await sql`SELECT provider, provider_id AS "providerId", visibility,
        status, picker_visible AS "pickerVisible", category FROM uploads`;
      for (const r of regs) regByKey.set(`${r.provider}:${r.providerId}`, r);
    } catch {}
    try {
      const cats = await sql`SELECT name, visibility, show_in_picker AS "showInPicker" FROM categories`;
      for (const c of cats) catByName.set(String(c.name).toLowerCase(), c);
    } catch {}
  }
  const premium = !!(identity && identity.premium);
  return (items || []).filter((w) => {
    const reg = regByKey.get(`${w.provider || ''}:${w.id}`);
    const status = reg ? reg.status : 'live';
    if (status !== 'live' && !isAdmin) return false;
    const visibility = reg ? reg.visibility : 'public';
    if (visibility === 'private' && !isAdmin) return false;
    const category = (reg && reg.category) || w.category || 'Abstract';
    const cat = catByName.get(String(category).toLowerCase());
    if (cat) {
      if (cat.visibility === 'hidden' && !isAdmin) return false;
      if (cat.visibility === 'premium' && !premium && !isAdmin) return false;
      if (forPicker && !cat.showInPicker && !isAdmin) return false;
    }
    if (forPicker && reg && reg.pickerVisible === false && !isAdmin) return false;
    if (reg && reg.category) w.category = reg.category;
    return true;
  });
}

module.exports = {
  isAdminRequest,
  recordUpload,
  uploadsToday,
  checkQuota,
  folderFor,
  saveUserAvatar,
  getCategories,
  getAvatars,
  applyPolicy,
};
