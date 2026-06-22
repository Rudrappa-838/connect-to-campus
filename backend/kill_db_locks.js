const { pool } = require('./src/config/db');
pool.query(`
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE pid != pg_backend_pid() 
  AND usename = current_user
`)
  .then(() => { console.log('Killed all other connections for current user'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
