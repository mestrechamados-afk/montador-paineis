'use strict';
// Gera public/ a partir de app/app.html (o mesmo HTML do app) + bibliotecas locais em public/vendor.
const fs = require('fs');
const path = require('path');
const R = (...p) => path.join(__dirname, ...p);
const out = R('public'), vend = R('public', 'vendor');
fs.mkdirSync(vend, { recursive: true });

const libs = {
  'three.min.js': 'three/build/three.min.js',
  'jspdf.umd.min.js': 'jspdf/dist/jspdf.umd.min.js',
  'jspdf.plugin.autotable.min.js': 'jspdf-autotable/dist/jspdf.plugin.autotable.min.js',
  'exceljs.min.js': 'exceljs/dist/exceljs.min.js',
  'pdf.min.js': 'pdfjs-dist/build/pdf.min.js',
  'pdf.worker.min.js': 'pdfjs-dist/build/pdf.worker.min.js',
};
for (const [name, rel] of Object.entries(libs)) {
  const src = R('node_modules', rel);
  if (!fs.existsSync(src)) { console.error(`[build] faltando ${rel} — rode "npm install"`); process.exit(1); }
  fs.copyFileSync(src, path.join(vend, name));
}

let html = fs.readFileSync(R('app', 'app.html'), 'utf8');
const cdn = 'https://cdnjs.cloudflare.com/ajax/libs/';
const swaps = [
  ['<script src="' + cdn + 'three.js/r128/three.min.js"></script>',
    '<script src="/vendor/three.min.js"></script>\n<script src="/vendor/jspdf.umd.min.js"></script>\n<script src="/vendor/jspdf.plugin.autotable.min.js"></script>\n<script src="/vendor/exceljs.min.js" defer></script>'],
  [cdn + 'jspdf/2.5.1/jspdf.umd.min.js', '/vendor/jspdf.umd.min.js'],
  [cdn + 'jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', '/vendor/jspdf.plugin.autotable.min.js'],
  [cdn + 'exceljs/4.4.0/exceljs.min.js', '/vendor/exceljs.min.js'],
  [cdn + 'pdf.js/3.11.174/pdf.min.js', '/vendor/pdf.min.js'],
  [cdn + 'pdf.js/3.11.174/pdf.worker.min.js', '/vendor/pdf.worker.min.js'],
  [cdn + 'three.js/r128/three.min.js', '/vendor/three.min.js'],
];
for (const [a, b] of swaps) html = html.split(a).join(b);
if (!html.includes('name="app-cloud"')) html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="app-cloud" content="1">');
if (!html.includes('/cloud.js')) html = html.replace(/<\/body>\s*<\/html>\s*$/, '<script src="/cloud.js"></script>\n</body>\n</html>\n');
// --- Aplicativo instalável (PWA): manifesto, ícones e service worker ---
const head = `<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#2F6BDB">
<meta name="application-name" content="Montador">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Montador">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`;
if (!html.includes('rel="manifest"')) html = html.replace('<meta name="app-cloud" content="1">', '<meta name="app-cloud" content="1">\n' + head);
if (!html.includes('/pwa.js')) html = html.replace('<script src="/cloud.js"></script>', '<script src="/cloud.js"></script>\n<script src="/pwa.js"></script>');
const pwa = R('app', 'pwa'), icons = path.join(out, 'icons');
fs.mkdirSync(icons, { recursive: true });
for (const f of fs.readdirSync(pwa)) {
  if (/\.(png|svg)$/.test(f)) fs.copyFileSync(path.join(pwa, f), path.join(icons, f));
}
fs.copyFileSync(path.join(pwa, 'favicon.ico'), path.join(out, 'favicon.ico'));
fs.copyFileSync(path.join(pwa, 'manifest.webmanifest'), path.join(out, 'manifest.webmanifest'));
fs.copyFileSync(path.join(pwa, 'pwa.js'), path.join(out, 'pwa.js'));
const build = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync(path.join(pwa, 'sw.js'), 'utf8').replace('__BUILD__', build));
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(R('app', 'cloud.js'), path.join(out, 'cloud.js'));
console.log('[build] public/ gerado:', fs.readdirSync(out).join(', '));
