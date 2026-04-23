const { pool } = require('../config/db');
const { sendAttendanceNotification } = require('../services/notificationService');

// Unified User Search
const searchUsers = async (req, res) => {
    try {
        const { type, query } = req.query; // type: 'student', 'teacher', 'staff'
        const schoolId = req.user.schoolId;
        const { role, id: userId, linkedId } = req.user;

        // Permission Check for Teachers/Staff (Skip for School/Super Admin)
        const ADMIN_ROLES = ['SCHOOL_ADMIN', 'SUPER_ADMIN'];
        if (!ADMIN_ROLES.includes(role)) {
            const table = role === 'TEACHER' ? 'teachers' : 'staff';
            const permCheck = await pool.query(
                `SELECT can_enroll_face, can_take_face_attendance FROM ${table} WHERE id = $1 AND school_id = $2`,
                [linkedId, schoolId]
            );
            
            if (permCheck.rows.length === 0 || (!permCheck.rows[0].can_enroll_face && !permCheck.rows[0].can_take_face_attendance)) {
                return res.status(403).json({ message: 'Access denied: You do not have biometric permissions.' });
            }
        }

        let sql = '';
        let params = [schoolId, `%${query}%`];

        if (type === 'student') {
            sql = `SELECT id, name, admission_no as user_id, 'student' as type, biometric_template, rfid_card_id 
                   FROM students WHERE school_id = $1 AND (name ILIKE $2 OR admission_no ILIKE $2)`;
        } else if (type === 'teacher') {
            sql = `SELECT id, name, COALESCE(employee_id, email) as user_id, 'teacher' as type, biometric_template, rfid_card_id 
                   FROM teachers WHERE school_id = $1 AND (name ILIKE $2 OR email ILIKE $2 OR employee_id ILIKE $2)`;
        } else if (type === 'staff') {
            sql = `SELECT id, name, COALESCE(employee_id, email) as user_id, 'staff' as type, biometric_template, rfid_card_id 
                   FROM staff WHERE school_id = $1 AND (name ILIKE $2 OR email ILIKE $2 OR employee_id ILIKE $2)`;
        }

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error searching users' });
    }
};

// Get Today's Face Attendance
const getTodayFaceAttendance = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const date = new Date().toISOString().split('T')[0];
        
        const result = await pool.query(
            `SELECT 
                s.id, s.name, s.admission_no as user_id, 'student' as type, a.date, a.marking_mode, 
                TO_CHAR(a.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'HH:MI AM') as scan_time 
             FROM attendance a
             JOIN students s ON a.student_id = s.id
             WHERE a.school_id = $1 AND a.date = $2
             
             UNION ALL
             
             SELECT 
                t.id, t.name, COALESCE(t.employee_id, t.email) as user_id, 'teacher' as type, ta.date, ta.marking_mode, 
                TO_CHAR(ta.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'HH:MI AM') as scan_time 
             FROM teacher_attendance ta
             JOIN teachers t ON ta.teacher_id = t.id
             WHERE ta.school_id = $1 AND ta.date = $2
             
             UNION ALL
             
             SELECT 
                st.id, st.name, COALESCE(st.employee_id, st.email) as user_id, 'staff' as type, sa.date, sa.marking_mode, 
                TO_CHAR(sa.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'HH:MI AM') as scan_time 
             FROM staff_attendance sa
             JOIN staff st ON sa.staff_id = st.id
             WHERE sa.school_id = $1 AND sa.date = $2
             
             ORDER BY scan_time DESC`,
            [schoolId, date]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching today attendance' });
    }
};

