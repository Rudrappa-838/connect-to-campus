const { pool } = require('./src/config/db');

async function fixGradesDataType() {
    const client = await pool.connect();
    try {
        console.log('🔧 Fixing Grades Table Data Types...');

        // Check current data type (optional, but good for logging)
        const check = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'grades' AND column_name IN ('min_percentage', 'max_percentage', 'grade_point');
        `);
        console.log('Current types:', check.rows);

        await client.query('BEGIN');

        // Alter columns to allow decimals
        // USING clause is needed if there's existing data that needs conversion, 
        // though integer -> numeric is usually implicit. adding it for safety.

        console.log('Changing min_percentage to NUMERIC(5,2)...');
        await client.query(`
            ALTER TABLE grades 
            ALTER COLUMN min_percentage TYPE NUMERIC(5,2);
        `);

        console.log('Changing max_percentage to NUMERIC(5,2)...');
        await client.query(`
            ALTER TABLE grades 
            ALTER COLUMN max_percentage TYPE NUMERIC(5,2);
        `);

        console.log('Changing grade_point to NUMERIC(3,1)...');
        await client.query(`
            ALTER TABLE grades 
            ALTER COLUMN grade_point TYPE NUMERIC(3,1);
        `);

        await client.query('COMMIT');
        console.log('✅ Grades table data types updated successfully!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error fixing grades table:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixGradesDataType();
