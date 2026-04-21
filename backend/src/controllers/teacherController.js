const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const { sendPushNotification } = require('../services/notificationService');

// Add Teacher
exports.addTeacher = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { name, email, phone, subject_specialization, gender, address, join_date, assign_class_id, assign_section_id, salary_per_day, can_enroll_face, can_take_face_attendance } = req.body;

        await client.query('BEGIN');

        // 1. Check if phone number already exists
        if (phone) {
            const phoneCheck = await client.query(
                'SELECT id, name FROM teachers WHERE phone = $1 AND school_id = $2',
                [phone, school_id]
            );
            if (phoneCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Phone number already exists for teacher: ${phoneCheck.rows[0].name}`
                });
            }
        }

        // 1.1 Check if email already exists
        if (email) {
            const emailCheck = await client.query(
                'SELECT id, name FROM teachers WHERE email = $1 AND school_id = $2',
                [email, school_id]
            );
            if (emailCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Email already exists for teacher: ${emailCheck.rows[0].name}`
                });
            }
        }

        // 2. Generate Employee ID - NEW FORMAT: [School First 2 Letters] + T + [4 Digits]
        // Example: DAS4548
        const schoolRes = await client.query('SELECT name FROM schools WHERE id = $1', [school_id]);
        const schoolName = schoolRes.rows[0]?.name || 'XX';
        let prefix = schoolName.replace(/[^a-zA-Z]/g, '').substring(0, 2).toUpperCase();
        if (prefix.length < 2) prefix = (prefix + 'X').substring(0, 2);

        let employee_id;
        const providedId = req.body.employee_id; // Allow manual override if sent

        if (providedId) {
            employee_id = providedId.toUpperCase();
        } else {
            let isUnique = false;
            while (!isUnique) {
                const rand4 = Math.floor(1000 + Math.random() * 9000); // 1000 to 9999
                employee_id = `${prefix}T${rand4}`; // XX + T + 1234 = 7 chars
                const check = await client.query('SELECT 1 FROM teachers WHERE employee_id = $1 AND school_id = $2', [employee_id, school_id]);
                if (check.rows.length === 0) isUnique = true;
            }
        }

        // 2. Insert Teacher
        const result = await client.query(
            `INSERT INTO teachers (school_id, name, email, phone, subject_specialization, gender, address, join_date, employee_id, salary_per_day, can_enroll_face, can_take_face_attendance)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [school_id, name, email, phone, subject_specialization, gender, address, join_date || new Date(), employee_id, salary_per_day || 0, can_enroll_face || false, can_take_face_attendance || false]
        );
        const newTeacher = result.rows[0];

        // 3. Create Login for Teacher - Always Use Employee ID for Login
        let loginEmail = employee_id.trim().toLowerCase();
        const defaultPassword = await bcrypt.hash('123456', 10);

        let userCheck = await client.query('SELECT id FROM users WHERE email = $1 AND role = $2', [loginEmail, 'TEACHER']);
        if (userCheck.rows.length > 0) {
            loginEmail = `${employee_id}@teacher.school.com`;
            userCheck = await client.query('SELECT id FROM users WHERE email = $1 AND role = $2', [loginEmail, 'TEACHER']);
        }

        if (userCheck.rows.length === 0) {
            await client.query(
                `INSERT INTO users (email, password, role, school_id, must_change_password, linked_id) VALUES ($1, $2, 'TEACHER', $3, TRUE, $4)`,
                [loginEmail, defaultPassword, school_id, newTeacher.id]
            );
        }

        // 4. Assign as Class Teacher
        console.log(`[ADD TEACHER] Class Assignment - ClassID: ${assign_class_id}, SectionID: ${assign_section_id}`);

        if (assign_class_id) {
            let targetSectionId = assign_section_id;
            const classIdInt = parseInt(assign_class_id);

            // A. Check if Section is Provided
            if (targetSectionId) {
                // Check if this SECTION is already assigned
                const checkSec = await client.query('SELECT class_teacher_id, name FROM sections WHERE id = $1', [targetSectionId]);
                if (checkSec.rows.length > 0 && checkSec.rows[0].class_teacher_id) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        message: `Section '${checkSec.rows[0].name}' already has a Class Teacher assigned.`
                    });
                }

                // VALID: Assign to Section
                await client.query(
                    `UPDATE sections SET class_teacher_id = $1 WHERE id = $2`,
                    [newTeacher.id, targetSectionId]
                );
                console.log(`[ADD TEACHER] Assigned to Section ID: ${targetSectionId}`);

            } else {
                // B. No Section Provided
                console.log(`[ADD TEACHER] No section provided. Checking if sections exist for Class ID: ${classIdInt}`);

                // Check if ANY sections exist for this class
                const sectionsCount = await client.query('SELECT COUNT(*) FROM sections WHERE class_id = $1', [classIdInt]);

                if (parseInt(sectionsCount.rows[0].count) > 0) {
                    // Start of Change: If sections exist, User MUST select one.
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        message: `This class has sections. Please select a specific section to assign.`
                    });
                } else {
                    // C. No Sections Exist -> Assign to Class Directly
                    // Check if Class already has a teacher
                    const checkClass = await client.query('SELECT class_teacher_id, name FROM classes WHERE id = $1', [classIdInt]);
                    if (checkClass.rows.length > 0 && checkClass.rows[0].class_teacher_id) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({
                            message: `Class '${checkClass.rows[0].name}' already has a Class Teacher assigned.`
                        });
                    }

                    // VALID: Assign to Class Direct
                    await client.query(
                        `UPDATE classes SET class_teacher_id = $1 WHERE id = $2`,
                        [newTeacher.id, classIdInt]
                    );
                    console.log(`[ADD TEACHER] Assigned directly into Class ID: ${classIdInt}`);
                }
            }
        }

        await client.query('COMMIT');
        res.status(201).json(newTeacher);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Server error adding teacher' });
    } finally {
        client.release();
    }
};

// Get Teachers
exports.getTeachers = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        // Fetch teachers AND their assigned class (either via section OR class directly)
        const query = `
            SELECT t.*, 
                   COALESCE(c_sec.name, c_main.name) as class_name, 
                   s.name as section_name,
                   s.id as assigned_section_id,
                   COALESCE(c_sec.id, c_main.id) as assigned_class_id,
                   COALESCE(t.can_enroll_face, TRUE) as can_enroll_face,
                   COALESCE(t.can_take_face_attendance, TRUE) as can_take_face_attendance
            FROM teachers t
            LEFT JOIN sections s ON s.class_teacher_id = t.id
            LEFT JOIN classes c_sec ON s.class_id = c_sec.id
            LEFT JOIN classes c_main ON c_main.class_teacher_id = t.id
            WHERE t.school_id = $1 
            ORDER BY t.name ASC
        `;
        const result = await pool.query(query, [school_id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching teachers' });
    }
};

// Update Teacher
exports.updateTeacher = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const { name, email, phone, subject_specialization, gender, address, join_date, assign_class_id, assign_section_id, salary_per_day, employee_id, can_enroll_face, can_take_face_attendance } = req.body;

        await client.query('BEGIN');

        // Check if phone number already exists for another teacher
        if (phone) {
            const phoneCheck = await client.query(
                'SELECT id, name FROM teachers WHERE phone = $1 AND school_id = $2 AND id != $3',
                [phone, school_id, id]
            );
            if (phoneCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Phone number already exists for teacher: ${phoneCheck.rows[0].name}`
                });
            }
        }

        // Check if email already exists for another teacher
        if (email) {
            const emailCheck = await client.query(
                'SELECT id, name FROM teachers WHERE email = $1 AND school_id = $2 AND id != $3',
                [email, school_id, id]
            );
            if (emailCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Email already exists for teacher: ${emailCheck.rows[0].name}`
                });
            }
        }
        // Check if employee_id already exists for another teacher
        if (employee_id) {
            const idCheck = await client.query(
                'SELECT id, name FROM teachers WHERE employee_id = $1 AND school_id = $2 AND id != $3',
                [employee_id, school_id, id]
            );
            if (idCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Employee ID already exists for: ${idCheck.rows[0].name}`
                });
            }
        }

        // Get Existing Teacher to check for email change
        const existingTeacher = await client.query('SELECT email, employee_id FROM teachers WHERE id = $1', [id]);

        // Split Name
        let first_name = name;
        let last_name = '';
        if (name && name.trim().includes(' ')) {
            const parts = name.trim().split(' ');
            first_name = parts[0];
            last_name = parts.slice(1).join(' ');
        }

        // Sanitize
        const safe_join_date = (join_date === '' || join_date === 'null' || join_date === undefined) ? null : join_date;
        const safe_salary = (salary_per_day === '' || salary_per_day === 'null' || salary_per_day === undefined) ? 0 : salary_per_day;

        const result = await client.query(
            `UPDATE teachers SET name = $1, email = $2, phone = $3, subject_specialization = $4, gender = $5, address = $6, join_date = $7, salary_per_day = $8,
             first_name = $9, last_name = $10, employee_id = COALESCE($13, employee_id),
             can_enroll_face = COALESCE($14, can_enroll_face),
             can_take_face_attendance = COALESCE($15, can_take_face_attendance)
             WHERE id = $11 AND school_id = $12 RETURNING *`,
            [name, email, phone, subject_specialization, gender, address, safe_join_date, safe_salary,
                first_name, last_name,
                id, school_id, employee_id, can_enroll_face, can_take_face_attendance]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Teacher not found' });
        }

        const updatedTeacher = result.rows[0];

        // SYNC USER TABLE: If email changed, update the Login User record
        if (existingTeacher.rows.length > 0 && email && existingTeacher.rows[0].email !== email) {
            try {
                await client.query(
                    `UPDATE users SET email = $1 WHERE email = $2 AND role = 'TEACHER'`,
                    [email, existingTeacher.rows[0].email]
                );
                console.log(`[Sync] Updated User Login Email for Teacher ${updatedTeacher.employee_id}`);
            } catch (uErr) {
                console.error('Failed to sync user email:', uErr.message);
            }
        }

        // Handle Class Teacher Assignment Update
        // 1. Remove this teacher from any previous assignments (Section OR Class)
        await client.query('UPDATE sections SET class_teacher_id = NULL WHERE class_teacher_id = $1', [id]);
        await client.query('UPDATE classes SET class_teacher_id = NULL WHERE class_teacher_id = $1', [id]);

        // 2. Assign to new section if provided
        console.log(`[UPDATE TEACHER] Class Assignment - ClassID: ${assign_class_id}, SectionID: ${assign_section_id}`);

        if (assign_class_id && assign_class_id !== 'null' && assign_class_id !== 'undefined') {
            let targetSectionId = assign_section_id;
            const classIdInt = parseInt(assign_class_id);

            // A. Check if Section is Provided
            if (targetSectionId && targetSectionId !== 'null' && targetSectionId !== 'undefined') {
                // Check if this SECTION is already assigned
                const checkSec = await client.query('SELECT class_teacher_id, name FROM sections WHERE id = $1', [targetSectionId]);
                // Ensure we don't count self (though we just cleared it above)
                if (checkSec.rows.length > 0 && checkSec.rows[0].class_teacher_id && checkSec.rows[0].class_teacher_id != id) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        message: `Section '${checkSec.rows[0].name}' already has a Class Teacher assigned.`
                    });
                }

                // VALID: Assign to Section
                await client.query(
                    `UPDATE sections SET class_teacher_id = $1 WHERE id = $2`,
                    [id, targetSectionId]
                );
                console.log(`[UPDATE TEACHER] Assigned to Section ID: ${targetSectionId}`);

            } else {
                // B. No Section Provided
                console.log(`[UPDATE TEACHER] No section provided. Checking if sections exist for Class ID: ${classIdInt}`);

                // Check if ANY sections exist for this class
                const sectionsCount = await client.query('SELECT COUNT(*) FROM sections WHERE class_id = $1', [classIdInt]);

                if (parseInt(sectionsCount.rows[0].count) > 0) {
                    // If sections exist, User MUST select one.
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        message: `This class has sections. Please select a specific section to assign.`
                    });
                } else {
                    // C. No Sections Exist -> Assign to Class Directly
                    // Check if Class already has a teacher
                    const checkClass = await client.query('SELECT class_teacher_id, name FROM classes WHERE id = $1', [classIdInt]);
                    if (checkClass.rows.length > 0 && checkClass.rows[0].class_teacher_id && checkClass.rows[0].class_teacher_id != id) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({
                            message: `Class '${checkClass.rows[0].name}' already has a Class Teacher assigned.`
                        });
                    }

                    // VALID: Assign to Class Direct
                    await client.query(
                        `UPDATE classes SET class_teacher_id = $1 WHERE id = $2`,
                        [id, classIdInt]
                    );
                    console.log(`[UPDATE TEACHER] Assigned directly into Class ID: ${classIdInt}`);
                }
            }
        }

        // const updatedTeacher = result.rows[0]; // Already defined earlier

        // Trigger Notification
        sendPushNotification(updatedTeacher.id, "Profile Updated", "Your teacher profile has been updated by the administration.", "Teacher")
            .catch(err => console.error('Notification failed:', err));

        res.json(updatedTeacher);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Server error updating teacher' });
    } finally {
        client.release();
    }
};

