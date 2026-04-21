const { pool } = require('./src/config/db');
pool.query("ALTER TABLE staff ADD COLUMN IF NOT EXISTS hostel_access BOOLEAN DEFAULT FALSE;")
.then(() => { console.log('Hostel Column added'); process.exit(0); })
.catch(e => { console.error(e); process.exit(1); });
