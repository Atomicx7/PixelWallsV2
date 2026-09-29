// lib/auth.js — JWT auth backed by Neon Postgres.
// Routes: POST /api/auth/signup, POST /api/auth/login, GET /api/auth/me,
//         PATCH /api/auth/me, POST /api/auth/avatar/upload (own image, private)
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('./db');
const manage = require('./manage');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 15) * 1024 * 1024 },
});

const JWT_SECRET = () => process.env.JWT_SECRET || process.env.AUTH_SECRET || '';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(user) {
  const secret = JWT_SECRET();
  if (!secret) throw new Error('JWT_SECRET is not set. Add it to server/.env');
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, secret, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    authSource: row.auth_source || 'manual',
    isPremium: !!row.is_premium,
    avatarUrl: row.avatar_url || null,
    createdAt: row.created_at,
  };
}

function requireDb(req, res) {
  if (!db.isConfigured()) {
    res.status(503).json({
      error: 'Auth database not configured.',
      details: 'Set DATABASE_URL (Neon connection string) in server/.env or Vercel env vars.',
    });
    return false;
  }
  if (!JWT_SECRET()) {
    res.status(500).json({
      error: 'JWT_SECRET not configured.',
      details: 'Set JWT_SECRET in server/.env or Vercel env vars.',
    });
    return false;
  }
  return true;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Middleware: attaches req.user if a valid Bearer token is present.
// If { required: true }, rejects missing/invalid tokens with 401.
function authMiddleware({ required = false } = {}) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      if (required) return res.status(401).json({ error: 'Authentication required.' });
      req.user = null;
      return next();
    }
    try {
      const secret = JWT_SECRET();
      if (!secret) throw new Error('missing secret');
      req.user = jwt.verify(token, secret);
      return next();
    } catch (err) {
      if (required) return res.status(401).json({ error: 'Invalid or expired token.' });
      req.user = null;
      return next();
    }
  };
}

// POST /api/auth/signup { name, email, password }
router.post('/signup', async (req, res) => {
  try {
    if (!requireDb(req, res)) return;
    await db.initDb();
    const { name, email, password } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });
    if (!password || String(password).length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const sql = db.getSql();
    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await sql`SELECT id FROM users WHERE auth_source = 'manual' AND lower(email) = ${normalizedEmail} LIMIT 1`;
    if (existing.length > 0) return res.status(409).json({ error: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const rows =
      await sql`INSERT INTO users (name, email, password_hash, auth_source) VALUES (${String(name).trim()}, ${String(email).trim()}, ${passwordHash}, 'manual') RETURNING id, name, email, auth_source, is_premium, avatar_url, created_at`;
    const user = publicUser(rows[0]);
    const token = signToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    console.error('[auth] signup error:', err);
    res.status(500).json({ error: 'Signup failed.', details: err.message });
  }
});

// POST /api/auth/login { email, password }
router.post('/login', async (req, res) => {
  try {
    if (!requireDb(req, res)) return;
    await db.initDb();
    const { email, password } = req.body || {};
    if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });
    if (!password) return res.status(400).json({ error: 'Password is required.' });

    const sql = db.getSql();
    const normalizedEmail = String(email).trim().toLowerCase();
    const rows = await sql`SELECT id, name, email, password_hash, auth_source, is_premium, avatar_url, created_at FROM users WHERE auth_source = 'manual' AND lower(email) = ${normalizedEmail} LIMIT 1`;
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password.' });

    const row = rows[0];
    const ok = await bcrypt.compare(String(password), row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

    const user = publicUser(row);
    const token = signToken(user);
    res.json({ user, token });
  } catch (err) {
    console.error('[auth] login error:', err);
    res.status(500).json({ error: 'Login failed.', details: err.message });
  }
});

// GET /api/auth/me — validate token, return user
router.get('/me', authMiddleware({ required: true }), async (req, res) => {
  try {
    if (!requireDb(req, res)) return;
    await db.initDb();
    const sql = db.getSql();
    const rows = await sql`SELECT id, name, email, auth_source, is_premium, avatar_url, created_at FROM users WHERE id = ${req.user.sub} LIMIT 1`;
    if (rows.length === 0) return res.status(401).json({ error: 'User no longer exists.' });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    console.error('[auth] me error:', err);
    res.status(500).json({ error: 'Failed to fetch user.', details: err.message });
  }
});

// POST /api/auth/avatar/upload — manual users upload their OWN profile image
// (multipart `image`). Stored per-user under pixelwalls/avatars/…, re-upload
// replaces it, and it is private: only returned to the owner via /me.
router.post('/avatar/upload', authMiddleware({ required: true }), upload.single('image'), async (req, res) => {
  try {
    if (!requireDb(req, res)) return;
    await db.initDb();
    const sql = db.getSql();
    const rows = await sql`SELECT id, name FROM users WHERE id = ${req.user.sub} AND auth_source = 'manual' LIMIT 1`;
    if (rows.length === 0) return res.status(401).json({ error: 'Account not found.' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded. Send multipart `image`.' });
    const identity = { kind: 'manual', user: { id: rows[0].id, name: rows[0].name }, premium: false, canUpload: true };
    const { avatarUrl } = await manage.saveUserAvatar({ file: req.file, identity });
    res.status(201).json({ avatarUrl });
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Avatar upload failed.', details: err.message });
  }
});

// PATCH /api/auth/me { name?, avatarId? } — manual users update own profile only.
router.patch('/me', authMiddleware({ required: true }), async (req, res) => {
  try {
    if (!requireDb(req, res)) return;
    await db.initDb();
    const { name, avatarId } = req.body || {};
    const sql = db.getSql();
    let avatarUrl = null;
    if (avatarId !== undefined) {
      if (avatarId) {
        const found = await sql`SELECT url FROM avatars WHERE id = ${avatarId} AND is_active = TRUE LIMIT 1`;
        if (found.length === 0) return res.status(404).json({ error: 'Avatar not found.' });
        avatarUrl = found[0].url;
      }
      await sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${req.user.sub} AND auth_source = 'manual'`;
    }
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty.' });
      await sql`UPDATE users SET name = ${String(name).trim().slice(0, 120)} WHERE id = ${req.user.sub} AND auth_source = 'manual'`;
    }
    const rows = await sql`SELECT id, name, email, auth_source, is_premium, avatar_url, created_at FROM users WHERE id = ${req.user.sub} LIMIT 1`;
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    console.error('[auth] patch me error:', err);
    res.status(500).json({ error: 'Failed to update profile.', details: err.message });
  }
});

module.exports = { router, authMiddleware, signToken };