// Delete Teacher - Robust (Clears FKs first)
exports.deleteTeacher = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;

        await client.query('BEGIN');

        // 0. Get Teacher Info (Email/EmpID) to delete User Login later
        const teacherRes = await client.query('SELECT email, employee_id FROM teachers WHERE id = $1', [id]);
        if (teacherRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Teacher not found' });
        }
        const teacher = teacherRes.rows[0];

        // 1. Unassign from Classes (Class Teacher)
        await client.query('UPDATE classes SET class_teacher_id = NULL WHERE class_teacher_id = $1', [id]);

        // 2. Unassign from Sections (Class Teacher)
        await client.query('UPDATE sections SET class_teacher_id = NULL WHERE class_teacher_id = $1', [id]);

        // 3. Delete Attendance Records
        await client.query('DELETE FROM teacher_attendance WHERE teacher_id = $1', [id]);

        // 3.5 Delete Salary Records (Force Clean)
        await client.query("DELETE FROM salary_payments WHERE employee_id = $1 AND employee_type = 'Teacher'", [id]);

        // 3.6 Unassign from Doubts
        await client.query('UPDATE doubts SET teacher_id = NULL WHERE teacher_id = $1', [id]);

        // 4. Delete Timetable Entries
        await client.query('DELETE FROM timetables WHERE teacher_id = $1', [id]);

        // 5. Delete Teacher Record
        const result = await client.query(
            `DELETE FROM teachers WHERE id = $1 AND school_id = $2 RETURNING *`,
            [id, school_id]
        );

        // 6. Delete User Login Account
        // Try deleting by exact email match
        if (teacher.email) {
            await client.query("DELETE FROM users WHERE email = $1 AND role = 'TEACHER'", [teacher.email]);
        }
        // Also try deleting by generated email pattern just in case
        if (teacher.employee_id) {
            const genEmail = `${teacher.employee_id}@teacher.school.com`;
            await client.query("DELETE FROM users WHERE email = $1 AND role = 'TEACHER'", [genEmail]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Teacher deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Data Integrity Error deleting teacher:', error.message);
        // Return 200 with warning if delete technically "failed" but practically worked, or just 500
        // But better to show the specific error
        if (error.code === '23503') { // Foreign Key Violation
            return res.status(400).json({ message: 'Cannot delete teacher. They are referenced in other records (e.g. Salary, Exams). Please clear those first.' });
        }
        res.status(500).json({ message: 'Server error deleting teacher: ' + error.message });
    } finally {
        client.release();
    }
};

