const { pool } = require('./src/config/db');
pool.query(`
    SELECT tc.table_name, kcu.column_name, rc.delete_rule 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
    JOIN information_schema.referential_constraints AS rc ON tc.constraint_name = rc.constraint_name 
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'subjects';
`).then(res => { console.log("Subjects FKs:", res.rows); pool.end(); });
