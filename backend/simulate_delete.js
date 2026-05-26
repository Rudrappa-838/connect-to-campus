const { pool } = require('./src/config/db');

async function simulateDelete() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Find a valid school
        const schoolRes = await client.query('SELECT id FROM schools LIMIT 1');
        const schoolId = schoolRes.rows[0].id;

        // 1. Create dummy class
        const classRes = await client.query('INSERT INTO classes (school_id, name) VALUES ($1, $2) RETURNING id', [schoolId, 'Dummy Class']);
        const classId = classRes.rows[0].id;

        // 2. Create dummy section
        const secRes = await client.query('INSERT INTO sections (class_id, name) VALUES ($1, $2) RETURNING id', [classId, 'A']);
        const sectionId = secRes.rows[0].id;

        // 3. Create dummy subject
        const subRes = await client.query('INSERT INTO subjects (class_id, name) VALUES ($1, $2) RETURNING id', [classId, 'Math']);
        const subjectId = subRes.rows[0].id;

        // 4. Create dummy fee_structures
        await client.query('INSERT INTO fee_structures (school_id, class_id, fee_name, amount, due_date) VALUES ($1, $2, $3, $4, CURRENT_DATE)', [schoolId, classId, 'Test Fee', 100]);

        // 5. Create dummy exam_schedules
        await client.query('INSERT INTO exam_schedules (school_id, class_id, section_id, subject_id, exam_name, exam_date, start_time, end_time) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, CURRENT_TIME, CURRENT_TIME)', [schoolId, classId, sectionId, subjectId, 'Test Exam']);

        // 6. Create dummy announcements
        await client.query('INSERT INTO announcements (school_id, class_id, section_id, title, message) VALUES ($1, $2, $3, $4, $5)', [schoolId, classId, sectionId, 'Test Title', 'Test Msg']);

        // 7. Create dummy student_promotions
        // We need a student
        const studentRes = await client.query('INSERT INTO students (school_id, class_id, section_id, name, admission_number) VALUES ($1, $2, $3, $4, $5) RETURNING id', [schoolId, classId, sectionId, 'Test Student', 'TEST1234']);
        const studentId = studentRes.rows[0].id;
        // Wait, student_promotions needs a from_class_id and to_class_id
        // Let's create another dummy class for to_class_id
        const classRes2 = await client.query('INSERT INTO classes (school_id, name) VALUES ($1, $2) RETURNING id', [schoolId, 'Dummy Class 2']);
        const classId2 = classRes2.rows[0].id;
        
        await client.query('INSERT INTO student_promotions (student_id, from_class_id, to_class_id, promotion_date) VALUES ($1, $2, $3, CURRENT_DATE)', [studentId, classId, classId2]);

        console.log("Dummy data created successfully. Now simulating class deletion logic...");

        // Simulate the exact logic from schoolController.js
        const classToDelete = { id: classId, name: 'Dummy Class' };
        
        // Update students
        await client.query(
            `UPDATE students 
             SET status = 'Unassigned', 
                 class_name = 'Unassigned - Previously: ' || COALESCE(class_name, 'Unknown Class') || ' ' || COALESCE(section_name, 'Unknown Section'),
                 section_name = 'N/A'
             WHERE school_id = $1 AND class_id = $2 AND status != 'Deleted'`,
            [schoolId, classToDelete.id]
        );

        // Clean up class dependencies that block deletion
        await client.query('DELETE FROM student_promotions WHERE from_class_id = $1 OR to_class_id = $1', [classToDelete.id]);
        await client.query('DELETE FROM announcements WHERE class_id = $1', [classToDelete.id]);
        await client.query('DELETE FROM exam_schedules WHERE class_id = $1', [classToDelete.id]);
        await client.query('DELETE FROM fee_structures WHERE class_id = $1', [classToDelete.id]);

        // Delete sections and subjects first (foreign key constraints)
        await client.query('DELETE FROM sections WHERE class_id = $1', [classToDelete.id]);
        await client.query('DELETE FROM subjects WHERE class_id = $1', [classToDelete.id]);

        // Delete the class
        await client.query('DELETE FROM classes WHERE id = $1', [classToDelete.id]);

        console.log("Class deletion simulated successfully! No constraints failed.");

        await client.query('ROLLBACK');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Simulation Failed! Error:', e.message);
        console.error('Detail:', e.detail);
        console.error('Constraint:', e.constraint);
    } finally {
        client.release();
        pool.end();
    }
}

simulateDelete();
