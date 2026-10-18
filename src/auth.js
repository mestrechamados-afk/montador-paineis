'use strict';
// Senhas com scrypt e sessão em cookie assinado (HMAC-SHA256), sem dependências externas.
const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET;
if (!SECRET || SECRET.length < 16) {
  if (process.env.NODE_ENV === 'production') { console.error('[auth] defina SESSION_SECRET (mínimo 16 caracteres)'); process.exit(1); }
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
function checkPassword(pw, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const h = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
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
  const data = JSON.parse(Buffer.from(body, 'base64url').toString());
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