// Get Enrolled Users (Face only)
const getEnrolledUsers = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        console.log(`[GET ENROLLED] Fetching for School ID: ${schoolId}`);
        
        const studentResult = await pool.query(
            `SELECT id, name, admission_no as user_id, 'student' as type, class_id, section_id, biometric_template, updated_at
             FROM students 
             WHERE school_id = $1 AND biometric_template IS NOT NULL`,
            [schoolId]
        );
        
        const teacherResult = await pool.query(
            `SELECT id, name, COALESCE(employee_id, email) as user_id, 'teacher' as type, biometric_template, updated_at
             FROM teachers 
             WHERE school_id = $1 AND biometric_template IS NOT NULL`,
            [schoolId]
        );

        const staffResult = await pool.query(
            `SELECT id, name, COALESCE(employee_id, email) as user_id, 'staff' as type, biometric_template, updated_at
             FROM staff 
             WHERE school_id = $1 AND biometric_template IS NOT NULL`,
            [schoolId]
        );
        
        const allUsers = [...studentResult.rows, ...teacherResult.rows, ...staffResult.rows];
        console.log(`[GET ENROLLED] Found ${allUsers.length} enrolled users`);
        res.json(allUsers);
    } catch (error) {
        console.error('[GET ENROLLED ERROR]', error);
        res.status(500).json({ message: 'Error fetching enrolled users' });
    }
};

// Update Biometric/Card Data
const updateCredentials = async (req, res) => {
    try {
        const { type, id } = req.body;
        const { biometric_template, rfid_card_id } = req.body;

        let table = '';
        if (type === 'student') table = 'students';
        else if (type === 'teacher') table = 'teachers';
        else if (type === 'staff') table = 'staff';
        else return res.status(400).json({ message: 'Invalid user type' });

        // Update query
        await pool.query(
            `UPDATE ${table} SET biometric_template = COALESCE($1, biometric_template), rfid_card_id = COALESCE($2, rfid_card_id) WHERE id = $3`,
            [biometric_template, rfid_card_id, id]
        );

        res.json({ message: 'Credentials updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating credentials' });
    }
};

// Mark Attendance via Device (Card/Fingerprint)
const markDeviceAttendance = async (req, res) => {
    const client = await pool.connect();
    try {
        const { input_id, mode } = req.body; // input_id: card number or student id. mode: 'card' or 'fingerprint' or 'id'
        const schoolId = req.user.schoolId;
        const date = new Date().toISOString().split('T')[0];

        let user = null;
        let table = '';
        let userType = '';

        // 1. Find User
        // Try Student
        const studentRes = await client.query(
            `SELECT * FROM students WHERE school_id = $1 AND (rfid_card_id = $2 OR admission_no = $2)`,
            [schoolId, input_id]
        );
        if (studentRes.rows.length > 0) {
            user = studentRes.rows[0];
            table = 'attendance';
            userType = 'student';
        }

        // Try Teacher (if not student)
        if (!user) {
            const teacherRes = await client.query(
                `SELECT * FROM teachers WHERE school_id = $1 AND (rfid_card_id = $2 OR email = $2)`,
                [schoolId, input_id]
            );
            if (teacherRes.rows.length > 0) {
                user = teacherRes.rows[0];
                table = 'teacher_attendance';
                userType = 'teacher';
            }
        }

        // Try Staff (if not teacher)
        if (!user) {
            const staffRes = await client.query(
                `SELECT * FROM staff WHERE school_id = $1 AND (rfid_card_id = $2 OR email = $2)`,
                [schoolId, input_id]
            );
            if (staffRes.rows.length > 0) {
                user = staffRes.rows[0];
                table = 'staff_attendance';
                userType = 'staff';
            }
        }

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 2. Mark Attendance
        // Check if already marked
        const existingRef = await client.query(
            `SELECT * FROM ${table} WHERE ${userType}_id = $1 AND date = $2`,
            [user.id, date]
        );

        if (existingRef.rows.length > 0) {
            return res.json({ success: true, message: `Attendance already marked for ${user.name}`, user: user });
        }

        await client.query(
            `INSERT INTO ${table} (${userType}_id, date, status, school_id) VALUES ($1, $2, 'Present', $3)`,
            [user.id, date, schoolId]
        );

        // Send SMS for Students
        if (userType === 'student') {
            await sendAttendanceNotification(user, 'Present');
        }

        res.json({ success: true, message: `Welcome, ${user.name}!`, user: user });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error marking attendance' });
    } finally {
        client.release();
    }
};

