const { pool } = require('./src/config/db.js');
pool.query('SELECT employee_id, email FROM teachers WHERE employee_id ILIKE \'%dadt%\'').then(res => { console.log('Teachers:', res.rows); pool.end(); }).catch(err => { console.error(err); pool.end(); });
