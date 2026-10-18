'use strict';
// Montador de painéis elétricos — servidor da versão em nuvem
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { db, migrate } = require('./db');
const auth = require('./auth');

const PORT = Number(process.env.PORT || 8080);
const SECURE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === '1' : process.env.NODE_ENV === 'production';
const ALLOW_SIGNUP = process.env.ALLOW_SIGNUP !== '0';
const MAX_VERSIONS = Number(process.env.MAX_VERSIONS || 50);
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const invite = () => crypto.randomBytes(5).toString('hex').toUpperCase();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Cabeçalhos de segurança
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (SECURE) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  next();
});
app.use('/api', express.json({ limit: process.env.BODY_LIMIT || '15mb' }));

// Proteção simples contra CSRF: a API só aceita JSON vindo da mesma origem
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (!req.is('application/json')) return res.status(415).json({ error: 'Envie JSON.' });
    const o = req.headers.origin; if (o && new URL(o).host !== req.headers.host) return res.status(403).json({ error: 'Origem não permitida.' });
  }
  next();
});

// Limite de tentativas de login (em memória, por IP)
const hits = new Map();
function limiter(max, winMs) {
  return (req, res, next) => {
    const k = req.ip + req.path, t = Date.now(), h = (hits.get(k) || []).filter((x) => t - x < winMs);
    if (h.length >= max) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
    h.push(t); hits.set(k, h); next();
  };
}

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
async function user(req) {
  const s = auth.session(req); if (!s) return null;
  return db.get('SELECT u.id,u.org_id,u.email,u.name,u.role,u.prefs,o.name AS org_name FROM users u JOIN orgs o ON o.id=u.org_id WHERE u.id=?', [s.uid]);
}
const need = (role) => wrap(async (req, res, next) => {
  const u = await user(req); if (!u) return res.status(401).json({ error: 'Faça login.' });
  if (role === 'admin' && u.role !== 'admin') return res.status(403).json({ error: 'Somente administradores.' });
  req.user = u; next();
});
const audit = (u, action, target) => db.run('INSERT INTO audit_log (id,org_id,user_id,action,target) VALUES (?,?,?,?,?)', [id(), u.org_id, u.id, action, target || null]).catch(() => {});
const pubUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, org: { id: u.org_id, name: u.org_name }, prefs: db.json(u.prefs || '{}') });
const str = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max);

// ---------- Saúde ----------
app.get('/api/health', wrap(async (req, res) => { await db.get('SELECT 1 AS ok'); res.json({ ok: true, db: db.kind, time: now(), signup: ALLOW_SIGNUP }); }));

// ---------- Autenticação ----------
app.post('/api/auth/register', limiter(10, 15 * 60e3), wrap(async (req, res) => {
  const email = str(req.body.email, 160).toLowerCase(), name = str(req.body.name, 120), pw = String(req.body.password || '');
  const orgName = str(req.body.org_name, 160), code = str(req.body.invite_code, 20).toUpperCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
  if (pw.length < 8) return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' });
  if (!name) return res.status(400).json({ error: 'Informe seu nome.' });
  if (await db.get('SELECT id FROM users WHERE email=?', [email])) return res.status(409).json({ error: 'Este e-mail já tem conta.' });
  let org, role = 'membro';
  if (code) { org = await db.get('SELECT * FROM orgs WHERE invite_code=?', [code]); if (!org) return res.status(400).json({ error: 'Código de convite inválido.' }); }
  else {
    if (!ALLOW_SIGNUP) return res.status(403).json({ error: 'Cadastro de novas empresas desativado. Peça um código de convite.' });
    if (!orgName) return res.status(400).json({ error: 'Informe o nome da empresa ou um código de convite.' });
    org = { id: id(), name: orgName, invite_code: invite() }; role = 'admin';
  }
  const uid = id();
  await db.tx(async (t) => {
    if (role === 'admin') { await t.run('INSERT INTO orgs (id,name,invite_code) VALUES (?,?,?)', [org.id, org.name, org.invite_code]); await t.run('INSERT INTO org_settings (org_id,data) VALUES (?,?)', [org.id, {}]); }
    await t.run('INSERT INTO users (id,org_id,email,name,pass_hash,role,prefs) VALUES (?,?,?,?,?,?,?)', [uid, org.id, email, name, auth.hashPassword(pw), role, {}]);
  });
  auth.setSession(res, { uid }, SECURE);
  const row = await db.get('SELECT u.id,u.org_id,u.email,u.name,u.role,u.prefs,o.name AS org_name FROM users u JOIN orgs o ON o.id=u.org_id WHERE u.id=?', [uid]);
  await audit(row, 'register'); res.status(201).json({ user: pubUser(row) });
}));
app.post('/api/auth/login', limiter(12, 10 * 60e3), wrap(async (req, res) => {
  const email = str(req.body.email, 160).toLowerCase(), pw = String(req.body.password || '');
  const row = await db.get('SELECT u.*,o.name AS org_name FROM users u JOIN orgs o ON o.id=u.org_id WHERE u.email=?', [email]);
  if (!row || !auth.checkPassword(pw, row.pass_hash)) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  await db.run('UPDATE users SET last_login=NOW() WHERE id=?', [row.id]);
  auth.setSession(res, { uid: row.id }, SECURE); await audit(row, 'login'); res.json({ user: pubUser(row) });
}));
app.post('/api/auth/logout', (req, res) => { auth.clearSession(res, SECURE); res.json({ ok: true }); });
app.get('/api/me', need(), (req, res) => res.json({ user: pubUser(req.user) }));
app.put('/api/me/prefs', need(), wrap(async (req, res) => {
  const prefs = { ...db.json(req.user.prefs || '{}'), ...(req.body || {}) };
  await db.run('UPDATE users SET prefs=? WHERE id=?', [prefs, req.user.id]); res.json({ prefs });
}));
app.put('/api/me/password', need(), limiter(10, 15 * 60e3), wrap(async (req, res) => {
  const row = await db.get('SELECT pass_hash FROM users WHERE id=?', [req.user.id]);
  if (!auth.checkPassword(String(req.body.current || ''), row.pass_hash)) return res.status(400).json({ error: 'Senha atual incorreta.' });
  if (String(req.body.password || '').length < 8) return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' });
  await db.run('UPDATE users SET pass_hash=? WHERE id=?', [auth.hashPassword(String(req.body.password)), req.user.id]); res.json({ ok: true });
}));

