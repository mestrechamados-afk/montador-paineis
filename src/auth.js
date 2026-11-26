'use strict';
// Senhas com scrypt e sessão em cookie assinado (HMAC-SHA256), sem dependências externas.
const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET;
const usesPg = /^postgres/i.test(process.env.DATABASE_URL || '');
if (!SECRET || SECRET.length < 16) {
  // Em produção (ou com banco PostgreSQL) o segredo é obrigatório: sem ele, todos seriam deslogados a cada reinício
  if (process.env.NODE_ENV === 'production' || usesPg) { console.error('[auth] defina SESSION_SECRET (mínimo 16 caracteres)'); process.exit(1); }
  console.warn('[auth] SESSION_SECRET ausente: usando segredo temporário de desenvolvimento');
}
const KEY = SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE = 'mp_sess';
const MAX_AGE = Number(process.env.SESSION_DAYS || 14) * 86400;

const b64u = (b) => Buffer.from(b).toString('base64url');
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
// Hash fictício: o login de um e-mail inexistente gasta o mesmo tempo (não revela quais e-mails têm conta)
const DUMMY = hashPassword(crypto.randomBytes(12).toString('hex'));
function checkPassword(pw, stored) {
  const [alg, salt, hash] = String(stored || DUMMY).split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const ref = Buffer.from(hash, 'hex');
  const h = crypto.scryptSync(String(pw), Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return ref.length === h.length && crypto.timingSafeEqual(h, ref) && stored != null;
}
function sign(payload) {
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  const mac = crypto.createHmac('sha256', KEY).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function verify(tok) {
  if (!tok || !tok.includes('.')) return null;
  const [body, mac] = tok.split('.');
  const exp = crypto.createHmac('sha256', KEY).update(body).digest('base64url');
  if (mac.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(exp))) return null;
  let data; try { data = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
  if (!data.exp || data.exp < Date.now() / 1000) return null;
  return data;
}
function readCookie(req, name) {
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) { const [k, ...v] = part.trim().split('='); if (k === name) return decodeURIComponent(v.join('=')); }
  return null;
}
function setSession(res, data, secure) {
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(sign(data))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`);
}
function clearSession(res, secure) { res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`); }
function session(req) { return verify(readCookie(req, COOKIE)); }

module.exports = { hashPassword, checkPassword, setSession, clearSession, session };
