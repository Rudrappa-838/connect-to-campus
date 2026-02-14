const { pool } = require('../config/db');
const { sendAttendanceNotification, sendPushNotification } = require('../services/notificationService');

// Add a new student
// Add a new student
// Add a new student
const bcrypt = require('bcrypt'); // Import bcrypt

// Add a new student
exports.addStudent = async (req, res) => {
    // ... existing addStudent code ...
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start Transaction

        const {
            name, gender, dob, age,
            class_id, section_id,
            father_name, mother_name, contact_number, email, address,
            attendance_id, admission_date
        } = req.body;
        const school_id = req.user.schoolId;

        // Split name into first and last name for DB compatibility
        const nameParts = (name || '').trim().split(' ');
        const first_name = nameParts[0] || name;
        const last_name = nameParts.slice(1).join(' ') || '';

        // Convert empty section_id to null
        const safe_section_id = (section_id === '' || section_id === 'null' || section_id === undefined) ? null : section_id;

        // Generate Admission No if not provided
        let admission_no = req.body.admission_no;
        if (!admission_no) {
            // NEW FORMAT: [School First 2 Letters (Upper)] + [Role: S] + [4 Digits]
            // Constraint: Total 7 Characters. Example: DAS4545
            const schoolRes = await client.query('SELECT name FROM schools WHERE id = $1', [school_id]);
            const schoolName = schoolRes.rows[0]?.name || 'XX';
            // Get first 2 letters, uppercase, remove non-alphabets
            let prefix = schoolName.replace(/[^a-zA-Z]/g, '').substring(0, 2).toUpperCase();
            if (prefix.length < 2) prefix = (prefix + 'X').substring(0, 2); // Fallback if name is 1 char

            // Generate unique 4-digit number to ensure total length 7
            let isUnique = false;
            let rand4;
            while (!isUnique) {
                rand4 = Math.floor(1000 + Math.random() * 9000); // 1000 to 9999
                admission_no = `${prefix}S${rand4}`; // XX + S + 1234 = 7 chars
                const check = await client.query('SELECT id FROM students WHERE admission_no = $1 AND school_id = $2', [admission_no, school_id]);
                if (check.rows.length === 0) isUnique = true;
            }
        } else {
            // If provided manually, ensure uppercase
            admission_no = admission_no.toUpperCase();
        }

        // Logic to get roll number (handle null section)
        let rollCheck;
        if (safe_section_id) {
            rollCheck = await client.query('SELECT MAX(roll_number) as max_roll FROM students WHERE class_id = $1 AND section_id = $2', [class_id, safe_section_id]);
        } else {
            rollCheck = await client.query('SELECT MAX(roll_number) as max_roll FROM students WHERE class_id = $1 AND section_id IS NULL', [class_id]);
        }

        const roll_number = (rollCheck.rows[0].max_roll || 0) + 1;

        // 1. Insert Student
        const result = await client.query(
            `INSERT INTO students 
            (school_id, name, first_name, last_name, admission_no, roll_number, gender, dob, age, class_id, section_id, 
             father_name, mother_name, contact_number, email, address, attendance_id, admission_date) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
            [school_id, name, first_name, last_name, admission_no, roll_number, gender, dob, age, class_id, safe_section_id,
                father_name, mother_name, contact_number, email, address, attendance_id, admission_date || new Date()]
        );
        const newStudent = result.rows[0];

        // 2. Create Login for Student
        let loginEmail = email || `${admission_no.toLowerCase()}@student.school.com`;
        const defaultPassword = await bcrypt.hash('123456', 10);

        // Check if user email already exists FOR THIS ROLE
        const userCheck = await client.query('SELECT id FROM users WHERE email = $1 AND role = $2', [loginEmail, 'STUDENT']);

        // If email exists for SAME role, fallback to Admission No based login
        if (userCheck.rows.length > 0) {
            loginEmail = `${admission_no.toLowerCase()}@student.school.com`;
            // Double check if this fallback also exists for this role
            const fallbackCheck = await client.query('SELECT id FROM users WHERE email = $1 AND role = $2', [loginEmail, 'STUDENT']);
            if (fallbackCheck.rows.length > 0) {
                console.warn(`User for student ${admission_no} already exists.`);
            } else {
                await client.query(
                    `INSERT INTO users (email, password, role, school_id, must_change_password) VALUES ($1, $2, 'STUDENT', $3, TRUE)`,
                    [loginEmail, defaultPassword, school_id]
                );
            }
        } else {
            await client.query(
                `INSERT INTO users (email, password, role, school_id, must_change_password) VALUES ($1, $2, 'STUDENT', $3, TRUE)`,
                [loginEmail, defaultPassword, school_id]
            );
        }

        await client.query('COMMIT'); // Commit Transaction

        res.status(201).json(newStudent);
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error(error);
        try {
            const fs = require('fs');
            fs.appendFileSync('backend_log.txt', `\n[${new Date().toISOString()}] ADD STUDENT ERROR: ${error.message}\nSTACK: ${error.stack}\nBODY: ${JSON.stringify(req.body)}\n`);
        } catch (logErr) { console.error("Logging failed", logErr); }

        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ message: 'Duplicate Admission No or Attendance ID. Please try again.' });
        }
        res.status(500).json({ message: 'Server error adding student: ' + error.message });
    } finally {
        client.release();
    }
};

const xlsx = require('xlsx');

// Bulk Upload Students
exports.bulkUploadStudents = async (req, res) => {
    const client = await pool.connect();
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        console.log('[Bulk Upload] Starting processing...');
        const school_id = req.user.schoolId;

        // Read Excel File
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log(`[Bulk Upload] Found ${rows.length} rows`);
        if (rows.length > 0) {
            console.log('[Bulk Upload] First Row Keys:', Object.keys(rows[0]));
        }

        if (rows.length === 0) {
            return res.status(400).json({ message: 'Excel sheet is empty' });
        }

        // Helper to find key case-insensitively and trimmed
        const getValue = (row, keyGuess) => {
            const exact = row[keyGuess];
            if (exact !== undefined) return exact;
            const key = Object.keys(row).find(k => k.trim().toLowerCase() === keyGuess.toLowerCase());
            return key ? row[key] : undefined;
        };

        // Fetch Classes and Sections for Mapping
        // Class Name -> ID, Section Name -> ID
        const classRes = await client.query('SELECT id, name FROM classes WHERE school_id = $1', [school_id]);

        // Fix: Sections table does not have school_id, must join with classes
        const sectionRes = await client.query(`
            SELECT s.id, s.name, s.class_id 
            FROM sections s 
            JOIN classes c ON s.class_id = c.id 
            WHERE c.school_id = $1
        `, [school_id]);

        const classMap = new Map(); // Name -> ID
        classRes.rows.forEach(c => classMap.set(c.name.trim().toLowerCase(), c.id));

        const sectionMap = new Map(); // Name + ClassID -> ID
        sectionRes.rows.forEach(s => sectionMap.set(`${s.name.trim().toLowerCase()}_${s.class_id}`, s.id));

        // Get School Prefix for Admission No Generation
        const schoolRes = await client.query('SELECT name FROM schools WHERE id = $1', [school_id]);
        const schoolName = schoolRes.rows[0]?.name || 'XX';
        let prefix = schoolName.replace(/[^a-zA-Z]/g, '').substring(0, 2).toUpperCase();
        if (prefix.length < 2) prefix = (prefix + 'X').substring(0, 2);

        let successCount = 0;
        let failureCount = 0;
        const errors = [];
        const addedStudents = [];

        await client.query('BEGIN');

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2; // Excel row number (1-index + header)

            try {
                // Validation - Updated for Split Names
                // Helper handles case-insensitive lookup
                const firstName = (getValue(row, 'First Name') || getValue(row, 'First_Name') || '').toString().trim();
                const middleName = (getValue(row, 'Middle Name') || getValue(row, 'Middle_Name') || '').toString().trim();
                const lastName = (getValue(row, 'Last Name') || getValue(row, 'Last_Name') || '').toString().trim();

                // Combine into full name
                let name = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

                // Fallback to single 'Name' or 'Student Name'
                if (!name) {
                    name = (getValue(row, 'Student Name') || getValue(row, 'Name') || '').toString().trim();
                }

                const className = getValue(row, 'Class');
                const sectionName = getValue(row, 'Section'); // Optional

                if (!name || !className) {
                    throw new Error('Student Name (or First Name) and Class are required');
                }

                // Resolve Class ID
                const classKey = className.toString().trim().toLowerCase();
                const classId = classMap.get(classKey);

                if (!classId) {
                    throw new Error(`Class "${className}" not found in system. Available: ${Array.from(classMap.keys()).join(', ')}`);
                }

                // Resolve Section ID (Optional)
                let sectionId = null;
                if (sectionName) {
                    const sectionKey = `${sectionName.toString().trim().toLowerCase()}_${classId}`;
                    sectionId = sectionMap.get(sectionKey);
                    if (!sectionId && sectionName.toString().toLowerCase() !== 'null' && sectionName.toString().trim() !== '') {
                        throw new Error(`Section "${sectionName}" not found for Class "${className}"`);
                    }
                }

                // Prepare Data
                const dobRaw = getValue(row, 'Date of Birth') || getValue(row, 'DOB');
                const dob = dobRaw ? (dobRaw instanceof Date ? dobRaw : new Date(dobRaw)) : null;

                const admissionDate = new Date(); // Always current date

                const gender = getValue(row, 'Gender') || 'Not Specified';
                const fatherName = getValue(row, 'Father\'s Name') || getValue(row, 'Father Name') || '';
                const motherName = getValue(row, 'Mother\'s Name') || getValue(row, 'Mother Name') || '';
                const contact = getValue(row, 'Mobile Number') || getValue(row, 'Contact Number') || '';
                const email = getValue(row, 'Email Address') || getValue(row, 'Email') || '';
                const address = getValue(row, 'Address') || '';

                let admissionNo = getValue(row, 'Admission No')?.toString().trim();

                // Auto-Generate Admission No if missing
                if (!admissionNo) {
                    let isUnique = false;
                    while (!isUnique) {
                        const rand4 = Math.floor(1000 + Math.random() * 9000);
                        admissionNo = `${prefix}S${rand4}`;
                        const check = await client.query('SELECT id FROM students WHERE admission_no = $1 AND school_id = $2', [admissionNo, school_id]);
                        if (check.rows.length === 0) isUnique = true;
                    }
                }

                // Generate Attendance ID
                const attendanceId = Math.floor(100000 + Math.random() * 900000).toString();

                // Calculate Roll No
                let rollCheck;
                if (sectionId) {
                    rollCheck = await client.query('SELECT MAX(roll_number) as max_roll FROM students WHERE class_id = $1 AND section_id = $2', [classId, sectionId]);
                } else {
                    rollCheck = await client.query('SELECT MAX(roll_number) as max_roll FROM students WHERE class_id = $1 AND section_id IS NULL', [classId]);
                }
                const rollNumber = (rollCheck.rows[0].max_roll || 0) + 1;

                // Minimal Insert for Debugging
                /*
                const instRes = await client.query(
                    `INSERT INTO students 
                    (school_id, name, admission_no, roll_number, gender, dob, class_id, section_id, 
                     father_name, mother_name, contact_number, email, address, attendance_id, admission_date) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
                    [school_id, name, admissionNo, rollNumber, gender, dob, classId, sectionId,
                        fatherName, motherName, contact, email, address, attendanceId, admissionDate]
                );
                */

                // Use EXACT query from working test_insert.js
                const instRes = await client.query(
                    `INSERT INTO students 
                    (school_id, name, first_name, last_name, admission_no, roll_number, gender, dob, class_id, section_id, 
                     father_name, mother_name, contact_number, email, address, attendance_id, admission_date) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id`,
                    [school_id, name, firstName, lastName, admissionNo, rollNumber, gender, dob, classId, sectionId,
                        fatherName, motherName, contact, email, address, attendanceId, admissionDate]
                );
                console.log('Insert Success:', instRes.rows[0].id);

                // Use provided email or fallback
                let finalLoginEmail = email || `${admissionNo.toLowerCase()}@student.school.com`;
                const defaultPassword = await bcrypt.hash('123456', 10);

                // Check if user exists FOR THIS ROLE (idempotency)
                const userCheck = await client.query('SELECT id FROM users WHERE email = $1 AND role = $2', [finalLoginEmail, 'STUDENT']);
                if (userCheck.rows.length === 0) {
                    await client.query(
                        `INSERT INTO users (email, password, role, school_id, must_change_password, linked_id) VALUES ($1, $2, 'STUDENT', $3, TRUE, $4)`,
                        [finalLoginEmail, defaultPassword, school_id, instRes.rows[0].id]
                    );
                } else if (email) {
                    // email exists for a student, fallback to ID-based login
                    finalLoginEmail = `${admissionNo.toLowerCase()}@student.school.com`;
                    const fallbackCheck = await client.query('SELECT id FROM users WHERE email = $1 AND role = $2', [finalLoginEmail, 'STUDENT']);
                    if (fallbackCheck.rows.length === 0) {
                        await client.query(
                            `INSERT INTO users (email, password, role, school_id, must_change_password, linked_id) VALUES ($1, $2, 'STUDENT', $3, TRUE, $4)`,
                            [finalLoginEmail, defaultPassword, school_id, instRes.rows[0].id]
                        );
                    }
                }

                successCount++;
                addedStudents.push({ name, admissionNo, status: 'Success' });

            } catch (rowError) {
                console.error(`Row ${rowNum} Error:`, rowError.message);
                failureCount++;
                errors.push({ row: rowNum, name: row['Student Name'] || 'Unknown', error: rowError.message });
            }
        }

        await client.query('COMMIT');

        res.json({
            message: 'Bulk upload completed',
            summary: {
                total: rows.length,
                success: successCount,
                failed: failureCount
            },
            errors: errors,
            added: addedStudents
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Bulk upload fatal error:', error);
        res.status(500).json({ message: 'Server error processing file: ' + error.message });
    } finally {
        client.release();
    }
};