// Mark Attendance
exports.markAttendance = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { date, attendanceData } = req.body; // [{ teacher_id, status }]

        await client.query('BEGIN');

        for (const record of attendanceData) {
            await client.query(
                `INSERT INTO teacher_attendance(school_id, teacher_id, date, status)
                VALUES($1, $2, $3, $4)
                ON CONFLICT(teacher_id, date) 
                DO UPDATE SET status = EXCLUDED.status`,
                [school_id, record.teacher_id, date, record.status]
            );

            // Trigger Notification (Async)
            if (['Absent', 'Present', 'Late'].includes(record.status)) {
                sendPushNotification(record.teacher_id, 'Attendance Updated', `Your attendance for ${new Date(date).toLocaleDateString()} has been marked as ${record.status}.`, 'Teacher')
                    .catch(err => console.error('Teacher Attendance Notification Error:', err));
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Attendance updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Server error marking attendance' });
    } finally {
        client.release();
    }
};

// Get Daily Attendance (Detailed)
exports.getDailyAttendance = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { date } = req.query;

        if (!date) return res.status(400).json({ message: 'Date is required' });

        const query = `
            SELECT t.id, t.name, t.phone, t.subject_specialization, COALESCE(a.status, 'Unmarked') as status
            FROM teachers t
            LEFT JOIN teacher_attendance a ON t.id = a.teacher_id AND a.date = $2
            WHERE t.school_id = $1
            ORDER BY t.name ASC
        `;
        const result = await pool.query(query, [school_id, date]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching daily attendance' });
    }
};

