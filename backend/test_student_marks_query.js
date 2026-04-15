const { pool } = require('./src/config/db');

async function testQuery() {
    try {
        console.log('Connecting...');
        const client = await pool.connect();

        // Let's manually run what the API runs for student-all
        const studentRes = await client.query(
            `SELECT * FROM students 
             WHERE admission_no ILIKE $1 AND (status IS NULL OR status != 'Deleted')`,
            ['DA9970']
        );

        if (studentRes.rows.length === 0) {
            console.log('Student not found!');
            client.release();
            return;
        }

        const student = studentRes.rows[0];
        console.log('Found student:', student.name);

        const marksQuery = `
             SELECT DISTINCT ON (m.id) 
                    m.marks_obtained, sub.name as subject_name, et.name as exam_name, 
                    COALESCE(es.max_marks, et.max_marks, 100) as max_marks
             FROM marks m
             JOIN subjects sub ON m.subject_id = sub.id
             JOIN exam_types et ON m.exam_type_id = et.id
             LEFT JOIN exam_schedules es ON es.subject_id = m.subject_id 
                AND es.exam_type_id = m.exam_type_id 
                AND es.school_id = m.school_id
                AND (es.class_id = m.class_id OR es.class_id IS NULL)
                AND (es.section_id = m.section_id OR es.section_id IS NULL)
             WHERE m.student_id = $1
             ORDER BY m.id, et.id, sub.name
        `;

        const marksRes = await client.query(marksQuery, [student.id]);
        console.log('Query success! Returned marks:', marksRes.rows.length);

        client.release();
    } catch (e) {
        console.error('ERROR!!', e);
    } finally {
        process.exit();
    }
}
testQuery();
