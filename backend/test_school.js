const { pool } = require('./src/config/db'); 
pool.query(`SELECT id, name FROM schools WHERE name ILIKE '%VISHWA%'`)
  .then(res => { console.log(res.rows); pool.end(); })
  .catch(err => { console.error(err); pool.end(); });
