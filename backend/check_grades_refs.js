const { pool } = require('./src/config/db');

async function check() {
    try {
        console.log('Checking foreign key references to "grades" table...');
        const res = await pool.query(`
            SELECT 
                conname AS constraint_name, 
                conrelid::regclass AS table_name, 
                confrelid::regclass AS referenced_table
            FROM pg_constraint 
            WHERE confrelid = 'grades'::regclass
        `);

        if (res.rows.length === 0) {
            console.log('✅ No tables reference the "grades" table. DELETE should be safe.');
        } else {
            console.log('❌ The following tables reference "grades":');
            console.table(res.rows);
            console.log('⚠️ Attempting to DELETE from "grades" will fail due to these dependencies.');
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
