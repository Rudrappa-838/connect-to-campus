
const { pool } = require('./src/config/db');

async function testDelete() {
    const client = await pool.connect();
    try {
        console.log('Creating dummy student...');
        // 1. Create Dummy Student
        const res = await client.query(`
            INSERT INTO students (name, admission_no, school_id, status)
            VALUES ('Delete Test', 'DEL001', 1, 'Active')
            RETURNING id
        `);
        const studentId = res.rows[0].id;
        console.log('Created student ID:', studentId);

        // 2. Add some Marks (to test referencing)
        try {
            await client.query(`
                INSERT INTO marks (student_id, subject_id, exam_id, marks_obtained, max_marks)
                VALUES ($1, 1, 1, 50, 100)
            `, [studentId]);
            console.log('Added dummy marks.');
        } catch (e) {
            console.log('Skipping marks creation (tables might differ):', e.message);
        }

        // 3. Try Permanent Delete Logic MANUALLY (Mirroring Controller)
        await client.query('BEGIN');

        // Update Marks to remove link
        console.log('Preserving marks...');
        await client.query(`
            UPDATE marks 
            SET deleted_student_name = 'Delete Test', 
                deleted_student_admission_no = 'DEL001', 
                student_id = NULL 
            WHERE student_id = $1
        `, [studentId]);

        // Delete other tables
        const tables = ['attendance', 'student_fees', 'fee_payments'];
        for (const t of tables) {
            try {
                await client.query(`DELETE FROM ${t} WHERE student_id = $1`, [studentId]);
            } catch (e) { console.log(`Table ${t} skipped: ${e.message}`); }
        }

        // Delete Student
        console.log('Deleting student row...');
        await client.query('DELETE FROM students WHERE id = $1', [studentId]);

        await client.query('COMMIT');
        console.log('✅ TEST SUCCESS: Student deleted without error.');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ TEST FAILED:', err);
        console.error('Error Code:', err.code);
        console.error('Error Detail:', err.detail);
        console.error('Error Table:', err.table);
        console.error('Error Constraint:', err.constraint);
    } finally {
        client.release();
        pool.end();
    }
}

testDelete();
