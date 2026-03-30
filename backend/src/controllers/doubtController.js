const { pool } = require('../config/db');

// Helper to find student ID
const getStudentId = async (email, school_id) => {
    console.log('Looking for student with email:', email);

    // Try 1: Direct email match (no school_id filter since column doesn't exist)
    let studentRes = await pool.query('SELECT id, admission_no FROM students WHERE email = $1', [email]);
    if (studentRes.rows.length > 0) {
        console.log('Found student by email:', studentRes.rows[0]);
        return studentRes.rows[0].id;
    }

    // Try 2: Check if email looks like an admission number (e.g., STU001@school.com or just STU001)
    const emailParts = email.split('@');
    const potentialAdmissionNo = emailParts[0]; // Get part before @

    studentRes = await pool.query('SELECT id, admission_no FROM students WHERE LOWER(admission_no) = LOWER($1)', [potentialAdmissionNo]);
    if (studentRes.rows.length > 0) {
        console.log('Found student by admission number:', studentRes.rows[0]);
        return studentRes.rows[0].id;
    }

    // Try 3: If the entire email might be the admission number (for backward compatibility)
    studentRes = await pool.query('SELECT id, admission_no FROM students WHERE LOWER(admission_no) = LOWER($1)', [email]);
    if (studentRes.rows.length > 0) {
        console.log('Found student by admission number (full email):', studentRes.rows[0]);
        return studentRes.rows[0].id;
    }

    console.error('Student NOT found. Tried:', { email, potentialAdmissionNo });
    return null;
};

