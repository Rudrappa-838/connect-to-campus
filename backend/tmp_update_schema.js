const { pool } = require('./src/config/db');
pool.query("ALTER TABLE announcements ADD COLUMN IF NOT EXISTS attachment_url TEXT, ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(100);").then(() => { console.log('Columns added'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
