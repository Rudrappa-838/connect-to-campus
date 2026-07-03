const { pool } = require('./src/config/db'); 
pool.query(`
  SELECT table_name, column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name IN ('classes', 'sections', 'students')
`).then(res => { 
  console.log(res.rows); 
  pool.end(); 
});