// ---------- Empresa (organização) ----------
app.get('/api/org', need(), wrap(async (req, res) => {
  const o = await db.get('SELECT id,name,invite_code,created_at FROM orgs WHERE id=?', [req.user.org_id]);
  const members = await db.all('SELECT id,name,email,role,last_login FROM users WHERE org_id=? ORDER BY name', [req.user.org_id]);
  if (req.user.role !== 'admin') delete o.invite_code;
  res.json({ org: o, members });
}));
app.post('/api/org/invite/rotate', need('admin'), wrap(async (req, res) => { const c = invite(); await db.run('UPDATE orgs SET invite_code=? WHERE id=?', [c, req.user.org_id]); res.json({ invite_code: c }); }));
app.put('/api/org/members/:uid', need('admin'), wrap(async (req, res) => {
  const role = req.body.role === 'admin' ? 'admin' : 'membro';
  const r = await db.run('UPDATE users SET role=? WHERE id=? AND org_id=?', [role, req.params.uid, req.user.org_id]); res.json({ ok: r.changes > 0 });
}));
app.delete('/api/org/members/:uid', need('admin'), wrap(async (req, res) => {
  if (req.params.uid === req.user.id) return res.status(400).json({ error: 'Você não pode remover a si mesmo.' });
  const r = await db.run('DELETE FROM users WHERE id=? AND org_id=?', [req.params.uid, req.user.org_id]); res.json({ ok: r.changes > 0 });
}));

// ---------- Configurações da empresa (logos, dados, tema) ----------
app.get('/api/settings', need(), wrap(async (req, res) => {
  const r = await db.get('SELECT data,updated_at FROM org_settings WHERE org_id=?', [req.user.org_id]);
  res.json({ data: r ? db.json(r.data) : {}, updated_at: r ? r.updated_at : null });
}));
app.put('/api/settings', need(), wrap(async (req, res) => {
  const data = req.body && typeof req.body.data === 'object' ? req.body.data : {};
  const cur = await db.get('SELECT data FROM org_settings WHERE org_id=?', [req.user.org_id]);
  const merged = { ...(cur ? db.json(cur.data) : {}), ...data };
  if (cur) await db.run('UPDATE org_settings SET data=?,updated_at=NOW() WHERE org_id=?', [merged, req.user.org_id]);
  else await db.run('INSERT INTO org_settings (org_id,data) VALUES (?,?)', [req.user.org_id, merged]);
  const r = await db.get('SELECT updated_at FROM org_settings WHERE org_id=?', [req.user.org_id]);
  res.json({ ok: true, updated_at: r.updated_at });
}));