// Get Monthly Attendance Report
exports.getAttendanceReport = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { month, year } = req.query;

        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const query = `
            WITH month_holidays AS (
                SELECT holiday_date, holiday_name
                FROM school_holidays
                WHERE school_id = $1 AND holiday_date >= $2 AND holiday_date <= $3
            )
            SELECT 
                t.id as teacher_id, 
                t.name, 
                TO_CHAR(d.date, 'YYYY-MM-DD') as date,
                COALESCE(a.status, CASE WHEN mh.holiday_date IS NOT NULL THEN 'Holiday' ELSE 'Unmarked' END) as status
            FROM teachers t
            CROSS JOIN generate_series($2::date, $3::date, '1 day'::interval) d(date)
            LEFT JOIN teacher_attendance a ON t.id = a.teacher_id AND a.date = d.date::date
            LEFT JOIN month_holidays mh ON mh.holiday_date = d.date::date
            WHERE t.school_id = $1
            ORDER BY t.name ASC, d.date ASC
        `;
        const result = await pool.query(query, [school_id, startDate, endDate]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching attendance report' });
    }
};

// Get Subjects (Distinct List)
exports.getSubjects = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const result = await pool.query(`
            SELECT DISTINCT name 
            FROM subjects 
            WHERE class_id IN (SELECT id FROM classes WHERE school_id = $1)
            ORDER BY name ASC
        `, [school_id]);
        res.json(result.rows.map(r => r.name));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching subjects' });
    }
};

