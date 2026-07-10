const { pool } = require('./src/config/db.js');
pool.query(`SELECT u.* FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE LOWER(u.email) = ANY($1::text[]) AND (u.school_id IS NULL OR s.status IS NULL OR s.status != 'Deleted') ORDER BY u.id DESC`, [['dadt2931', 'DADT2931', 'DADT2931@teacher.school.com', 'dadt2931@teacher.school.com']])
.then(res => { console.log('Rows:', res.rows); pool.end(); })
.catch(err => { console.error(err); pool.end(); });