// Get students with filters and pagination
exports.getStudents = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id, section_id, page = 1, limit = 50, search = '' } = req.query;

        const offset = (page - 1) * limit;

        console.log(`[Get Students] Fetching for class_id=${class_id}, section_id=${section_id || 'NULL'}`);

        let query = `
            SELECT s.*, c.name as class_name, sec.name as section_name 
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN sections sec ON s.section_id = sec.id
            WHERE s.school_id = $1 
            AND (s.status IS NULL OR s.status != 'Deleted')
        `;
        const params = [school_id];

        if (class_id) {
            params.push(class_id);
            query += ` AND s.class_id = $${params.length}`;
        }
        if (section_id) {
            params.push(section_id);
            query += ` AND s.section_id = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (s.name ILIKE $${params.length} OR s.admission_no ILIKE $${params.length})`;
        }

        // Add sorting and pagination - Order by roll number (ascending) for proper display
        query += ` ORDER BY s.roll_number ASC, s.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        console.log(`[Get Students] Found ${result.rows.length} students`);

        // Get total count for pagination metadata
        let countQuery = `SELECT COUNT(*) FROM students WHERE school_id = $1 AND (status IS NULL OR status != 'Deleted')`;
        const countParams = [school_id];

        if (class_id) {
            countParams.push(class_id);
            countQuery += ` AND class_id = $${countParams.length}`;
        }
        if (section_id) {
            countParams.push(section_id);
            countQuery += ` AND section_id = $${countParams.length}`;
        }
        if (search) {
            countParams.push(`%${search}%`);
            countQuery += ` AND (name ILIKE $${countParams.length} OR admission_no ILIKE $${countParams.length})`;
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            data: result.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error in getStudents:', error);
        res.status(500).json({ message: 'Server error fetching students' });
    }
};

// Update student
exports.updateStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, gender, dob, age,
            class_id, section_id,
            father_name, mother_name, contact_number, email, address,
            attendance_id, admission_date, status
        } = req.body;

        const safe_section_id = (section_id === '' || section_id === 'null' || section_id === undefined) ? null : section_id;

        // Split Name
        let first_name = name;
        let last_name = '';
        if (name && name.trim().includes(' ')) {
            const parts = name.trim().split(' ');
            first_name = parts[0];
            last_name = parts.slice(1).join(' ');
        }

        // Get Existing Student to check for email change
        const existingStudent = await pool.query('SELECT email, admission_no FROM students WHERE id = $1', [id]);

        const safe_age = (age === '' || age === 'null' || age === undefined) ? null : age;
        const safe_dob = (dob === '' || dob === 'null' || dob === undefined) ? null : dob;
        const safe_class_id = (class_id === '' || class_id === 'null' || class_id === undefined) ? null : class_id;
        const safe_attendance_id = (attendance_id === '' || attendance_id === 'null' || attendance_id === undefined) ? null : attendance_id;
        const safe_admission_date = (admission_date === '' || admission_date === 'null' || admission_date === undefined) ? null : admission_date;

        const result = await pool.query(
            `UPDATE students SET 
            name = $1, gender = $2, dob = $3, age = $4, class_id = $5, section_id = $6, 
            father_name = $7, mother_name = $8, contact_number = $9, email = $10, address = $11, attendance_id = $12, admission_date = $13,
            first_name = $14, last_name = $15, status = $16
            WHERE id = $17 AND school_id = $18 RETURNING *`,
            [name, gender, safe_dob, safe_age, safe_class_id, safe_section_id,
                father_name, mother_name, contact_number, email, address, safe_attendance_id, safe_admission_date,
                first_name, last_name, status,
                id, req.user.schoolId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const updatedStudent = result.rows[0];

        // SYNC USER TABLE: If email changed, update the Login User record
        if (existingStudent.rows.length > 0 && email && existingStudent.rows[0].email !== email) {
            try {
                // Try to find the user by OLD Email + Role
                await pool.query(
                    `UPDATE users SET email = $1 WHERE email = $2 AND role = 'STUDENT'`,
                    [email, existingStudent.rows[0].email]
                );
                console.log(`[Sync] Updated User Login Email for Student ${updatedStudent.admission_no}`);
            } catch (uErr) {
                console.error('Failed to sync user email:', uErr.message);
            }
        }

        // Trigger Notification
        sendPushNotification(updatedStudent.id, "Profile Updated", "Your student profile has been updated by the administration.", "Student")
            .catch(err => console.error('Notification failed:', err));

        res.json(updatedStudent);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error updating student' });
    }
};

// Delete student
// Soft Delete student (Move to Bin)
exports.deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "UPDATE students SET status = 'Deleted' WHERE id = $1 AND school_id = $2 RETURNING *",
            [id, req.user.schoolId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.json({ message: 'Student moved to bin successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error deleting student' });
    }
};

// Get Deleted Students (Bin)
exports.getDeletedStudents = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        console.log('Fetching deleted students for school:', school_id);
        const result = await pool.query(`
            SELECT s.*, c.name as class_name, sec.name as section_name 
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN sections sec ON s.section_id = sec.id
            WHERE s.school_id = $1 AND s.status = 'Deleted'
            ORDER BY s.id DESC
        `, [school_id]);

        console.log(`Found ${result.rows.length} deleted students`);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching deleted students:', error);
        res.status(500).json({ message: 'Server error fetching deleted students' });
    }
};

// Restore Student
exports.restoreStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "UPDATE students SET status = 'Active' WHERE id = $1 AND school_id = $2 RETURNING *",
            [id, req.user.schoolId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.json({ message: 'Student restored successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error restoring student' });
    }
};

// Get Unassigned Students (Students whose class/section was deleted)
exports.getUnassignedStudents = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        console.log('Fetching unassigned students for school:', school_id);
        const result = await pool.query(`
            SELECT s.*, c.name as class_name, sec.name as section_name 
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN sections sec ON s.section_id = sec.id
            WHERE s.school_id = $1 AND s.status = 'Unassigned'
            ORDER BY s.id DESC
        `, [school_id]);

        console.log(`Found ${result.rows.length} unassigned students`);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching unassigned students:', error);
        res.status(500).json({ message: 'Server error fetching unassigned students' });
    }
};



// Permanent Delete Student - Preserves Marks and Certificates
// Permanent Delete Student - Preserves Marks and Certificates
exports.permanentDeleteStudent = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const school_id = req.user.schoolId;

        await client.query('BEGIN');

        console.log(`[PERMANENT DELETE STUDENT] Starting deletion for student ID: ${id}`);

        // Get student info before deletion
        const studentRes = await client.query(
            'SELECT name, email, admission_no FROM students WHERE id = $1 AND school_id = $2',
            [id, school_id]
        );

        if (studentRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Student not found' });
        }

        const { name, email, admission_no } = studentRes.rows[0];
        console.log(`[PERMANENT DELETE STUDENT] Deleting student: ${name} (${admission_no})`);

        // Get user_id from users table
        let user_id = null;
        try {
            const userRes = await client.query(
                'SELECT id FROM users WHERE email = $1 OR email = $2',
                [email, `${admission_no.toLowerCase()}@student.school.com`]
            );
            if (userRes.rows.length > 0) {
                user_id = userRes.rows[0].id;
            }
        } catch (e) {
            console.log('[PERMANENT DELETE STUDENT] Could not find user account:', e.message);
        }

        // PRESERVE: marks and certificates by storing student info and nullifying student_id
        console.log('[PERMANENT DELETE STUDENT] Preserving marks and certificates...');

        try {
            // Check if columns exist first (Safety Check)
            const checkCols = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'marks' AND column_name = 'deleted_student_name'
            `);

            if (checkCols.rows.length === 0) {
                // Auto-add columns if missing (Emergency Fix)
                console.log('[PERMANENT DELETE STUDENT] Adding missing columns to marks table...');
                await client.query(`
                    ALTER TABLE marks 
                    ADD COLUMN IF NOT EXISTS deleted_student_name VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS deleted_student_admission_no VARCHAR(50),
                    ALTER COLUMN student_id DROP NOT NULL;
                `);
            }

            // Store student info in marks table before nullifying link
            const marksResult = await client.query(
                `UPDATE marks 
                 SET deleted_student_name = $1, 
                     deleted_student_admission_no = $2,
                     student_id = NULL 
                 WHERE student_id = $3`,
                [name, admission_no, id]
            );
            console.log(`[PERMANENT DELETE STUDENT] Preserved ${marksResult.rowCount} marks records`);

            // Same for certificates
            try {
                await client.query(`
                    ALTER TABLE student_certificates 
                    ADD COLUMN IF NOT EXISTS deleted_student_name VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS deleted_student_admission_no VARCHAR(50),
                    ALTER COLUMN student_id DROP NOT NULL;
                `);

                const certsResult = await client.query(
                    `UPDATE student_certificates 
                     SET deleted_student_name = $1,
                         deleted_student_admission_no = $2,
                         student_id = NULL 
                     WHERE student_id = $3`,
                    [name, admission_no, id]
                );
                console.log(`[PERMANENT DELETE STUDENT] Preserved ${certsResult.rowCount} certificate records`);
            } catch (certError) {
                console.warn('[PERMANENT DELETE STUDENT] Certificate preservation failed (non-critical):', certError.message);
            }

        } catch (e) {
            console.error('[PERMANENT DELETE STUDENT] CRITICAL Error preserving records:', e);
            throw new Error(`Failed to preserve academic records: ${e.message}`);
        }

        // DELETE: Everything else
        const tablesToDelete = [
            { name: 'attendance', column: 'student_id' },
            { name: 'student_attendance', column: 'student_id' },
            { name: 'fee_payments', column: 'student_id' },
            { name: 'student_fees', column: 'student_id' },
            { name: 'hostel_payments', column: 'student_id' },
            { name: 'hostel_mess_bills', column: 'student_id' },
            { name: 'hostel_allocations', column: 'student_id' },
            { name: 'leave_requests', column: 'student_id' },
            { name: 'student_promotions', column: 'student_id' },
            { name: 'doubt_replies', subquery: 'doubt_id IN (SELECT id FROM doubts WHERE student_id = $1)' }, // Delete replies first
            { name: 'doubts', column: 'student_id' },
            { name: 'library_transactions', column: 'student_id' },
            { name: 'notifications', subquery: 'user_id = $1', useUserId: true }
        ];

        for (const table of tablesToDelete) {
            try {
                // SAVEPOINT: Isolate each delete so one failure doesn't kill the transaction
                await client.query(`SAVEPOINT sp_${table.name}`);

                let query;
                let param;

                if (table.subquery) {
                    // Safety: If useUserId is true but user_id is null, skip (nothing to delete)
                    if (table.useUserId && !user_id) {
                        await client.query(`RELEASE SAVEPOINT sp_${table.name}`);
                        continue;
                    }

                    query = `DELETE FROM ${table.name} WHERE ${table.subquery}`;
                    param = table.useUserId ? user_id : id;
                } else {
                    query = `DELETE FROM ${table.name} WHERE ${table.column} = $1`;
                    param = id;
                }

                await client.query(query, [param]);

                // Success: Commit sub-transaction
                await client.query(`RELEASE SAVEPOINT sp_${table.name}`);

            } catch (e) {
                // Failure: Rollback ONLY this sub-transaction
                await client.query(`ROLLBACK TO SAVEPOINT sp_${table.name}`);

                // If table doesn't exist (42P01), ignore. Else log warning.
                if (e.code !== '42P01') {
                    console.warn(`[PERMANENT DELETE STUDENT] Warning cleanup ${table.name}: ${e.message}`);
                }
            }
        }

        // Delete student record
        console.log('[PERMANENT DELETE STUDENT] Deleting student record...');
        await client.query('DELETE FROM students WHERE id = $1', [id]);

        // Delete user account if exists
        if (user_id) {
            try {
                await client.query('DELETE FROM users WHERE id = $1', [user_id]);
                console.log('[PERMANENT DELETE STUDENT] Deleted associated user account');
            } catch (e) {
                console.log('[PERMANENT DELETE STUDENT] User deletion skipped:', e.message);
            }
        }

        await client.query('COMMIT');
        console.log(`[PERMANENT DELETE STUDENT] ✅ Successfully deleted student: ${name}`);

        res.json({
            message: `Student "${name}" permanently deleted. Academic records (marks & certificates) preserved.`,
            preserved: ['marks', 'certificates'],
            deletedStudent: name
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[PERMANENT DELETE STUDENT] ❌ Error:', error);
        res.status(500).json({
            message: 'Server error deleting student',
            error: error.message,
            detail: error.detail || 'Check server logs'
        });
    } finally {
        client.release();
    }
};



