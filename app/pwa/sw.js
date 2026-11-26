/* Service worker do Montador: permite instalar o app e abre mais rápido.
   Projetos e dados da API NUNCA são guardados em cache (sempre vêm do servidor). */
const VERSION = '__BUILD__';
const STATIC = 'montador-estatico-' + VERSION;
const PRECACHE = ['/', '/cloud.js', '/pwa.js', '/icons/icon-192.png', '/icons/icon-512.png',
  '/vendor/three.min.js', '/vendor/jspdf.umd.min.js', '/vendor/jspdf.plugin.autotable.min.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('montador-') && k !== STATIC).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return; // API sempre direto no servidor
  if (e.request.mode === 'navigate' || u.pathname === '/' || u.pathname.endsWith('.html') || u.pathname === '/cloud.js' || u.pathname === '/pwa.js') {
    // página e scripts do app: rede primeiro (sempre a versão mais nova), cache só se estiver sem internet
    e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(STATIC).then((c) => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/'))));
    return;
  }
  // bibliotecas e ícones: cache primeiro
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(STATIC).then((c) => c.put(e.request, cp)); } return res; })));
});