// ---------- Projetos ----------
const KINDS = ['comando', 'forca', 'primaria'];
app.get('/api/projects', need(), wrap(async (req, res) => {
  const q = str(req.query.q, 80);
  const rows = await db.all(`SELECT p.id,p.name,p.kind,p.created_at,p.updated_at,u.name AS updated_by_name
    FROM projects p LEFT JOIN users u ON u.id=p.updated_by WHERE p.org_id=? AND p.deleted_at IS NULL ${q ? 'AND LOWER(p.name) LIKE ?' : ''} ORDER BY p.updated_at DESC LIMIT 500`,
  q ? [req.user.org_id, `%${q.toLowerCase()}%`] : [req.user.org_id]);
  res.json({ projects: rows });
}));
app.post('/api/projects', need(), wrap(async (req, res) => {
  const data = req.body.data; if (!data || typeof data !== 'object' || !Array.isArray(data.loads)) return res.status(400).json({ error: 'Projeto inválido.' });
  const pid = id(), name = str(req.body.name || 'Projeto sem nome', 160), kind = KINDS.includes(data.kind) ? data.kind : 'comando';
  await db.tx(async (t) => {
    await t.run('INSERT INTO projects (id,org_id,name,kind,data,created_by,updated_by) VALUES (?,?,?,?,?,?,?)', [pid, req.user.org_id, name, kind, data, req.user.id, req.user.id]);
    await t.run('INSERT INTO project_versions (id,project_id,data,note,created_by) VALUES (?,?,?,?,?)', [id(), pid, data, 'Criação', req.user.id]);
  });
  await audit(req.user, 'project.create', pid);
  const row = await db.get('SELECT updated_at FROM projects WHERE id=?', [pid]);
  res.status(201).json({ id: pid, name, kind, updated_at: row.updated_at });
}));
async function ownProject(req, res) {
  const p = await db.get('SELECT * FROM projects WHERE id=? AND org_id=? AND deleted_at IS NULL', [req.params.id, req.user.org_id]);
  if (!p) { res.status(404).json({ error: 'Projeto não encontrado.' }); return null; } return p;
}
app.get('/api/projects/:id', need(), wrap(async (req, res) => {
  const p = await ownProject(req, res); if (!p) return;
  res.json({ id: p.id, name: p.name, kind: p.kind, data: db.json(p.data), updated_at: p.updated_at });
}));
app.put('/api/projects/:id', need(), wrap(async (req, res) => {
  const p = await ownProject(req, res); if (!p) return;
  const tms = (v) => new Date(v).getTime();
  if (req.body.base_updated_at && tms(req.body.base_updated_at) !== tms(p.updated_at) && !req.body.force)
    return res.status(409).json({ error: 'O projeto foi alterado por outra pessoa.', updated_at: p.updated_at });
  const data = req.body.data && typeof req.body.data === 'object' ? req.body.data : db.json(p.data);
  const name = req.body.name ? str(req.body.name, 160) : p.name, kind = KINDS.includes(data.kind) ? data.kind : p.kind;
  await db.tx(async (t) => {
    await t.run('UPDATE projects SET name=?,kind=?,data=?,updated_by=?,updated_at=NOW() WHERE id=?', [name, kind, data, req.user.id, p.id]);
    if (req.body.version) {
      await t.run('INSERT INTO project_versions (id,project_id,data,note,created_by) VALUES (?,?,?,?,?)', [id(), p.id, data, str(req.body.note || 'Salvo', 200), req.user.id]);
      const old = await t.all('SELECT id FROM project_versions WHERE project_id=? ORDER BY created_at DESC', [p.id]);
      for (const v of old.slice(MAX_VERSIONS)) await t.run('DELETE FROM project_versions WHERE id=?', [v.id]);
    }
  });
  const r = await db.get('SELECT updated_at FROM projects WHERE id=?', [p.id]);
  res.json({ ok: true, updated_at: r.updated_at });
}));
app.delete('/api/projects/:id', need(), wrap(async (req, res) => {
  const p = await ownProject(req, res); if (!p) return;
  await db.run('UPDATE projects SET deleted_at=NOW() WHERE id=?', [p.id]); await audit(req.user, 'project.delete', p.id); res.json({ ok: true });
}));
app.get('/api/projects/:id/versions', need(), wrap(async (req, res) => {
  const p = await ownProject(req, res); if (!p) return;
  res.json({ versions: await db.all('SELECT v.id,v.note,v.created_at,u.name AS by_name FROM project_versions v LEFT JOIN users u ON u.id=v.created_by WHERE v.project_id=? ORDER BY v.created_at DESC', [p.id]) });
}));
app.post('/api/projects/:id/restore/:vid', need(), wrap(async (req, res) => {
  const p = await ownProject(req, res); if (!p) return;
  const v = await db.get('SELECT data,created_at FROM project_versions WHERE id=? AND project_id=?', [req.params.vid, p.id]);
  if (!v) return res.status(404).json({ error: 'Versão não encontrada.' });
  await db.run('UPDATE projects SET data=?,updated_by=?,updated_at=NOW() WHERE id=?', [db.json(v.data), req.user.id, p.id]);
  await db.run('INSERT INTO project_versions (id,project_id,data,note,created_by) VALUES (?,?,?,?,?)', [id(), p.id, db.json(v.data), `Restaurado da versão de ${v.created_at}`, req.user.id]);
  res.json({ ok: true, data: db.json(v.data) });
}));

// ---------- Front-end ----------
const pub = path.join(__dirname, '..', 'public');
app.use('/vendor', express.static(path.join(pub, 'vendor'), { maxAge: '30d', immutable: true }));
app.use(express.static(pub, { index: 'index.html', maxAge: '5m' }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
app.use((err, req, res, next) => { console.error('[erro]', err); res.status(err.type === 'entity.too.large' ? 413 : 500).json({ error: err.type === 'entity.too.large' ? 'Arquivo grande demais.' : 'Erro interno.' }); });

migrate().then(() => app.listen(PORT, () => console.log(`[app] Montador de painéis em http://localhost:${PORT} (banco: ${db.kind})`)))
  .catch((e) => { console.error('[db] falha ao iniciar', e); process.exit(1); });
module.exports = app;