// Mark Attendance (Bulk - Optimized for Scale)
exports.markAttendance = async (req, res) => {
    const client = await pool.connect();
    try {
        const { date, attendanceData } = req.body; // attendanceData: [{ student_id, status }]
        const school_id = req.user.schoolId;

        if (!attendanceData || attendanceData.length === 0) {
            return res.status(400).json({ message: 'No attendance data provided' });
        }

        await client.query('BEGIN');

        // Extract arrays for bulk insertion using UNNEST
        const studentIds = attendanceData.map(r => r.student_id);
        const statuses = attendanceData.map(r => r.status);

        const bulkQuery = `
        INSERT INTO attendance (school_id, student_id, date, status)
        SELECT $1, unnest($2::int[]), $3, unnest($4::text[])
        ON CONFLICT (student_id, date) 
        DO UPDATE SET status = EXCLUDED.status
    `;

        await client.query(bulkQuery, [school_id, studentIds, date, statuses]);

        // Send notifications asynchronously without blocking response
        // Note: For 100k scale, you'd usually push these to a background worker (Redis/BullMQ)
        attendanceData.forEach(async (record) => {
            if (['Absent', 'Present', 'Late'].includes(record.status)) {
                try {
                    const studentRes = await pool.query('SELECT name, contact_number, id, school_id FROM students WHERE id = $1', [record.student_id]);
                    if (studentRes.rows.length > 0) {
                        // Ensure we pass the full object needed by notificationService -> user object needs id, name, contact_number
                        const studentObj = studentRes.rows[0];
                        sendAttendanceNotification(studentObj, record.status);
                    }
                } catch (e) { console.error('Notification error:', e); }
            }
        });

        await client.query('COMMIT');
        res.json({ message: 'Attendance updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Bulk attendance error:', error);
        res.status(500).json({ message: 'Server error marking attendance' });
    } finally {
        client.release();
    }
};

// Get Attendance Report
exports.getAttendanceReport = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id, section_id, month, year } = req.query;

        // Construct date range for the month
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

        let query = `
        WITH month_holidays AS (
            SELECT holiday_date, holiday_name
            FROM school_holidays
            WHERE school_id = $1 AND holiday_date >= $2 AND holiday_date <= $3
        )
        SELECT 
            s.id as student_id, 
            s.name, 
            TO_CHAR(d.date, 'YYYY-MM-DD') as date,
            COALESCE(a.status, CASE WHEN mh.holiday_date IS NOT NULL THEN 'Holiday' ELSE 'Unmarked' END) as status
        FROM students s
        CROSS JOIN generate_series($2::date, $3::date, '1 day'::interval) d(date)
        LEFT JOIN attendance a ON s.id = a.student_id AND a.date = d.date::date
        LEFT JOIN month_holidays mh ON mh.holiday_date = d.date::date
        WHERE s.school_id = $1 AND (s.status IS NULL OR s.status != 'Deleted')
        `;
        const params = [school_id, startDate, endDate];

        if (class_id) {
            params.push(class_id);
            query += ` AND s.class_id = $${params.length}`;
        }
        if (section_id) {
            params.push(section_id);
            query += ` AND s.section_id = $${params.length}`;
        }

        query += ` ORDER BY s.name ASC, d.date ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching attendance' });
    }
};

// Get My Attendance Report (For Students)
// Get My Attendance Report
exports.getMyAttendanceReport = async (req, res) => {
    try {
        const { id, role, email, schoolId, linkedId } = req.user;
        let student_id = linkedId;

        // Fallback Logic
        if (!student_id && role === 'STUDENT') {
            const studentRes = await pool.query(
                'SELECT id FROM students WHERE school_id = $1 AND LOWER(email) = LOWER($2)',
                [schoolId, email]
            );
            if (studentRes.rows.length > 0) student_id = studentRes.rows[0].id;
            else {
                const prefix = email.split('@')[0];
                const s2 = await pool.query('SELECT id FROM students WHERE admission_no = $1', [prefix]);
                if (s2.rows.length > 0) student_id = s2.rows[0].id;
            }
        }

        if (!student_id) return res.status(404).json({ message: 'Student profile not found' });

        const { month, year } = req.query;

        // 1. Fetch Daily Records
        let result;
        if (month && year) {
            const startDate = `${year}-${month}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];
            const query = `
                WITH month_holidays AS (
                    SELECT holiday_date, holiday_name
                    FROM school_holidays
                    WHERE school_id = $4 AND holiday_date >= $2 AND holiday_date <= $3
                )
                SELECT 
                    TO_CHAR(d.date, 'YYYY-MM-DD') as date_str,
                    COALESCE(a.status, CASE WHEN mh.holiday_date IS NOT NULL THEN 'Holiday' ELSE 'Unmarked' END) as status
                FROM generate_series($2::date, $3::date, '1 day'::interval) d(date)
                LEFT JOIN attendance a ON a.student_id = $1 AND a.date = d.date::date
                LEFT JOIN month_holidays mh ON mh.holiday_date = d.date::date
                ORDER BY d.date ASC
            `;
            result = await pool.query(query, [student_id, startDate, endDate, schoolId]);
        } else {
            const query = `
                SELECT status, TO_CHAR(date, 'YYYY-MM-DD') as date_str
                FROM attendance
                WHERE student_id = $1
                ORDER BY date ASC
            `;
            result = await pool.query(query, [student_id]);
        }

        const report = result.rows.reduce((acc, row) => {
            acc[row.date_str] = row.status;
            return acc;
        }, {});

        // 2. Fetch Aggregated Stats
        let statsQuery = `
        SELECT 
            COUNT(*) as total_days,
            SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_days,
            SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_days,
            SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late_days,
            SUM(CASE WHEN status = 'Half Day' THEN 1 ELSE 0 END) as half_days
        FROM attendance
        WHERE student_id = $1
    `;
        // Reuse params structure but verify logic
        const statsParams = [student_id];
        if (month && year) {
            statsQuery += ` AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3`;
            statsParams.push(month, year);
        }

        const statsRes = await pool.query(statsQuery, statsParams);
        const stats = statsRes.rows[0];

        const total = parseInt(stats.total_days || 0);
        const present = parseInt(stats.present_days || 0);
        const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : 0;

        res.json({
            attendancePercentage: percentage,
            totalDays: total,
            presentDays: present,
            absentDays: parseInt(stats.absent_days || 0),
            lateDays: parseInt(stats.late_days || 0),
            halfDays: parseInt(stats.half_days || 0),
            report: report, // CRITICAL: This was missing in response
            monthlyRecords: result.rows
        });

    } catch (error) {
        console.error('Error fetching my attendance:', error);
        res.status(500).json({ message: 'Server error fetching attendance' });
    }
};