// Create a new doubt (Student Only)
exports.createDoubt = async (req, res) => {
    try {
        // Log the entire user object from JWT to debug
        console.log('=== DOUBT CREATION DEBUG ===');
        console.log('Full req.user:', JSON.stringify(req.user, null, 2));

        // Handle both camelCase (schoolId) and snake_case (school_id) from JWT
        const school_id = req.user.schoolId || req.user.school_id;
        const email = req.user.email;
        const role = req.user.role;
        let { teacher_id, subject_id, question } = req.body;

        console.log('Extracted values:', { email, school_id, role });

        if (!school_id) {
            console.error('❌ school_id is missing from JWT token');
            console.error('Available keys in req.user:', Object.keys(req.user));
            return res.status(400).json({ message: 'School information is missing. Please log out and log in again.' });
        }

        if (!question || !question.trim()) {
            return res.status(400).json({ message: 'Question is required' });
        }

        // Get student_id using email and school_id
        console.log('Looking up student with:', { email, school_id });
        const student_id = await getStudentId(email, school_id);

        if (!student_id) {
            console.error(`❌ Student not found - email: ${email}, school_id: ${school_id}`);
            return res.status(404).json({
                message: `Student profile not found. Your login email (${email}) doesn't match any student records. Please contact your administrator.`
            });
        }

        console.log('✅ Found student_id:', student_id);

        // If subject_id is missing but request has 'subject' name (Mobile App case)
        if (!subject_id && req.body.subject) {
            const subjectName = req.body.subject;
            // Try to find subject by name (without school_id filter)
            const subRes = await pool.query('SELECT id FROM subjects WHERE lower(name) = lower($1) LIMIT 1', [subjectName]);
            if (subRes.rows.length > 0) {
                subject_id = subRes.rows[0].id;
                console.log('Found subject by name:', subjectName);

                // Find a teacher for this subject (without school_id filter)
                let teacherRes = await pool.query('SELECT id FROM teachers WHERE lower(subject_specialization) = lower($1) LIMIT 1', [subjectName]);
                if (teacherRes.rows.length > 0) {
                    teacher_id = teacherRes.rows[0].id;
                    console.log('Found teacher by specialization:', subjectName);
                }
            }
        }

        // If subject_id is missing, try to resolve it from Teacher's Specialization
        if (!subject_id && teacher_id) {
            const teacherRes = await pool.query('SELECT subject_specialization FROM teachers WHERE id = $1', [teacher_id]);
            if (teacherRes.rows.length > 0) {
                const specialization = teacherRes.rows[0].subject_specialization;
                if (specialization) {
                    // Try to find subject by specialization name (without school_id filter)
                    const subjectRes = await pool.query('SELECT id FROM subjects WHERE lower(name) = lower($1) LIMIT 1', [specialization]);
                    if (subjectRes.rows.length > 0) {
                        subject_id = subjectRes.rows[0].id;
                        console.log('Found subject from teacher specialization:', specialization);
                    }
                }
            }
        }

        console.log('Inserting doubt:', { student_id, teacher_id, subject_id });

        const result = await pool.query(
            `INSERT INTO doubts (student_id, teacher_id, subject_id, question) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [student_id, teacher_id || null, subject_id || null, question]
        );

        const newDoubt = result.rows[0];

        // --- NOTIFICATION LOGIC ---
        if (teacher_id) {
            try {
                // Find the user_id linked to this teacher to send notification
                const teacherUserRes = await pool.query(
                    `SELECT u.id, u.email 
                     FROM users u 
                     JOIN teachers t ON u.email = t.email 
                     WHERE t.id = $1 AND u.role = 'TEACHER'`,
                    [teacher_id]
                );

                if (teacherUserRes.rows.length > 0) {
                    const userId = teacherUserRes.rows[0].id;
                    const studentNameRes = await pool.query('SELECT name FROM students WHERE id = $1', [student_id]);
                    const studentName = studentNameRes.rows[0]?.name || 'A student';

                    const { sendPushNotification } = require('../services/notificationService');
                    const message = `New Doubt from ${studentName}: "${question.substring(0, 30)}${question.length > 30 ? '...' : ''}"`;

                    await pool.query(
                        `INSERT INTO notifications (user_id, title, message, type, link) 
                         VALUES ($1, $2, $3, 'DOUBT', '/teacher-dashboard?tab=doubts')`,
                        [userId, 'New Student Doubt', message]
                    );

                    // Added: Real Push Notification for Teacher
                    await sendPushNotification(userId, 'New Student Doubt', message, 'Teacher');
                    console.log('Notification sent to teacher:', userId);
                }
            } catch (notifError) {
                console.error('Failed to send doubt notification:', notifError);
                // Don't fail the request, just log it
            }
        }

        console.log('Doubt created successfully with ID:', newDoubt.id);
        res.status(201).json(newDoubt);
    } catch (error) {
        console.error('Error creating doubt:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// Get doubts for logged-in Student
exports.getDoubtsForStudent = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const email = req.user.email;

        const student_id = await getStudentId(email, school_id);
        if (!student_id) return res.status(404).json({ message: 'Student profile not found' });

        const query = `
            SELECT d.*, t.name as teacher_name, s.name as subject_name
            FROM doubts d
            LEFT JOIN teachers t ON d.teacher_id = t.id
            LEFT JOIN subjects s ON d.subject_id = s.id
            WHERE d.student_id = $1
            ORDER BY d.created_at DESC
        `;
        const result = await pool.query(query, [student_id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching doubts' });
    }
};

// Get doubts for logged-in Teacher
exports.getDoubtsForTeacher = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const email = req.user.email;

        // Find teacher ID
        const teacherRes = await pool.query('SELECT id FROM teachers WHERE email = $1 AND school_id = $2', [email, school_id]);
        if (teacherRes.rows.length === 0) return res.status(404).json({ message: 'Teacher profile not found' });
        const teacher_id = teacherRes.rows[0].id;

        const query = `
            SELECT d.*, st.name as student_name, st.roll_number, c.name as class_name, sub.name as subject_name
            FROM doubts d
            JOIN students st ON d.student_id = st.id
            LEFT JOIN classes c ON st.class_id = c.id
            LEFT JOIN subjects sub ON d.subject_id = sub.id
            WHERE d.teacher_id = $1
            ORDER BY d.created_at DESC
        `;
        const result = await pool.query(query, [teacher_id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching doubts' });
    }
};

// Reply to doubt (Teacher Only)
exports.replyToDoubt = async (req, res) => {
    try {
        const { id } = req.params;
        const { answer } = req.body;

        const result = await pool.query(
            `UPDATE doubts 
             SET answer = $1, status = 'Answered', answered_at = NOW() 
             WHERE id = $2 RETURNING *`,
            [answer, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ message: 'Doubt not found' });
        
        // Added: Push Notification for Student
        const doubt = result.rows[0];
        try {
            const { sendPushNotification } = require('../services/notificationService');
            // Notify the student who asked the doubt
            await sendPushNotification(doubt.student_id, 'Doubt Answered', `A teacher has replied to your doubt.`, 'Student');
        } catch (notifErr) {
            console.error('Failed to notify student of doubt reply:', notifErr.message);
        }

        res.json(doubt);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error replying to doubt' });
    }
};
