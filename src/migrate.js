'use strict';
const { db, migrate } = require('./db');
migrate().then(() => db.close()).then(() => console.log('[db] ok')).catch((e) => { console.error(e); process.exit(1); });
