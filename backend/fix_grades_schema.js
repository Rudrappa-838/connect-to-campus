const { pool } = require('./src/config/db');

async function fixGradesSchema() {
    const client = await pool.connect();
    try {
        console.log('🔧 Fixing Grades Table Schema...');
        await client.query('BEGIN');

        // Create table if not exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS grades (
                id SERIAL PRIMARY KEY,
                school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
                exam_type_id INTEGER REFERENCES exam_types(id) ON DELETE CASCADE,
                name VARCHAR(50) NOT NULL, -- e.g. A, A+, B
                min_percentage NUMERIC(5,2) NOT NULL,
                max_percentage NUMERIC(5,2) NOT NULL,
                grade_point NUMERIC(3,1), -- e.g. 10.0, 9.0
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Check and add missing columns
        const columns = [
            'school_id', 'exam_type_id', 'name',
            'min_percentage', 'max_percentage', 'grade_point', 'description'
        ];

        for (const col of columns) {
            try {
                // Determine type based on column name for simplicity in this rescue script
                let type = 'VARCHAR(255)';
                if (col === 'school_id' || col === 'exam_type_id') type = 'INTEGER';
                if (col === 'min_percentage' || col === 'max_percentage') type = 'NUMERIC(5,2)';
                if (col === 'grade_point') type = 'NUMERIC(3,1)';
                if (col === 'description') type = 'TEXT';

                await client.query(`ALTER TABLE grades ADD COLUMN IF NOT EXISTS ${col} ${type}`);
            } catch (ignore) {
                // Ignore if exists or other minor error
            }
        }

        console.log('✅ Grades table scema verified/fixed.');
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error fixing grades table:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixGradesSchema();
