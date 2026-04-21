const { pool } = require('./src/config/db');
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'announcements';")
  .then(res => { console.dir(res.rows); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); })
