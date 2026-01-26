require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./src/config/db');

const fixTable = async () => {
    console.log('🛠️ Fixing Student Promotions Table...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Drop the potentially corrupted/old table
        console.log('1. Dropping old table...');
        await client.query('DROP TABLE IF EXISTS student_promotions');

        // 2. Re-create it fresh with ALL columns
        console.log('2. Re-creating table...');
        await client.query(`
            CREATE TABLE student_promotions (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                from_class_id INTEGER REFERENCES classes(id),
                from_section_id INTEGER REFERENCES sections(id),
                to_class_id INTEGER REFERENCES classes(id),
                to_section_id INTEGER REFERENCES sections(id),
                from_academic_year VARCHAR(20) NOT NULL,
                to_academic_year VARCHAR(20) NOT NULL,
                promoted_by INTEGER REFERENCES users(id),
                promoted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT
            )
        `);

        // 3. Re-create indexes
        console.log('3. Re-creating indexes...');
        await client.query(`CREATE INDEX idx_promotions_student ON student_promotions(student_id)`);
        await client.query(`CREATE INDEX idx_promotions_school ON student_promotions(school_id)`);

        await client.query('COMMIT');
        console.log('✅ FIXED! Table is now fresh and correct.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', error);
    } finally {
        client.release();
        pool.end();
    }
};

fixTable();
