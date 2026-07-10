const { pool } = require('./src/config/db.js');
pool.query('SELECT id, status FROM schools').then(res => { console.log('Schools:', res.rows); pool.end(); }).catch(err => { console.error(err); pool.end(); });
