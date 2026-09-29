// lib/db.js — Neon Postgres (serverless-friendly) connection + schema init.
// Uses @neondatabase/serverless (HTTP) so it works on Vercel + locally.
// Env: DATABASE_URL (Neon pooled connection string), e.g.
//   postgresql://user:pass@ep-xxx.neon.tech/pixelwalls?sslmode=require
const { neon, neonConfig } = require('@neondatabase/serverless');

let sql = null;
let initPromise = null;

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '';
}

function isConfigured() {
  return Boolean(getDatabaseUrl());
}

function getSql() {
  if (sql) return sql;
  const url = getDatabaseUrl();
  if (!url) return null;
  // Required for edge/serverless fetch pooling
  try {
    neonConfig.fetchConnectionCache = true;
  } catch {}
  sql = neon(url);
  return sql;
}

// Create tables if they don't exist. Safe to call on every boot.
async function initDb() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const client = getSql();
    if (!client) {
      console.warn('[db] DATABASE_URL not set — auth endpoints will return 503 until configured.');
      return { ok: false, reason: 'no-database-url' };
    }
    // users table: manual (email/password) + app-provisioned (offrecord & future apps).
    // Manual users: auth_source='manual', email + password_hash set.
    // App users: auth_source=<client_id>, external_id=<app user id>, no password.
    await client`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    // normalize emails: index for case-insensitive lookup
    await client`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
    `;
    // --- Unified-identity columns (additive migration, existing rows unaffected) ---
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_source TEXT DEFAULT 'manual'`;
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS external_id TEXT`;
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE`;
    // App users have no email/password — relax NOT NULL for them (NULLs never conflict in unique indexes)
    await client`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`;
    await client`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`;
    await client`
      CREATE UNIQUE INDEX IF NOT EXISTS users_source_external_idx ON users (auth_source, external_id);
    `;
    // --- Registered app clients (offrecord + future apps). Secrets stored encrypted. ---
    await client`
      CREATE TABLE IF NOT EXISTS app_clients (
        client_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        secret_hash TEXT NOT NULL,
        can_grant_premium BOOLEAN NOT NULL DEFAULT TRUE,
        can_grant_upload BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    // Secrets must be recoverable for JWT verification → AES-256-GCM (keyed by ADMIN_SECRET)
    await client`ALTER TABLE app_clients ADD COLUMN IF NOT EXISTS secret_enc TEXT`;
    await client`ALTER TABLE app_clients ALTER COLUMN secret_hash DROP NOT NULL`;
    // Per-app free-user daily upload quota (0 = free users of that app cannot upload).
    // Premium users bypass quotas. Managed from the offrecord admin panel.
    await client`ALTER TABLE app_clients ADD COLUMN IF NOT EXISTS free_uploads_per_day INTEGER NOT NULL DEFAULT 0`;

    // --- Upload registry: every upload is recorded with owner + visibility. ---
    // App uploads are visibility='private' (admin-only); manual/guest are 'public'.
    await client`
      CREATE TABLE IF NOT EXISTS uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'Abstract',
        author_user_id UUID NULL,
        author_source TEXT NOT NULL DEFAULT 'guest',
        visibility TEXT NOT NULL DEFAULT 'public',
        picker_visible BOOLEAN NOT NULL DEFAULT TRUE,
        status TEXT NOT NULL DEFAULT 'live',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await client`CREATE INDEX IF NOT EXISTS uploads_provider_idx ON uploads (provider, provider_id)`;
    await client`CREATE INDEX IF NOT EXISTS uploads_author_idx ON uploads (author_source, author_user_id)`;
    await client`CREATE INDEX IF NOT EXISTS uploads_created_idx ON uploads (created_at)`;

    // --- Category taxonomy: visibility free|premium|hidden, picker membership. ---
    await client`
      CREATE TABLE IF NOT EXISTS categories (
        name TEXT PRIMARY KEY,
        visibility TEXT NOT NULL DEFAULT 'free',
        show_in_picker BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    for (const cat of ['Abstract', 'Pastel', 'Minimalist', 'Interiors', 'Avatars']) {
      await client`INSERT INTO categories (name) VALUES (${cat}) ON CONFLICT (name) DO NOTHING`;
    }

    // --- Predefined avatars: fixed set of 6, selectable by everyone incl. free users. ---
    await client`
      CREATE TABLE IF NOT EXISTS avatars (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    const existingAvatars = await client`SELECT COUNT(*)::int AS n FROM avatars`;
    if (existingAvatars[0].n === 0) {
      const seeds = [64, 65, 91, 177, 1005, 1012];
      for (let i = 0; i < seeds.length; i++) {
        await client`INSERT INTO avatars (url, sort_order) VALUES (${`https://picsum.photos/id/${seeds[i]}/256/256`}, ${i})`;
      }
    }
    return { ok: true };
  })().catch((err) => {
    console.error('[db] init failed:', err.message);
    // reset so a later request can retry
    initPromise = null;
    throw err;
  });
  return initPromise;
}

module.exports = { getSql, getDatabaseUrl, isConfigured, initDb };