// Handle Attendance Push from External Standalone Devices (ZKTeco/eSSL/IoT)
const handleExternalDeviceLog = async (req, res) => {
    const client = await pool.connect();
    try {
        const data = Object.keys(req.body).length > 0 ? req.body : req.query;
        const user_id = data.user_id || data.PIN || data.EnrollNumber;
        const device_id = data.device_id || data.SN;
        const timestamp = data.timestamp || data.Time;
        const schoolId = req.user?.schoolId || 1;

        if (device_id && !user_id) return res.send('OK');
        if (!user_id) return res.status(400).send('Missing user_id');

        const date = timestamp ? new Date(timestamp).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        let user = null;
        let table = '';
        let userType = '';

        const studentRes = await client.query(`SELECT * FROM students WHERE school_id = $1 AND (admission_no = $2 OR rfid_card_id = $2)`, [schoolId, user_id]);
        if (studentRes.rows.length > 0) {
            user = studentRes.rows[0];
            table = 'attendance';
            userType = 'student';
        }

        if (!user) {
            const teacherRes = await client.query(`SELECT * FROM teachers WHERE school_id = $1 AND (email = $2 OR rfid_card_id = $2)`, [schoolId, user_id]);
            if (teacherRes.rows.length > 0) {
                user = teacherRes.rows[0];
                table = 'teacher_attendance';
                userType = 'teacher';
            }
        }

        if (!user) {
            const staffRes = await client.query(`SELECT * FROM staff WHERE school_id = $1 AND (email = $2 OR rfid_card_id = $2)`, [schoolId, user_id]);
            if (staffRes.rows.length > 0) {
                user = staffRes.rows[0];
                table = 'staff_attendance';
                userType = 'staff';
            }
        }

        if (user) {
            await client.query(
                `INSERT INTO ${table} (${userType}_id, date, status, school_id) VALUES ($1, $2, 'Present', $3)
                 ON CONFLICT (${userType}_id, date) DO NOTHING`,
                [user.id, date, schoolId]
            );
            if (userType === 'student') await sendAttendanceNotification(user, 'Present');
            return res.send('OK');
        }
        res.status(404).send('User not found');
    } catch (error) {
        console.error('Device Push Error:', error);
        res.status(500).send('Error');
    } finally {
        client.release();
    }
};

// Face Specific: Enroll Face Descriptor
const enrollFace = async (req, res) => {
    try {
        const { type, id, biometric_template } = req.body;
        const schoolId = req.user.schoolId;
        const { role, linkedId } = req.user;

        // Permission Check (Skip for Admins)
        const ADMIN_ROLES = ['SCHOOL_ADMIN', 'SUPER_ADMIN'];
        if (!ADMIN_ROLES.includes(role)) {
            const table = role === 'TEACHER' ? 'teachers' : 'staff';
            const permCheck = await pool.query(`SELECT can_enroll_face FROM ${table} WHERE id = $1 AND school_id = $2`, [linkedId, schoolId]);
            if (permCheck.rows.length === 0 || !permCheck.rows[0].can_enroll_face) {
                return res.status(403).json({ message: 'Access denied: Permission to enroll face not granted.' });
            }
        }

        let table = '';
        if (type === 'student') table = 'students';
        else if (type === 'teacher') table = 'teachers';
        else if (type === 'staff') table = 'staff';
        else return res.status(400).json({ message: 'Invalid user type' });

        if (!Array.isArray(biometric_template) || biometric_template.length < 12) {
            return res.status(400).json({ message: 'Invalid face descriptor format' });
        }

        const templateJson = JSON.stringify(biometric_template);
        await pool.query(
            `UPDATE ${table} SET biometric_template = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND school_id = $3`,
            [templateJson, id, schoolId]
        );

        res.json({ success: true, message: 'Face enrolled successfully' });
    } catch (error) {
        console.error('Enroll Face Error:', error);
        res.status(500).json({ message: 'Error enrolling face' });
    }
};