// Get Teacher Profile (Logged-in User)
exports.getTeacherProfile = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const email = req.user.email;

        let teacher_id = req.user.linkedId;
        let query = `
            SELECT t.*, 
                   COALESCE(c_sec.name, c_main.name) as class_name, 
                   COALESCE(s.name, 'Class Teacher') as section_name,
                   s.id as assigned_section_id,
                   COALESCE(c_sec.id, c_main.id) as assigned_class_id,
                   tr.route_name as transport_route,
                   tv.vehicle_number,
                   tv.driver_name,
                   tv.driver_phone,
                   COALESCE(t.can_enroll_face, TRUE) as can_enroll_face,
                   COALESCE(t.can_take_face_attendance, TRUE) as can_take_face_attendance
            FROM teachers t
            LEFT JOIN sections s ON s.class_teacher_id = t.id
            LEFT JOIN classes c_sec ON s.class_id = c_sec.id
            LEFT JOIN classes c_main ON c_main.class_teacher_id = t.id
            LEFT JOIN transport_routes tr ON t.transport_route_id = tr.id
            LEFT JOIN transport_vehicles tv ON tr.vehicle_id = tv.id
            WHERE t.school_id = $1
        `;
        const params = [school_id];

        if (teacher_id) {
            query += ' AND t.id = $2';
            params.push(teacher_id);
        } else {
            // Fallback: search by email OR employee_id
            const potentialEmpId = email.includes('@') ? email.split('@')[0].toUpperCase() : email.toUpperCase();
            query += ' AND (LOWER(TRIM(t.email)) = LOWER(TRIM($2)) OR t.employee_id ILIKE $3)';
            params.push(email, potentialEmpId);
        }
        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            // If no teacher record found for this user email
            return res.status(404).json({ message: 'Teacher profile not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching profile' });
    }
};

