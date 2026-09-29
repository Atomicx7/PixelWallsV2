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
    // users table for email/password auth
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
