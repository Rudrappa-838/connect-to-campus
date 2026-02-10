
const { pool } = require('./src/config/db');

async function fixMarksNullable() {
    try {
        const client = await pool.connect();

        console.log('Altering marks table to allow student_id to be NULL...');
        await client.query('ALTER TABLE marks ALTER COLUMN student_id DROP NOT NULL');

        console.log('✅ Successfully updated marks table schema.');
        client.release();
    } catch (err) {
        console.error('❌ Error updating schema:', err.message);
    } finally {
        await pool.end();
    }
}

fixMarksNullable();
