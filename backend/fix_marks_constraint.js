const { pool } = require('./src/config/db');

async function fixMarksConstraint() {
    const client = await pool.connect();
    try {
        console.log('🔧 Fixing Marks Table Constraint...');
        await client.query('BEGIN');

        // 1. Remove duplicate marks if any (Matched by uniqueness criteria)
        // Keep the one with the highest ID (latest)
        console.log('🧹 Cleaning up potential duplicate marks before adding constraint...');
        await client.query(`
            DELETE FROM marks a USING marks b
            WHERE a.id < b.id
            AND a.school_id = b.school_id
            AND a.student_id = b.student_id
            AND a.subject_id = b.subject_id
            AND a.exam_type_id = b.exam_type_id
            AND a.year = b.year;
        `);

        // 2. Drop existing constraint if it has a wrong name (optional, safety check)
        // We try to add the correct one.
        console.log('➕ Adding UNIQUE constraint...');
        await client.query(`
            ALTER TABLE marks 
            ADD CONSTRAINT marks_unique_entry 
            UNIQUE (school_id, student_id, subject_id, exam_type_id, year);
        `);

        console.log('✅ Constraint added successfully!');
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '42710') {
            console.log('✅ Constraint already exists (Skipping).');
        } else {
            console.error('❌ Error fixing constraint:', error);
        }
    } finally {
        client.release();
        process.exit();
    }
}

fixMarksConstraint();