// Get Attendance Summary (Daily Class-wise)
exports.getAttendanceSummary = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { date } = req.query;

        const query = `
        SELECT 
            c.name as class_name, 
            sec.name as section_name, 
            COUNT(s.id) as total_students,
            SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
            SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) as late_count,
            SUM(CASE WHEN a.status IS NULL THEN 1 ELSE 0 END) as not_marked_count
        FROM students s
        JOIN classes c ON s.class_id = c.id
        JOIN sections sec ON s.section_id = sec.id
        LEFT JOIN attendance a ON s.id = a.student_id AND a.date = $2
        WHERE s.school_id = $1 AND (s.status IS NULL OR s.status != 'Deleted')
        GROUP BY c.name, sec.name
        ORDER BY c.name, sec.name
    `;

        const result = await pool.query(query, [school_id, date]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching attendance summary' });
    }
};

// Get Daily Attendance Details (List of students with status)
exports.getDailyAttendance = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { date, class_id, section_id } = req.query;

        if (!class_id || !date) {
            return res.status(400).json({ message: 'Class and Date are required' });
        }

        let query = `
        SELECT s.id, s.name, s.roll_number, s.contact_number, COALESCE(a.status, 'Unmarked') as status
        FROM students s
        LEFT JOIN attendance a ON s.id = a.student_id AND a.date = $2
        WHERE s.school_id = $1 AND s.class_id = $3 AND (s.status IS NULL OR s.status != 'Deleted')
    `;

        const params = [school_id, date, class_id];

        if (section_id) {
            params.push(section_id);
            query += ` AND s.section_id = $${params.length}`;
        }

        query += ` ORDER BY s.roll_number ASC, s.name ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching daily attendance' });
    }
};

// Reorder Roll Numbers
exports.reorderRollNumbers = async (req, res) => {
    const client = await pool.connect();
    try {
        const { class_id, section_id } = req.body;
        const school_id = req.user.schoolId;

        await client.query('BEGIN');

        // Handle both classes with and without sections
        let studentsRef;
        if (section_id && section_id !== '' && section_id !== 'null') {
            // Fetch students for specific section, ordered by Name (then by existing roll_number as tiebreaker)
            studentsRef = await client.query(
                `SELECT id FROM students 
             WHERE school_id = $1 AND class_id = $2 AND section_id = $3 AND (status IS NULL OR status != 'Deleted')
             ORDER BY name ASC, roll_number ASC`,
                [school_id, class_id, section_id]
            );
        } else {
            // Fetch students for class without section (section_id IS NULL)
            studentsRef = await client.query(
                `SELECT id FROM students 
             WHERE school_id = $1 AND class_id = $2 AND section_id IS NULL AND (status IS NULL OR status != 'Deleted')
             ORDER BY name ASC, roll_number ASC`,
                [school_id, class_id]
            );
        }

        // Update each student with new roll number
        for (let i = 0; i < studentsRef.rows.length; i++) {
            await client.query(
                `UPDATE students SET roll_number = $1 WHERE id = $2`,
                [i + 1, studentsRef.rows[i].id]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Roll numbers updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Server error reordering roll numbers' });
    } finally {
        client.release();
    }
};
// Get Student Profile (Logged In)
// Get Student Profile (Logged In)
exports.getStudentProfile = async (req, res) => {
    try {
        const { email, schoolId, linkedId } = req.user;

        let query;
        let params;

        if (linkedId) {
            // Prioritize the Linked ID passed from Login (Critical for shared emails/siblings)
            query = `
            SELECT s.*, c.name as class_name, sec.name as section_name 
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN sections sec ON s.section_id = sec.id
            WHERE s.id = $1 AND s.school_id = $2 AND (s.status IS NULL OR s.status != 'Deleted')
        `;
            params = [linkedId, schoolId];
        } else {
            // Fallback to Email Lookup
            query = `
            SELECT s.*, c.name as class_name, sec.name as section_name 
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN sections sec ON s.section_id = sec.id
            WHERE s.school_id = $1 AND LOWER(s.email) = LOWER($2) AND (s.status IS NULL OR s.status != 'Deleted')
        `;
            params = [schoolId, email];
        }

        let result = await pool.query(query, params);

        // 2. If not found, check if email is pattern-based (admission_no@student.school.com)
        if (result.rows.length === 0) {
            const emailParts = email.split('@');
            if (emailParts.length === 2) {
                // Assume the part before @ is the admission number (case insensitive)
                const possibleAdmissionNo = emailParts[0];
                query = `
                SELECT s.*, c.name as class_name, sec.name as section_name 
                FROM students s
                LEFT JOIN classes c ON s.class_id = c.id
                LEFT JOIN sections sec ON s.section_id = sec.id
                WHERE s.school_id = $1 AND LOWER(s.admission_no) = LOWER($2) AND (s.status IS NULL OR s.status != 'Deleted')
            `;
                result = await pool.query(query, [schoolId, possibleAdmissionNo]);
            }
        }

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching student profile:', error);
        res.status(500).json({ message: 'Server error fetching profile' });
    }
};

// Get My Fees (for Students)
// Get My Fees (for Students)
// Get My Fees (for Students)
exports.getMyFees = async (req, res) => {
    try {
        console.log('[getMyFees] Request started for user:', req.user.email);
        const { id, role, email, schoolId, linkedId } = req.user;
        let student_id = linkedId;

        if (!student_id && role === 'STUDENT') {
            console.log('[getMyFees] linkedId missing, attempting fallback lookup...');
            const studentRes = await pool.query(
                'SELECT id FROM students WHERE school_id = $1 AND LOWER(email) = LOWER($2)',
                [schoolId, email]
            );
            if (studentRes.rows.length > 0) {
                student_id = studentRes.rows[0].id;
                console.log('[getMyFees] Found student via email:', student_id);
            } else {
                const prefix = email.split('@')[0];
                const studentRes2 = await pool.query(
                    'SELECT id FROM students WHERE school_id = $1 AND LOWER(admission_no) = LOWER($2)',
                    [schoolId, prefix]
                );
                if (studentRes2.rows.length > 0) {
                    student_id = studentRes2.rows[0].id;
                    console.log('[getMyFees] Found student via admission_no:', student_id);
                }
            }
        }

        console.log('[getMyFees] Resolved student_id:', student_id);

        if (!student_id) {
            console.log('[getMyFees] Failed to resolve student ID.');
            return res.status(404).json({ message: 'Student profile not found' });
        }

        // 1. Fetch Paid History
        console.log('[getMyFees] Fetching payments...');
        const payments = await pool.query(`
        SELECT p.id, p.amount_paid as amount, TO_CHAR(p.payment_date, 'YYYY-MM-DD') as date, p.payment_method, p.receipt_no, fs.title as "feeType"
        FROM fee_payments p
        JOIN fee_structures fs ON p.fee_structure_id = fs.id
        WHERE p.student_id = $1
        ORDER BY p.payment_date DESC
    `, [student_id]);
        console.log(`[getMyFees] Payments fetched: ${payments.rows.length}`);

        // 2. Calculate Totals
        console.log('[getMyFees] Fetching student class info...');
        const studentInfo = await pool.query('SELECT class_id FROM students WHERE id = $1', [student_id]);

        if (studentInfo.rows.length === 0) {
            console.log('[getMyFees] Student ID exists but record not found in DB!');
            return res.status(404).json({ message: 'Student record not found' });
        }

        const class_id = studentInfo.rows[0].class_id;
        console.log('[getMyFees] Found class_id:', class_id);

        let totalFees = 0;
        let paidAmount = 0;

        if (class_id) {
            console.log('[getMyFees] Fetching fee structures...');
            const structures = await pool.query('SELECT amount FROM fee_structures WHERE class_id = $1 AND school_id = $2', [class_id, schoolId]);
            console.log(`[getMyFees] Structures found: ${structures.rows.length}`);
            structures.rows.forEach(s => totalFees += parseFloat(s.amount || 0));
        } else {
            console.log('[getMyFees] No class_id found for student.');
        }

        payments.rows.forEach(p => {
            paidAmount += parseFloat(p.amount || 0);
        });

        let pendingAmount = totalFees - paidAmount;
        if (pendingAmount < 0) pendingAmount = 0;

        const responseData = {
            totalFees,
            paidAmount,
            pendingAmount,
            paymentHistory: payments.rows
        };

        console.log('[getMyFees] Sending response:', responseData);
        res.json(responseData);

    } catch (error) {
        console.error('[getMyFees] Critical Error:', error);
        res.status(500).json({ message: 'Server error fetching fees', error: error.message });
    }
};

// Get Deleted Students' Marks (Left Students)
exports.getDeletedStudentMarks = async (req, res) => {
    try {
        const { admission_no, academic_year_id, search } = req.query;
        const school_id = req.user.schoolId;

        let query = `
            SELECT m.*, et.name as exam_name, et.max_marks,
                   s.name as subject_name,
                   m.deleted_student_name as student_name, 
                   m.deleted_student_admission_no as admission_no,
                   ay.year_label
            FROM marks m
            LEFT JOIN exam_types et ON m.exam_type_id = et.id
            LEFT JOIN subjects s ON m.subject_id = s.id
            LEFT JOIN academic_years ay ON m.academic_year_id = ay.id
            WHERE m.school_id = $1 
            AND m.student_id IS NULL 
            AND m.deleted_student_name IS NOT NULL
        `;

        const params = [school_id];
        let paramIndex = 2;

        if (admission_no) {
            query += ` AND m.deleted_student_admission_no = $${paramIndex}`;
            params.push(admission_no);
            paramIndex++;
        }

        if (academic_year_id) {
            query += ` AND m.academic_year_id = $${paramIndex}`;
            params.push(academic_year_id);
            paramIndex++;
        }

        if (search) {
            query += ` AND (m.deleted_student_name ILIKE $${paramIndex} OR m.deleted_student_admission_no ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY ay.start_date DESC, m.deleted_student_name`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching deleted student marks:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get Deleted Students' Certificates (Left Students)
exports.getDeletedStudentCertificates = async (req, res) => {
    try {
        const { class_id, search } = req.query;
        const school_id = req.user.schoolId;

        let query = `
            SELECT sc.id, sc.certificate_type, sc.issue_date, sc.remarks, sc.deleted_student_name, sc.deleted_student_admission_no,
                   c.name as class_name
            FROM student_certificates sc
            LEFT JOIN classes c ON sc.class_id = c.id
            LEFT JOIN academic_years ay ON sc.academic_year_id = ay.id
            WHERE sc.school_id = $1 AND sc.is_deleted_student = TRUE
        `;
        const params = [school_id];
        let paramIndex = 2;

        if (class_id) {
            query += ` AND sc.class_id = $${paramIndex}`;
            params.push(class_id);
            paramIndex++;
        }

        if (search) {
            query += ` AND (sc.deleted_student_name ILIKE $${paramIndex} OR sc.deleted_student_admission_no ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY ay.start_date DESC, sc.deleted_student_name`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching deleted student certificates:', error);
        res.status(500).json({ message: 'Server error' });
    }
};