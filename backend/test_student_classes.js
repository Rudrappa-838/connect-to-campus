const { pool } = require('./src/config/db'); 
pool.query(`
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN class_id IS NULL THEN 1 ELSE 0 END) as null_class_id,
    SUM(CASE WHEN class_name IS NOT NULL THEN 1 ELSE 0 END) as has_class_name
  FROM students
`).then(res => { 
  console.log(res.rows); 
  pool.end(); 
});
