// lib/access.js — Unified identity for PixelWalls.
//
// Three doors, one user table:
//   1. manual — email/password login (auth_source='manual'), handled in lib/auth.js
//   2. app    — offrecord + future apps mint a JWT with their client secret;
//              PixelWalls verifies it and auto-provisions the user
//              (auth_source=<client_id>, external_id=<app user id>). No login UI.
//   3. guest  — anonymous visitor, limited rights.
//
// App token format (JWT HS256, signed with the client's secret):
//   { iss: <client_id>, sub: <app user id>, name?: string,
//     premium?: boolean, exp: <now + max 24h> }
// Delivered as `?key=` URL param (first visit) or `Authorization: Bearer` header.
//
// Admin (you) registers each app once:
//   POST /api/admin/apps  { name, canGrantPremium, canGrantUpload }
//     header x-admin-secret: <ADMIN_SECRET>
//   → { clientId, secret }  (secret shown ONCE — paste it into that app's backend)
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('./db');

const MAX_TOKEN_AGE_S = 24 * 3600; // app tokens live at most 24h

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

// Client secrets must be recoverable (JWT HS256 needs the raw key on verify),
// so they are stored AES-256-GCM encrypted, keyed by ADMIN_SECRET.
// DB leak alone never exposes them.
function encKey() {
  const admin = process.env.ADMIN_SECRET || '';
  if (!admin) throw new Error('ADMIN_SECRET is not set. Add it to server/.env');
  return crypto.createHash('sha256').update(admin).digest();
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const ct = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ct.toString('hex')}`;
}

function decryptSecret(enc) {
  const [ivHex, tagHex, ctHex] = String(enc).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8');
}

function newClientId(name) {
  const slug = String(name || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'app';
  return `${slug}_${crypto.randomBytes(4).toString('hex')}`;
}

function peekIss(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded && typeof decoded.iss === 'string' ? decoded.iss : null;
  } catch {
    return null;
  }
}

async function getClient(clientId) {
  const sql = db.getSql();
  if (!sql || !clientId) return null;
  const rows = await sql`SELECT client_id, name, secret_enc, can_grant_premium, can_grant_upload,
    free_uploads_per_day, is_active
    FROM app_clients WHERE client_id = ${clientId} LIMIT 1`;
  if (rows.length === 0 || !rows[0].is_active || !rows[0].secret_enc) return null;
  return rows[0];
}

/** Verify an app-issued JWT. Throws on any problem. Returns { client, claims }. */
async function verifyAppToken(token) {
  const iss = peekIss(token);
  if (!iss) throw new Error('Token has no issuer (iss).');
  const client = await getClient(iss);
  if (!client) throw new Error('Unknown or revoked app client.');
  let claims;
  let rawSecret;
  try {
    rawSecret = decryptSecret(client.secret_enc);
  } catch (e) {
    throw new Error('Server cannot unlock app credentials (ADMIN_SECRET mismatch?).');
  }
  try {
    claims = jwt.verify(token, rawSecret, { algorithms: ['HS256'] });
  } catch (e) {
    throw new Error('Invalid or expired app token.');
  }
  if (!claims.sub || typeof claims.sub !== 'string') throw new Error('Token has no subject (sub).');
  // Enforce short lifetime even if the issuer set a long exp
  if (claims.iat && claims.exp && claims.exp - claims.iat > MAX_TOKEN_AGE_S + 60) {
    throw new Error('Token lifetime exceeds 24h maximum.');
  }
  return { client, claims };
}

/** Find-or-create the PixelWalls user for an app identity. Returns public identity. */
async function provisionAppUser(client, claims) {
  const sql = db.getSql();
  const externalId = String(claims.sub);
  const name = String(claims.name || 'App User').slice(0, 120);
  const premium = claims.premium === true && !!client.can_grant_premium;

  const existing = await sql`SELECT id, name, is_premium, created_at FROM users
    WHERE auth_source = ${client.client_id} AND external_id = ${externalId} LIMIT 1`;
  let row;
  if (existing.length > 0) {
    row = existing[0];
    // Refresh name/premium from the token on each visit
    await sql`UPDATE users SET name = ${name}, is_premium = ${premium} WHERE id = ${row.id}`;
    row = { ...row, name, is_premium: premium };
  } else {
    const inserted = await sql`INSERT INTO users (name, auth_source, external_id, is_premium)
      VALUES (${name}, ${client.client_id}, ${externalId}, ${premium})
      RETURNING id, name, is_premium, created_at`;
    row = inserted[0];
  }
  return {
    kind: 'app',
    user: { id: row.id, name: row.name, createdAt: row.created_at },
    source: client.client_id,
    sourceName: client.name,
    externalId,
    premium: !!row.is_premium,
    canUpload: !!client.can_grant_upload,
  };
}

function guestIdentity() {
  return {
    kind: 'guest',
    user: null,
    premium: false,
    // Guests may upload unless the server requires an account (REQUIRE_AUTH_UPLOAD=true)
    canUpload: process.env.REQUIRE_AUTH_UPLOAD !== 'true',
  };
}

/**
 * Attach req.identity for every request:
 *   Bearer <app JWT>  → app identity (fail closed: 401 on bad token)
 *   Bearer <manual JWT> → manual identity (fail closed: 401 on bad token)
 *   nothing → guest identity
 */
function resolveIdentity({ required = false } = {}) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) {
        if (required) return res.status(401).json({ error: 'Authentication required.' });
        req.identity = guestIdentity();
        req.user = null;
        return next();
      }
      if (!db.isConfigured()) {
        return res.status(503).json({ error: 'Identity database not configured. Set DATABASE_URL.' });
      }
      await db.initDb();
      const iss = peekIss(token);
      if (iss && (await getClient(iss))) {
        // App-issued token
        try {
          const { client, claims } = await verifyAppToken(token);
          req.identity = await provisionAppUser(client, claims);
          req.user = req.identity.user;
          return next();
        } catch (e) {
          return res.status(401).json({ error: e.message || 'Invalid app token.' });
        }
      }
      // Manual JWT (PixelWalls login)
      try {
        const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET || '';
        if (!secret) throw new Error('missing secret');
        const payload = jwt.verify(token, secret);
        const sql = db.getSql();
        const rows = await sql`SELECT id, name, email, auth_source, is_premium, created_at
          FROM users WHERE id = ${payload.sub} LIMIT 1`;
        if (rows.length === 0) return res.status(401).json({ error: 'User no longer exists.' });
        const r = rows[0];
        req.identity = {
          kind: 'manual',
          user: { id: r.id, name: r.name, email: r.email, createdAt: r.created_at },
          source: 'manual',
          sourceName: 'PixelWalls',
          premium: !!r.is_premium,
          canUpload: true,
        };
        req.user = req.identity.user;
        return next();
      } catch (e) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
      }
    } catch (e) {
      console.error('[access] resolve error:', e);
      return res.status(500).json({ error: 'Identity resolution failed.', details: e.message });
    }
  };
}

// ---------------------------------------------------------------------------
// Public: POST /api/access/resolve  { key } → { identity }
// Used on first visit with ?key=… to validate + provision, before storing it.
// ---------------------------------------------------------------------------
const accessRouter = express.Router();

accessRouter.post('/resolve', async (req, res) => {
  try {
    const { key } = req.body || {};
    if (!key || typeof key !== 'string') return res.status(400).json({ error: 'Missing key.' });
    if (!db.isConfigured()) return res.status(503).json({ error: 'DATABASE_URL not configured.' });
    await db.initDb();
    const { client, claims } = await verifyAppToken(key);
    const identity = await provisionAppUser(client, claims);
    res.json({ identity });
  } catch (e) {
    res.status(401).json({ error: e.message || 'Invalid access key.' });
  }
});

// POST /api/access/avatar { avatarId } (Bearer app token) — select a predefined avatar.
// Only avatars from the fixed admin-managed set can be chosen.
accessRouter.post('/avatar', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'App token required.' });
    if (!db.isConfigured()) return res.status(503).json({ error: 'DATABASE_URL not configured.' });
    await db.initDb();
    const { claims } = await verifyAppToken(token);
    const { avatarId } = req.body || {};
    if (!avatarId) return res.status(400).json({ error: 'avatarId is required.' });
    const sql = db.getSql();
    const found = await sql`SELECT url FROM avatars WHERE id = ${avatarId} AND is_active = TRUE LIMIT 1`;
    if (found.length === 0) return res.status(404).json({ error: 'Avatar not found.' });
    await sql`UPDATE users SET avatar_url = ${found[0].url}
      WHERE auth_source = ${claims.iss} AND external_id = ${String(claims.sub)}`;
    res.json({ avatarUrl: found[0].url });
  } catch (e) {
    res.status(401).json({ error: e.message || 'Failed to set avatar.' });
  }
});

// ---------------------------------------------------------------------------
// Admin: register / list / revoke app clients. Guarded by ADMIN_SECRET.
// ---------------------------------------------------------------------------
const adminRouter = express.Router();

function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET || '';
  if (!secret) {
    return res.status(500).json({
      error: 'ADMIN_SECRET not configured.',
      details: 'Set ADMIN_SECRET in server/.env (generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))").',
    });
  }
  if (req.headers['x-admin-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden: bad admin secret.' });
  }
  next();
}

adminRouter.use(requireAdmin);

// POST /api/admin/apps { name, canGrantPremium=true, canGrantUpload=true }
// → { clientId, secret } — the secret is shown ONCE.
adminRouter.post('/apps', async (req, res) => {
  try {
    if (!db.isConfigured()) return res.status(503).json({ error: 'DATABASE_URL not configured.' });
    await db.initDb();
    const { name, canGrantPremium = true, canGrantUpload = true } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required.' });
    const clientId = newClientId(name);
    const secret = crypto.randomBytes(32).toString('hex');
    const sql = db.getSql();
    await sql`INSERT INTO app_clients (client_id, name, secret_hash, secret_enc, can_grant_premium, can_grant_upload)
      VALUES (${clientId}, ${String(name).trim()}, ${sha256(secret)}, ${encryptSecret(secret)},
        ${canGrantPremium !== false}, ${canGrantUpload !== false})`;
    res.status(201).json({
      clientId,
      secret,
      note: 'Store the secret in the app backend NOW — it is hashed and cannot be shown again.',
    });
  } catch (e) {
    console.error('[access] create client error:', e);
    res.status(500).json({ error: 'Failed to register app.', details: e.message });
  }
});

// GET /api/admin/apps — list clients (no secrets)
adminRouter.get('/apps', async (req, res) => {
  try {
    if (!db.isConfigured()) return res.status(503).json({ error: 'DATABASE_URL not configured.' });
    await db.initDb();
    const sql = db.getSql();
    const rows = await sql`SELECT client_id, name, can_grant_premium, can_grant_upload,
      free_uploads_per_day, is_active, created_at
      FROM app_clients ORDER BY created_at DESC`;
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list apps.', details: e.message });
  }
});

// PATCH /api/admin/apps/:id { canGrantPremium, canGrantUpload, freeUploadsPerDay }
// Free-user upload switch + daily quota per app, managed from the offrecord panel.
adminRouter.patch('/apps/:id', async (req, res) => {
  try {
    if (!db.isConfigured()) return res.status(503).json({ error: 'DATABASE_URL not configured.' });
    await db.initDb();
    const { canGrantPremium, canGrantUpload, freeUploadsPerDay } = req.body || {};
    const sql = db.getSql();
    const rows = await sql`UPDATE app_clients SET
      can_grant_premium = COALESCE(${canGrantPremium === undefined ? null : !!canGrantPremium}, can_grant_premium),
      can_grant_upload = COALESCE(${canGrantUpload === undefined ? null : !!canGrantUpload}, can_grant_upload),
      free_uploads_per_day = COALESCE(${freeUploadsPerDay === undefined ? null : Math.max(0, Number(freeUploadsPerDay) || 0)}, free_uploads_per_day)
      WHERE client_id = ${req.params.id}
      RETURNING client_id, name, can_grant_premium, can_grant_upload, free_uploads_per_day, is_active`;
    if (rows.length === 0) return res.status(404).json({ error: 'App client not found.' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update app.', details: e.message });
  }
});

// POST /api/admin/apps/:id/revoke — instantly kills all tokens from that app
adminRouter.post('/apps/:id/revoke', async (req, res) => {
  try {
    if (!db.isConfigured()) return res.status(503).json({ error: 'DATABASE_URL not configured.' });
    await db.initDb();
    const sql = db.getSql();
    await sql`UPDATE app_clients SET is_active = FALSE WHERE client_id = ${req.params.id}`;
    res.json({ revoked: req.params.id });
  } catch (e) {
    res.status(500).json({ error: 'Failed to revoke app.', details: e.message });
  }
});

module.exports = {
  accessRouter,
  adminRouter,
  resolveIdentity,
  verifyAppToken,
  provisionAppUser,
  guestIdentity,
  getClient,
};
