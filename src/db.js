'use strict';
// Camada de banco: PostgreSQL (produção) ou SQLite nativo do Node (desenvolvimento / servidor único).
// DATABASE_URL=postgres://usuario:senha@host:5432/banco   ou   DATABASE_URL=sqlite:./data/app.db
const fs = require('fs');
const path = require('path');

const url = process.env.DATABASE_URL || 'sqlite:./data/app.db';
const isPg = /^postgres(ql)?:\/\//.test(url);
const isSupabase = /supabase\.(co|com)/.test(url);

let impl;
if (isPg) {
  const { Pool } = require('pg');
  // Supabase e bancos gerenciados exigem SSL; o pooler do Supabase (porta 5432 "session" ou 6543 "transaction") funciona em IPv4.
  const ssl = process.env.PGSSL === 'disable' ? false
    // Com PGCA (certificado da CA do banco, ex.: o do Supabase em Database › SSL) a conexão confere o servidor e evita interceptação
    : process.env.PGCA ? { ca: process.env.PGCA.replace(/\\n/g, '\n'), rejectUnauthorized: true }
    : (process.env.PGSSL === 'require' || isSupabase || /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined);
  const conn = url.replace(/[?&]sslmode=[^&]*/, '').replace(/\?$/, '');
  const pool = new Pool({ connectionString: conn, ssl, max: Number(process.env.PGPOOL_MAX || (isSupabase ? 5 : 10)), idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000 });
  pool.on('error', (e) => console.error('[db] conexão perdida:', e.message));
  const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };
  const wrap = (q) => ({
    all: async (s, p = []) => (await q(toPg(s), p)).rows,
    get: async (s, p = []) => (await q(toPg(s), p)).rows[0] || null,
    run: async (s, p = []) => ({ changes: (await q(toPg(s), p)).rowCount }),
  });
  impl = {
    kind: isSupabase ? 'postgres (Supabase)' : 'postgres',
    ...wrap((s, p) => pool.query(s, p)),
    async exec(sql) { await pool.query(sql); },
    async tx(fn) {
      const c = await pool.connect();
      try { await c.query('BEGIN'); const out = await fn(wrap((s, p) => c.query(s, p))); await c.query('COMMIT'); return out; }
      catch (e) { await c.query('ROLLBACK'); throw e; }
      finally { c.release(); }
    },
    json: (v) => v,
    async close() { await pool.end(); },
  };
} else {
  const { DatabaseSync } = require('node:sqlite');
  const file = url.replace(/^sqlite:/, '');
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const norm = (p) => p.map((v) => (v !== null && typeof v === 'object' ? JSON.stringify(v)
    : v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
  const fix = (sql) => sql.replace(/NOW\(\)/g, "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))");
  impl = {
    kind: 'sqlite',
    async all(sql, p = []) { return db.prepare(fix(sql)).all(...norm(p)); },
    async get(sql, p = []) { return db.prepare(fix(sql)).get(...norm(p)) || null; },
    async run(sql, p = []) { const r = db.prepare(fix(sql)).run(...norm(p)); return { changes: Number(r.changes) }; },
    async exec(sql) { db.exec(sql); },
    async tx(fn) { db.exec('BEGIN'); try { const out = await fn(impl); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } },
    json: (v) => (typeof v === 'string' ? JSON.parse(v) : v),
    async close() { db.close(); },
  };
}

async function migrate() {
  const dir = path.join(__dirname, '..', 'migrations');
  await impl.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set((await impl.all('SELECT name FROM schema_migrations')).map((r) => r.name));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    if (f.endsWith('.pg.sql') && !isPg) continue; // migrações exclusivas do PostgreSQL
    let sql = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!isPg) sql = sql.replace(/TIMESTAMPTZ/g, 'TEXT').replace(/JSONB/g, 'TEXT')
      .replace(/DEFAULT NOW\(\)/g, "DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))");
    await impl.exec(sql);
    await impl.run('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)', [f, new Date().toISOString()]);
    console.log(`[db] migração aplicada: ${f}`);
  }
}

module.exports = { db: impl, migrate, isPg, isSupabase };