// Face Specific: Mark Attendance via Face Recognition
const markFaceAttendance = async (req, res) => {
    const client = await pool.connect();
    try {
        const { descriptor, class_id, section_id } = req.body;
        const schoolId = req.user.schoolId;
        const { role, linkedId } = req.user;
        const date = new Date().toISOString().split('T')[0];

        // Permission Check (Skip for Admins)
        const ADMIN_ROLES = ['SCHOOL_ADMIN', 'SUPER_ADMIN'];
        if (!ADMIN_ROLES.includes(role)) {
            const table = role === 'TEACHER' ? 'teachers' : 'staff';
            const permCheck = await pool.query(`SELECT can_take_face_attendance FROM ${table} WHERE id = $1 AND school_id = $2`, [linkedId, schoolId]);
            if (permCheck.rows.length === 0 || !permCheck.rows[0].can_take_face_attendance) {
                return res.status(403).json({ message: 'Access denied: Permission to take face attendance not granted.' });
            }
        }

        if (!descriptor || !Array.isArray(descriptor)) {
            return res.status(400).json({ message: 'No face descriptor provided' });
        }

        // Search Students
        let studentQuery = `SELECT id, name, admission_no as user_id, class_id, section_id, biometric_template, contact_number, school_id, 'student' as type 
                             FROM students 
                             WHERE school_id = $1 AND biometric_template IS NOT NULL`;
        let studentParams = [schoolId];
        if (class_id) { studentQuery += ` AND class_id = $2`; studentParams.push(class_id); }
        if (section_id) { studentQuery += ` AND section_id = $3`; studentParams.push(section_id); }

        const studentResult = await client.query(studentQuery, studentParams);
        
        // Search Teachers & Staff (only if no class/section filter is active, or if we want global search)
        let otherUsers = [];
        if (!class_id && !section_id) {
            const teacehrRes = await client.query(`SELECT id, name, email as user_id, biometric_template, school_id, 'teacher' as type FROM teachers WHERE school_id = $1 AND biometric_template IS NOT NULL`, [schoolId]);
            const staffRes = await client.query(`SELECT id, name, email as user_id, biometric_template, school_id, 'staff' as type FROM staff WHERE school_id = $1 AND biometric_template IS NOT NULL`, [schoolId]);
            otherUsers = [...teacehrRes.rows, ...staffRes.rows];
        }

        const candidates = [...studentResult.rows, ...otherUsers];

        if (candidates.length === 0) return res.status(404).json({ message: 'No enrolled users found' });

        let bestMatch = null;
        let minDistance = 0.6;

        for (const user of candidates) {
            try {
                const storedDescriptor = typeof user.biometric_template === 'string' ? JSON.parse(user.biometric_template) : user.biometric_template;
                if (!Array.isArray(storedDescriptor)) continue;
                let sumSq = 0;
                for (let i = 0; i < descriptor.length; i++) {
                    const diff = descriptor[i] - storedDescriptor[i];
                    sumSq += diff * diff;
                }
                const distance = Math.sqrt(sumSq);
                if (distance < minDistance) { minDistance = distance; bestMatch = user; }
            } catch (e) { continue; }
        }

        if (!bestMatch) return res.status(404).json({ message: 'Face not recognized' });

        // Update correct attendance table
        let attendanceTable = 'attendance';
        let idColumn = 'student_id';
        if (bestMatch.type === 'teacher') { attendanceTable = 'teacher_attendance'; idColumn = 'teacher_id'; }
        else if (bestMatch.type === 'staff') { attendanceTable = 'staff_attendance'; idColumn = 'staff_id'; }

        const existingRef = await client.query(`SELECT status FROM ${attendanceTable} WHERE ${idColumn} = $1 AND date = $2`, [bestMatch.id, date]);
        const existingStatus = existingRef.rows.length > 0 ? existingRef.rows[0].status : null;

        if (existingStatus === 'Present') {
            return res.json({ success: true, alreadyMarked: true, message: `Already marked for ${bestMatch.name}`, user: bestMatch });
        }

        await client.query(
            `INSERT INTO ${attendanceTable} (school_id, ${idColumn}, date, status, marking_mode) VALUES ($1, $2, $3, 'Present', 'face')
             ON CONFLICT (${idColumn}, date) DO UPDATE SET status = 'Present', marking_mode = 'face'`,
            [schoolId, bestMatch.id, date]
        );

        if (existingStatus !== 'Present' && bestMatch.type === 'student') {
            await sendAttendanceNotification(bestMatch, 'Present');
        }

        res.json({ success: true, message: `Recognized: ${bestMatch.name}`, user: bestMatch, distance: minDistance });
    } catch (error) {
        console.error('Face Recognition Error:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// Optimized: Mark Attendance by ID (already verified client-side)
const markFaceAttendanceById = async (req, res) => {
    const client = await pool.connect();
    try {
        const { userId, type = 'student', marking_mode = 'face' } = req.body;
        const schoolId = req.user.schoolId;
        const { role, linkedId } = req.user;
        const date = new Date().toISOString().split('T')[0];

        // Permission Check (Skip for Admins)
        const ADMIN_ROLES = ['SCHOOL_ADMIN', 'SUPER_ADMIN'];
        if (!ADMIN_ROLES.includes(role)) {
            const table = role === 'TEACHER' ? 'teachers' : 'staff';
            const permCheck = await pool.query(`SELECT can_take_face_attendance FROM ${table} WHERE id = $1 AND school_id = $2`, [linkedId, schoolId]);
            if (permCheck.rows.length === 0 || !permCheck.rows[0].can_take_face_attendance) {
                return res.status(403).json({ message: 'Access denied: Permission to take face attendance not granted.' });
            }
        }

        let table = '';
        let attendanceTable = '';
        let idColumn = '';

        if (type === 'student') { table = 'students'; attendanceTable = 'attendance'; idColumn = 'student_id'; }
        else if (type === 'teacher') { table = 'teachers'; attendanceTable = 'teacher_attendance'; idColumn = 'teacher_id'; }
        else if (type === 'staff') { table = 'staff'; attendanceTable = 'staff_attendance'; idColumn = 'staff_id'; }
        else return res.status(400).json({ message: 'Invalid user type' });

        const userRes = await client.query(
            `SELECT id, name, school_id FROM ${table} WHERE id = $1 AND school_id = $2`,
            [userId, schoolId]
        );

        if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        const user = userRes.rows[0];

        const existingRef = await client.query(`SELECT status FROM ${attendanceTable} WHERE ${idColumn} = $1 AND date = $2`, [userId, date]);
        const existingStatus = existingRef.rows.length > 0 ? existingRef.rows[0].status : null;

        if (existingStatus === 'Present') {
            return res.json({ success: true, alreadyMarked: true, message: `Already marked for ${user.name}`, user });
        }

        await client.query(
            `INSERT INTO ${attendanceTable} (school_id, ${idColumn}, date, status, marking_mode) VALUES ($1, $2, $3, 'Present', $4)
             ON CONFLICT (${idColumn}, date) DO UPDATE SET status = 'Present', marking_mode = $4`,
            [schoolId, userId, date, marking_mode]
        );

        if (existingStatus !== 'Present' && type === 'student') {
            await sendAttendanceNotification(user, 'Present');
        }

        res.json({ success: true, message: `Attendance marked for ${user.name}`, user });
    } catch (error) {
        console.error('Fast Attendance Error:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

module.exports = {
    searchUsers,
    getEnrolledUsers,
    getTodayFaceAttendance,
    updateCredentials,
    markDeviceAttendance,
    handleExternalDeviceLog,
    enrollFace,
    markFaceAttendance,
    markFaceAttendanceById
};
