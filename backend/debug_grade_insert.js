const { pool } = require('./src/config/db');

async function debugGradeInsert() {
    try {
        console.log('🐞 Debugging Grade Insert...');
        const client = await pool.connect();

        // 1. Get a school
        const schoolRes = await client.query('SELECT id FROM schools LIMIT 1');
        if (schoolRes.rows.length === 0) {
            console.log('No schools found.');
            return;
        }
        const school_id = schoolRes.rows[0].id;

        // 2. Get an exam type
        const examRes = await client.query('SELECT id FROM exam_types WHERE school_id = $1 LIMIT 1', [school_id]);
        if (examRes.rows.length === 0) {
            console.log('No exam types found for school ' + school_id);
            // Create one for testing if needed, or just warn
        }
        const exam_type_id = examRes.rows.length > 0 ? examRes.rows[0].id : null;

        console.log(`Using School ID: ${school_id}, Exam Type ID: ${exam_type_id}`);

        if (!exam_type_id) {
            console.log('Skipping insert test due to missing exam type.');
            return;
        }

        try {
            await client.query('BEGIN');

            // Simulate the controller's logic
            const grades = [
                { name: 'A1', min_percentage: 91, max_percentage: 100, grade_point: 10.0, description: 'Outstanding' }
            ];

            for (const grade of grades) {
                console.log('Attempting insert for:', grade);
                await client.query(
                    `INSERT INTO grades (school_id, exam_type_id, name, min_percentage, max_percentage, grade_point, description)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [school_id, exam_type_id, grade.name, grade.min_percentage, grade.max_percentage, grade.grade_point, grade.description]
                );
            }

            console.log('✅ Insert Successful (Rolling back now)');
            await client.query('ROLLBACK');

        } catch (e) {
            console.error('❌ INSERT FAILED:', e);
            await client.query('ROLLBACK');
        } finally {
            client.release();
        }

    } catch (e) {
        console.error('Script Error:', e);
    } finally {
        pool.end();
    }
}

debugGradeInsert();