// Get My Attendance History (Logged-in User)
exports.getMyAttendanceHistory = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const email = req.user.email;
        const { month, year } = req.query;

        // Find teacher ID from ID or email (Robust Match)
        let tRes = [];
        if (req.user.linkedId) {
            tRes = await pool.query('SELECT id FROM teachers WHERE id = $1 AND school_id = $2', [req.user.linkedId, school_id]);
        }
        
        if (!tRes || tRes.rows?.length === 0) {
            tRes = await pool.query(
                'SELECT id FROM teachers WHERE (LOWER(TRIM(email)) = LOWER(TRIM($1)) OR employee_id ILIKE $2) AND school_id = $3',
                [email, email.includes('@') ? email.split('@')[0] : email, school_id]
            );
        }

        if (tRes.rows.length === 0) return res.status(404).json({ message: 'Teacher profile not found' });
        const teacher_id = tRes.rows[0].id;

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const query = `
            WITH month_holidays AS (
                SELECT holiday_date, holiday_name
                FROM school_holidays
                WHERE school_id = $2 AND holiday_date >= $3 AND holiday_date <= $4
            )
            SELECT 
                TO_CHAR(d.date, 'YYYY-MM-DD') as date,
                COALESCE(a.status, CASE WHEN mh.holiday_date IS NOT NULL THEN 'Holiday' ELSE 'Unmarked' END) as status
            FROM generate_series($3::date, $4::date, '1 day'::interval) d(date)
            LEFT JOIN teacher_attendance a ON a.teacher_id = $1 AND a.date = d.date::date
            LEFT JOIN month_holidays mh ON mh.holiday_date = d.date::date
            ORDER BY d.date ASC
        `;
        const result = await pool.query(query, [teacher_id, school_id, startDate, endDate]);

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching attendance history' });
    }
};

// Update Teacher Profile (Self)
exports.updateMyProfile = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const email = req.user.email;
        const { name, phone, gender, address, profile_image } = req.body;

        await client.query('BEGIN');

        // 1. Find the teacher record
        let tRes = [];
        if (req.user.linkedId) {
            tRes = await pool.query('SELECT id, email, employee_id FROM teachers WHERE id = $1 AND school_id = $2', [req.user.linkedId, school_id]);
        }
        
        if (!tRes || tRes.rows?.length === 0) {
            const potentialEmpId = email.includes('@') ? email.split('@')[0].toUpperCase() : email.toUpperCase();
            tRes = await pool.query(
                'SELECT id, email, employee_id FROM teachers WHERE (LOWER(TRIM(email)) = LOWER(TRIM($1)) OR employee_id ILIKE $2) AND school_id = $3',
                [email, potentialEmpId, school_id]
            );
        }

        if (tRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Teacher profile not found' });
        }

        const teacherId = tRes.rows[0].id;

        // 2. Update Teacher data
        // For self-update, we typically don't allow changing email/employee_id/salary
        const result = await client.query(
            `UPDATE teachers 
             SET name = COALESCE($1, name), 
                 phone = COALESCE($2, phone), 
                 gender = COALESCE($3, gender), 
                 address = COALESCE($4, address),
                 profile_image = COALESCE($5, profile_image)
             WHERE id = $6 RETURNING *`,
            [name, phone, gender, address, profile_image, teacherId]
        );

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Server error updating profile' });
    } finally {
        client.release();
    }
};
