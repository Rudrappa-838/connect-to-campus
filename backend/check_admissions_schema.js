const { pool } = require('./src/config/db');

async function checkSchema() {
    try {
        console.log('Checking admissions_enquiries schema...');
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'admissions_enquiries';
        `);
        console.table(res.rows);
        process.exit(0);
    } catch (error) {
        console.error('Error checking schema:', error);
        process.exit(1);
    }
}

checkSchema();
