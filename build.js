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
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(R('app', 'cloud.js'), path.join(out, 'cloud.js'));
console.log('[build] public/ gerado:', fs.readdirSync(out).join(', '));
