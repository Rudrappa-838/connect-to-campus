const { pool } = require('./src/config/db');
pool.query(`
    SELECT table_name 
    FROM information_schema.key_column_usage 
    WHERE constraint_name IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY'
    ) 
    AND column_name = 'class_id';
`).then(res => { 
    console.log(res.rows); 
    pool.end(); 
});
