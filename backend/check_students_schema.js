const { pool } = require('./src/config/db');

async function checkStudentsSchema() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'sections' 
            ORDER BY ordinal_position
        `);

        const cols = result.rows.map(r => r.column_name);
        console.log('Columns in sections table:', cols.join(', '));

        // Find school_id specifically
        const hasSchoolId = cols.includes('school_id');
        console.log('Has school_id:', hasSchoolId);
    } finally {
        await pool.end();
    }
}

checkStudentsSchema();
