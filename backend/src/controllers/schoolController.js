const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const { generateAnnualCalendar } = require('../utils/holidayUtils');

// Create a new school with admin and configuration
const createSchool = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            name, address, contactEmail, contactNumber,
            adminEmail, adminPassword,
            classes // Array of { name, sections: [], subjects: [] }
        } = req.body;

        console.log(`[CREATE SCHOOL REQUEST] Name: ${name}, Email: ${contactEmail}`);

        // Validation
        if (!name || !contactEmail || !adminEmail || !adminPassword) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        await client.query('BEGIN');

        // Generate unique 6-digit school code
        let schoolCode;
        let isUnique = false;

        while (!isUnique) {
            schoolCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit random
            const check = await client.query("SELECT id FROM schools WHERE school_code = $1", [schoolCode]);
            isUnique = check.rows.length === 0;
        }

        // Check if contact email already exists (Active or Inactive but not Deleted)
        console.log(`[CREATE SCHOOL] Checking email: ${contactEmail}`);
        const contactEmailCheck = await client.query("SELECT id, status FROM schools WHERE contact_email = $1 AND (status IS NULL OR status != 'Deleted')", [contactEmail]);
        if (contactEmailCheck.rows.length > 0) {
            console.log(`[CREATE SCHOOL] Found conflicting school:`, contactEmailCheck.rows[0]);
            await client.query('ROLLBACK');
            client.release();
            return res.status(400).json({ message: 'Contact email already exists for another school' });
        }

        // Check if contact number already exists
        if (contactNumber) {
            const contactNumberCheck = await client.query("SELECT id FROM schools WHERE contact_number = $1", [contactNumber]);
            if (contactNumberCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                client.release();
                return res.status(400).json({ message: 'Contact number already exists for another school' });
            }
        }

        // Check if admin email already exists in users table (Allow reuse if linked school is deleted)
        const adminEmailCheck = await client.query(`
            SELECT u.id 
            FROM users u 
            LEFT JOIN schools s ON u.school_id = s.id 
            WHERE u.email = $1 
            AND (u.school_id IS NULL OR s.status IS NULL OR s.status != 'Deleted')
        `, [adminEmail]);

        if (adminEmailCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(400).json({ message: 'Admin email already exists for an active school' });
        }

        // 1. Create School
        const schoolRes = await client.query(
            `INSERT INTO schools (name, address, contact_email, contact_number, school_code, institution_type) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, school_code`,
            [name, address, contactEmail, contactNumber, schoolCode, req.body.institution_type || 'SCHOOL']
        );
        const schoolId = schoolRes.rows[0].id;
        const generatedCode = schoolRes.rows[0].school_code;

        // 2. Create School Admin
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await client.query(
            `INSERT INTO users (email, password, role, school_id, must_change_password) 
             VALUES ($1, $2, 'SCHOOL_ADMIN', $3, FALSE)`,
            [adminEmail, hashedPassword, schoolId]
        );

        // 3. Process Academic Configuration (Classes, Sections, Subjects)
        if (classes && Array.isArray(classes)) {
            for (const cls of classes) {
                // Insert Class
                const classRes = await client.query(
                    `INSERT INTO classes (school_id, name) VALUES ($1, $2) RETURNING id`,
                    [schoolId, cls.name]
                );
                const classId = classRes.rows[0].id;

                // Insert Sections
                if (cls.sections && Array.isArray(cls.sections)) {
                    for (const secName of cls.sections) {
                        await client.query(
                            `INSERT INTO sections (class_id, name) VALUES ($1, $2)`,
                            [classId, secName]
                        );
                    }
                }

                // Insert Subjects
                if (cls.subjects && Array.isArray(cls.subjects)) {
                    for (const subName of cls.subjects) {
                        await client.query(
                            `INSERT INTO subjects (class_id, name) VALUES ($1, $2)`,
                            [classId, subName]
                        );
                    }
                }
            }
        }

        // 4. Auto-Generate Holidays for Current AND Next Year (Official Calendar + Sundays)
        // TEMPORARILY DISABLED FOR TESTING - TODO: Move to background job
        /*
        const currentYear = new Date().getFullYear();
        const yearsToGen = [currentYear, currentYear + 1];

        for (const yr of yearsToGen) {
            const annualHolidays = generateAnnualCalendar(yr);
            for (const h of annualHolidays) {
                // Insert Holiday
                await client.query(`
                    INSERT INTO school_holidays (school_id, holiday_date, holiday_name, is_paid)
                    VALUES ($1, $2, $3, true)
                    ON CONFLICT (school_id, holiday_date) DO UPDATE SET holiday_name = EXCLUDED.holiday_name
                 `, [schoolId, h.holiday_date, h.holiday_name]);

                // Add to Events (Calendar)
                await client.query(`
                    INSERT INTO events (school_id, title, event_type, start_date, end_date, description, audience)
                    VALUES ($1, $2, 'Holiday', $3, $3, 'Official Holiday', 'All')
                 `, [schoolId, h.holiday_name, h.holiday_date]);
            }
        }
        */

        await client.query('COMMIT');

        res.status(201).json({
            message: 'School created successfully',
            schoolId,
            schoolCode: generatedCode,
            adminEmail
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create School Error:', error);
        res.status(500).json({
            message: 'Error creating school',
            error: error.message
        });
    } finally {
        client.release();
    }
};

// Get all schools with member counts
const getSchools = async (req, res) => {
    try {
        // Fetch schools with member statistics
        const result = await pool.query(`
            SELECT 
                s.*,
                (SELECT COUNT(*) FROM students WHERE school_id = s.id AND (status IS NULL OR status != 'Deleted')) as student_count,
                (SELECT COUNT(*) FROM teachers WHERE school_id = s.id) as teacher_count,
                (SELECT COUNT(*) FROM staff WHERE school_id = s.id) as staff_count
            FROM schools s
            WHERE s.status != 'Deleted' OR s.status IS NULL
            ORDER BY s.created_at DESC
        `);

        // Calculate total members for each school
        const schoolsWithStats = result.rows.map(school => ({
            ...school,
            total_members: parseInt(school.student_count || 0) + parseInt(school.teacher_count || 0) + parseInt(school.staff_count || 0)
        }));

        res.json(schoolsWithStats);
    } catch (error) {
        console.error('Error fetching schools:', error);
        res.status(500).json({ message: 'Error fetching schools', error: error.message });
    }
};

// Get Deleted Schools (Dustbin)
const getDeletedSchools = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                s.*,
                (SELECT COUNT(*) FROM students WHERE school_id = s.id AND (status IS NULL OR status != 'Deleted')) as student_count,
                (SELECT COUNT(*) FROM teachers WHERE school_id = s.id) as teacher_count,
                (SELECT COUNT(*) FROM staff WHERE school_id = s.id) as staff_count
            FROM schools s
            WHERE s.status = 'Deleted'
            ORDER BY s.created_at DESC
        `);

        const schoolsWithStats = result.rows.map(school => ({
            ...school,
            total_members: parseInt(school.student_count || 0) + parseInt(school.teacher_count || 0) + parseInt(school.staff_count || 0)
        }));

        res.json(schoolsWithStats);
    } catch (error) {
        console.error('Get Deleted Schools Error:', error);
        res.status(500).json({ message: 'Error fetching deleted schools', error: error.message });
    }
};

// Get single school details with configuration
const getSchoolDetails = async (req, res) => {
    const { id } = req.params;
    await fetchSchoolDetails(id, res);
};

// Get current logged-in school admin's school details
const getMySchool = async (req, res) => {
    let id = req.user.schoolId;

    // Fallback: If schoolId is missing in token (legacy token), fetch from DB
    if (!id) {
        try {
            const uRes = await pool.query('SELECT school_id FROM users WHERE id = $1', [req.user.id]);
            if (uRes.rows.length > 0) {
                id = uRes.rows[0].school_id;
            }
        } catch (e) {
            console.error('Error fetching user school_id fallback:', e);
        }
    }

    if (!id) {
        return res.status(400).json({ message: 'No school ID associated with this user.' });
    }

    await fetchSchoolDetails(id, res);
};

// Helper function to fetch school details
const fetchSchoolDetails = async (id, res) => {
    console.log(`Getting details for school ID: ${id}`); // Debug log

    try {
        // Fetch basic school info with member counts
        const schoolRes = await pool.query(`
            SELECT 
                s.*,
                (SELECT COUNT(*) FROM students WHERE school_id = s.id AND (status IS NULL OR status NOT IN ('Deleted', 'Unassigned'))) as student_count,
                (SELECT COUNT(*) FROM teachers WHERE school_id = s.id) as teacher_count,
                (SELECT COUNT(*) FROM staff WHERE school_id = s.id) as staff_count
            FROM schools s
            WHERE s.id = $1
        `, [id]);
        if (schoolRes.rows.length === 0) {
            console.log(`School not found for ID: ${id}`);
            return res.status(404).json({ message: 'School not found' });
        }
        const school = schoolRes.rows[0];

        // Calculate total members
        school.total_members = parseInt(school.student_count || 0) + parseInt(school.teacher_count || 0) + parseInt(school.staff_count || 0);

        // Fetch Classes
        const classesRes = await pool.query(`
            SELECT 
                c.id as class_id, c.name as class_name,
                COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) FILTER (WHERE s.id IS NOT NULL), '[]'::jsonb) as sections,
                COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', sub.id, 'name', sub.name)) FILTER (WHERE sub.id IS NOT NULL), '[]'::jsonb) as subjects
            FROM classes c
            LEFT JOIN sections s ON c.id = s.class_id
            LEFT JOIN subjects sub ON c.id = sub.class_id
            WHERE c.school_id = $1
            GROUP BY c.id, c.name
        `, [id]);

        school.classes = classesRes.rows;

        // Fetch ALL distinct subjects for this school (for autocomplete)
        const subjectsRes = await pool.query(`
            SELECT DISTINCT name 
            FROM subjects 
            WHERE class_id IN (SELECT id FROM classes WHERE school_id = $1)
            ORDER BY name ASC
        `, [id]);
        school.subjects = subjectsRes.rows.map(r => r.name);

        console.log(`Successfully fetched details for school ID: ${id}`);
        res.json(school);
    } catch (error) {
        console.error('Error in getSchoolDetails:', error);
        res.status(500).json({ message: 'Error fetching school details', error: error.message, stack: error.stack });
    }
};

// Update school details with class/section deletion support
const updateSchool = async (req, res) => {
    const { id } = req.params;
    const { name, address, contactEmail, contactNumber, classes, allowDeletions, marksheet_template } = req.body;
    console.log(`[UPDATE SCHOOL] ID: ${id}, Body:`, JSON.stringify(req.body, null, 2));

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        console.log('[UPDATE SCHOOL] Transaction Started');

        // 1. Update Basic Info including API Key and Marksheet Template
        const result = await client.query(
            `UPDATE schools 
             SET name = $1, address = $2, contact_email = $3, contact_number = $4, institution_type = $5, gemini_api_key = COALESCE($6, gemini_api_key), marksheet_template = COALESCE($8, marksheet_template)
             WHERE id = $7 RETURNING *`,
            [name, address, contactEmail, contactNumber, req.body.institution_type || 'SCHOOL', req.body.geminiApiKey, id, marksheet_template]
        );
        console.log('[UPDATE SCHOOL] Basic Info Updated');

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'School not found' });
        }

        // 2. Full Sync of Academic Configuration
        if (classes && Array.isArray(classes)) {
            // A. Get existing classes and sections
            const existingClassesRes = await client.query('SELECT id, name FROM classes WHERE school_id = $1', [id]);
            const existingClasses = existingClassesRes.rows;

            const processedClassIds = [];
            const processedSectionIds = [];

            for (const cls of classes) {
                console.log(`[UPDATE SCHOOL] Processing Class Name: ${cls.name}`);
                let classId;

                // 1. Resolve Class ID
                const existingClass = existingClasses.find(ec => ec.name === cls.name);
                if (existingClass) {
                    classId = existingClass.id;
                    console.log(`[UPDATE SCHOOL] Found Existing Class ID: ${classId}`);
                } else {
                    console.log(`[UPDATE SCHOOL] Creating New Class: ${cls.name}`);
                    const newClassRes = await client.query(
                        `INSERT INTO classes (school_id, name) VALUES ($1, $2) RETURNING id`,
                        [id, cls.name]
                    );
                    classId = newClassRes.rows[0].id;
                    console.log(`[UPDATE SCHOOL] New Class ID: ${classId}`);
                    existingClasses.push({ id: classId, name: cls.name });
                }

                processedClassIds.push(classId);

                // 2. Sync Sections
                const targetSections = cls.sections || [];
                const currentSectionsRes = await client.query('SELECT id, name FROM sections WHERE class_id = $1', [classId]);
                const currentSections = currentSectionsRes.rows;

                // Handle section deletions if allowDeletions is true
                if (allowDeletions) {
                    const sectionsToDelete = currentSections.filter(curr => !targetSections.includes(curr.name));

                    for (const section of sectionsToDelete) {
                        console.log(`[UPDATE SCHOOL] Removing Section: ${section.name} from Class ID: ${classId}`);

                        // Move students in this section to bin with 'Unassigned' status
                        const affectedStudents = await client.query(
                            `UPDATE students 
                             SET status = 'Unassigned', 
                                 class_name = 'Unassigned - Previously: ' || COALESCE(class_name, 'Unknown Class') || ' ' || COALESCE(section_name, 'Unknown Section'),
                                 section_name = 'N/A'
                             WHERE school_id = $1 AND class_id = $2 AND section_id = $3 AND status != 'Deleted'
                             RETURNING id, name`,
                            [id, classId, section.id]
                        );

                        if (affectedStudents.rows.length > 0) {
                            console.log(`[UPDATE SCHOOL] Moved ${affectedStudents.rows.length} students to Unassigned bin`);
                        }

                        // Clean up section dependencies
                        await client.query('DELETE FROM student_promotions WHERE from_section_id = $1 OR to_section_id = $1', [section.id]);
                        await client.query('DELETE FROM announcements WHERE section_id = $1', [section.id]);

                        // Delete the section
                        await client.query('DELETE FROM sections WHERE id = $1', [section.id]);
                    }
                }

                // Add new sections
                const sectionsToAdd = targetSections.filter(name => !currentSections.some(curr => curr.name === name));
                for (const secName of sectionsToAdd) {
                    console.log(`[UPDATE SCHOOL] Adding Section: ${secName}`);
                    const newSec = await client.query(
                        'INSERT INTO sections (class_id, name) VALUES ($1, $2) RETURNING id',
                        [classId, secName]
                    );
                    processedSectionIds.push(newSec.rows[0].id);
                }

                // Track existing sections
                currentSections.forEach(sec => {
                    if (targetSections.includes(sec.name)) {
                        processedSectionIds.push(sec.id);
                    }
                });

                // 3. Sync Subjects
                const targetSubjects = cls.subjects || [];
                const currentSubjectsRes = await client.query('SELECT id, name FROM subjects WHERE class_id = $1', [classId]);
                const currentSubjects = currentSubjectsRes.rows;

                // Handle subject deletions if allowDeletions is true (case-insensitive comparison)
                if (allowDeletions) {
                    const targetSubjectsLower = targetSubjects.map(n => n.toLowerCase());
                    const subjectsToDelete = currentSubjects.filter(curr => !targetSubjectsLower.includes(curr.name.toLowerCase()));

                    if (subjectsToDelete.length > 0) {
                        const subjectIds = subjectsToDelete.map(s => s.id);
                        console.log(`[UPDATE SCHOOL] Deleting Subjects: ${subjectsToDelete.map(s => s.name).join(', ')}`);
                        await client.query('DELETE FROM subjects WHERE id = ANY($1::int[])', [subjectIds]);
                    }
                }

                // Add new subjects (case-insensitive check to avoid duplicates)
                const currentSubjectNamesLower = currentSubjects.map(s => s.name.toLowerCase());
                const subjectsToAdd = targetSubjects.filter(name => !currentSubjectNamesLower.includes(name.toLowerCase()));
                for (const subName of subjectsToAdd) {
                    console.log(`[UPDATE SCHOOL] Adding Subject: ${subName}`);
                    await client.query('INSERT INTO subjects (class_id, name) VALUES ($1, $2)', [classId, subName]);
                }
            }

            // Handle class deletions if allowDeletions is true
            if (allowDeletions) {
                const classesToDelete = existingClasses.filter(ec => !processedClassIds.includes(ec.id));

                for (const classToDelete of classesToDelete) {
                    console.log(`[UPDATE SCHOOL] Removing Class: ${classToDelete.name}`);

                    // Move all students in this class to bin with 'Unassigned' status
                    const affectedStudents = await client.query(
                        `UPDATE students 
                         SET status = 'Unassigned', 
                             class_name = 'Unassigned - Previously: ' || COALESCE(class_name, 'Unknown Class') || ' ' || COALESCE(section_name, 'Unknown Section'),
                             section_name = 'N/A'
                         WHERE school_id = $1 AND class_id = $2 AND status != 'Deleted'
                         RETURNING id, name`,
                        [id, classToDelete.id]
                    );

                    if (affectedStudents.rows.length > 0) {
                        console.log(`[UPDATE SCHOOL] Moved ${affectedStudents.rows.length} students to Unassigned bin from class ${classToDelete.name}`);
                    }

                    // Clean up class dependencies that block deletion
                    await client.query('DELETE FROM student_promotions WHERE from_class_id = $1 OR to_class_id = $1', [classToDelete.id]);
                    await client.query('DELETE FROM announcements WHERE class_id = $1', [classToDelete.id]);
                    await client.query('DELETE FROM timetables WHERE class_id = $1', [classToDelete.id]);
                    await client.query('DELETE FROM exam_schedules WHERE class_id = $1', [classToDelete.id]);
                    await client.query('DELETE FROM marks WHERE subject_id IN (SELECT id FROM subjects WHERE class_id = $1)', [classToDelete.id]);
                    await client.query('DELETE FROM student_fees WHERE fee_structure_id IN (SELECT id FROM fee_structures WHERE class_id = $1)', [classToDelete.id]);
                    await client.query('DELETE FROM fee_payments WHERE fee_structure_id IN (SELECT id FROM fee_structures WHERE class_id = $1)', [classToDelete.id]);
                    await client.query('DELETE FROM fee_structures WHERE class_id = $1', [classToDelete.id]);

                    // Delete sections and subjects first (foreign key constraints)
                    await client.query('DELETE FROM sections WHERE class_id = $1', [classToDelete.id]);
                    await client.query('DELETE FROM subjects WHERE class_id = $1', [classToDelete.id]);

                    // Delete the class
                    await client.query('DELETE FROM classes WHERE id = $1', [classToDelete.id]);
                }
            }
        }

        await client.query('COMMIT');
        console.log('[UPDATE SCHOOL] Committed successfully');

        // Fetch the updated school with details to return
        const updatedSchool = result.rows[0];
        res.json({ message: 'School updated successfully', school: updatedSchool });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[UPDATE SCHOOL] ERROR:', error);
        res.status(500).json({ message: 'Error updating school', error: error.message, stack: error.stack });
    } finally {
        client.release();
    }
};

// Toggle School Service Status (Active/Inactive)
const toggleSchoolStatus = async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body; // Boolean

    try {
        const result = await pool.query(
            'UPDATE schools SET is_active = $1 WHERE id = $2 RETURNING id, name, is_active',
            [is_active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'School not found' });
        }

        const status = result.rows[0].is_active ? 'Active' : 'Inactive';
        res.json({ message: `School service is now ${status}`, school: result.rows[0] });

    } catch (error) {
        console.error('Toggle Status Error:', error);
        res.status(500).json({ message: 'Failed to update status' });
    }
};

// Soft Delete School (Move to Bin)
const deleteSchool = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            "UPDATE schools SET status = 'Deleted' WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'School not found' });
        }

        res.json({ message: 'School moved to bin successfully' });
    } catch (error) {
        console.error('Delete School Error:', error);
        res.status(500).json({ message: 'Failed to delete school', error: error.message });
    }
};

// Restore School from Bin
const restoreSchool = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            "UPDATE schools SET status = 'Active' WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'School not found' });
        }

        res.json({ message: 'School restored successfully' });
    } catch (error) {
        console.error('Restore School Error:', error);
        res.status(500).json({ message: 'Failed to restore school', error: error.message });
    }
};



// Permanent Delete School (with all associated data)
const permanentDeleteSchool = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        console.log(`[PERMANENT DELETE SCHOOL] Starting deletion for school ID: ${id}`);

        // First, get the school name for logging
        const schoolCheck = await client.query('SELECT name FROM schools WHERE id = $1', [id]);
        if (schoolCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'School not found' });
        }
        const schoolName = schoolCheck.rows[0].name;
        console.log(`[PERMANENT DELETE SCHOOL] Deleting school: ${schoolName}`);

        // Try to delete the school - if there are FK constraints without CASCADE, this will fail with a specific error
        try {
            const result = await client.query('DELETE FROM schools WHERE id = $1 RETURNING *', [id]);

            await client.query('COMMIT');
                } catch (deleteError) {
            // If direct delete fails due to FK constraints, do manual cascade
            console.log('[PERMANENT DELETE SCHOOL] Direct delete failed, performing manual cascade...');
            console.log('[PERMANENT DELETE SCHOOL] Error was:', deleteError.message);

            // Rollback the failed delete
            await client.query('ROLLBACK');
            await client.query('BEGIN');

            // Define a safe query execution helper using Postgres SAVEPOINTs.
            // If a query fails inside a transaction block, Postgres aborts the entire transaction.
            // Wrapping it in a SAVEPOINT allows us to safely catch errors of non-existent tables/columns
            // and rollback ONLY that failed query, keeping the main transaction fully alive!
            const safeQuery = async (queryText, params) => {
                try {
                    await client.query('SAVEPOINT sp_safe');
                    const res = await client.query(queryText, params);
                    await client.query('RELEASE SAVEPOINT sp_safe');
                    return res;
                } catch (err) {
                    console.log(`[PERMANENT DELETE SCHOOL] Safe query ignored failure on: "${queryText.substring(0, 100)}..." -> ${err.message}`);
                    await client.query('ROLLBACK TO SAVEPOINT sp_safe');
                    return null;
                }
            };

            // Manual cascade deletion
            console.log('[PERMANENT DELETE SCHOOL] Step 1: Deleting all related data...');

            // 0. Explicit cleanup of library tables with school_id
            await safeQuery('DELETE FROM library_transactions WHERE school_id = $1', [id]);
            await safeQuery('DELETE FROM library_books WHERE school_id = $1', [id]);

            // 1. Student Related Data
            // We delete only tables where student_id column actually exists, using safeQuery.
            // (mark_components has no student_id column and is cascade-deleted from marks).
            // (leave_requests has no student_id column and is deleted by school_id below).
            const studentTables = [
                'marks', 'attendance', 'student_attendance',
                'fee_payments', 'student_fees', 'hostel_payments', 'hostel_mess_bills',
                'hostel_allocations', 'student_promotions', 'student_certificates',
                'doubts'
            ];
            for (const t of studentTables) {
                await safeQuery(`DELETE FROM ${t} WHERE student_id IN (SELECT id FROM students WHERE school_id = $1)`, [id]);
            }

            // 2. Students
            await safeQuery('DELETE FROM students WHERE school_id = $1', [id]);

            // 3. Class/Academic Structure (Must be before Teachers due to FKs)
            await safeQuery('DELETE FROM timetables WHERE school_id = $1', [id]);
            await safeQuery('DELETE FROM exam_schedules WHERE school_id = $1', [id]);

            // Explicitly delete student_fees linked to these fee_structures to prevent FK errors
            await safeQuery('DELETE FROM student_fees WHERE fee_structure_id IN (SELECT id FROM fee_structures WHERE school_id = $1)', [id]);
            await safeQuery('DELETE FROM fee_structures WHERE school_id = $1', [id]);
            await safeQuery('DELETE FROM subjects WHERE class_id IN (SELECT id FROM classes WHERE school_id = $1)', [id]);
            await safeQuery('DELETE FROM sections WHERE class_id IN (SELECT id FROM classes WHERE school_id = $1)', [id]);
            await safeQuery('DELETE FROM classes WHERE school_id = $1', [id]);

            // 4. Transport & Hostels
            await safeQuery('DELETE FROM transport_stops WHERE route_id IN (SELECT id FROM transport_routes WHERE school_id = $1)', [id]);
            await safeQuery('DELETE FROM transport_routes WHERE school_id = $1', [id]);
            await safeQuery('DELETE FROM transport_vehicles WHERE school_id = $1', [id]);

            await safeQuery('DELETE FROM hostel_rooms WHERE hostel_id IN (SELECT id FROM hostels WHERE school_id = $1)', [id]);
            await safeQuery('DELETE FROM hostels WHERE school_id = $1', [id]);

            // 5. Teachers & Staff
            await safeQuery('DELETE FROM teacher_attendance WHERE teacher_id IN (SELECT id FROM teachers WHERE school_id = $1)', [id]);
            await safeQuery('DELETE FROM teachers WHERE school_id = $1', [id]);

            await safeQuery('DELETE FROM staff_attendance WHERE staff_id IN (SELECT id FROM staff WHERE school_id = $1)', [id]);
            await safeQuery('DELETE FROM staff WHERE school_id = $1', [id]);

            // 6. School Misc & Shared dependencies
            // leave_requests and salary_payments are cleaned up cleanly by school_id
            await safeQuery('DELETE FROM leave_requests WHERE school_id = $1', [id]);
            await safeQuery('DELETE FROM salary_payments WHERE school_id = $1', [id]);

            // notifications does not have school_id, it is linked via user_id
            await safeQuery('DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE school_id = $1)', [id]);

            const miscTables = [
                'events', 'school_holidays', 'announcements',
                'expenditures', 'admissions_enquiries', 'exam_types', 'grades'
            ];
            for (const t of miscTables) {
                await safeQuery(`DELETE FROM ${t} WHERE school_id = $1`, [id]);
            }

            // 7. Users
            await safeQuery('DELETE FROM users WHERE school_id = $1', [id]);

            // 8. Schools
            const finalResult = await client.query('DELETE FROM schools WHERE id = $1 RETURNING *', [id]);

            await client.query('COMMIT');
            console.log(`[PERMANENT DELETE SCHOOL] ✅ Successfully deleted school via manual cascade: ${schoolName}`);

            res.json({
                message: 'School and all associated data permanently deleted',
                deletedSchool: schoolName
            });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[PERMANENT DELETE SCHOOL] ❌ FATAL ERROR:', error);
        console.error('[PERMANENT DELETE SCHOOL] Error message:', error.message);
        console.error('[PERMANENT DELETE SCHOOL] Error detail:', error.detail);
        console.error('[PERMANENT DELETE SCHOOL] Error hint:', error.hint);
        console.error('[PERMANENT DELETE SCHOOL] Stack trace:', error.stack);

        res.status(500).json({
            message: 'Failed to permanently delete school',
            error: error.message,
            detail: error.detail || 'No additional details',
            hint: error.hint || 'Check server logs for more information',
            constraint: error.constraint || 'Unknown constraint'
        });
    } finally {
        client.release();
    }
};

const updateSchoolFeatures = async (req, res) => {
    const { id } = req.params;
    const updates = req.body; // e.g., { has_hostel: true, has_neet_exams: false }
    
    // Allowed feature flags to prevent arbitrary column updates
    const allowedFeatures = ['has_hostel', 'has_neet_exams', 'has_face_enrollment', 'has_face_scanner', 'has_biometric', 'has_subject_combinations'];
    
    try {
        const fields = Object.keys(updates).filter(key => allowedFeatures.includes(key));
        
        if (fields.length === 0) {
            return res.status(400).json({ message: 'No valid features provided' });
        }

        const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
        const values = fields.map(field => updates[field]);
        values.push(id);

        await pool.query(`UPDATE schools SET ${setClause} WHERE id = $${values.length}`, values);
        
        res.json({ message: 'Features updated successfully', updatedFields: fields });
    } catch (err) {
        console.error('Update features error:', err);
        res.status(500).json({ message: 'Failed to update features' });
    }
};

const updateSchoolLogo = async (req, res) => {
    const schoolId = req.user.schoolId;

    if (!schoolId) {
        return res.status(403).json({ message: 'Access denied' });
    }

    // Safety check for missing body (e.g. old frontend sending multipart)
    if (!req.body || Object.keys(req.body).length === 0) {
        console.error('[UPDATE LOGO] req.body is missing/empty. Content-Type:', req.headers['content-type']);
        return res.status(400).json({
            message: 'Browser cache issue detected. Please HARD REFRESH your page (Ctrl+Shift+R) and try again.',
            details: 'Server received empty body. Expected JSON.',
            debug: {
                contentType: req.headers['content-type'],
                contentLength: req.headers['content-length']
            }
        });
    }

    const { logo } = req.body;

    try {
        console.log(`[UPDATE LOGO] School ID: ${schoolId}`);
        console.log(`[UPDATE LOGO] Payload Type: ${typeof logo}`);
        console.log(`[UPDATE LOGO] Payload Length: ${logo ? logo.length : 'N/A'}`);

        await pool.query('UPDATE schools SET logo = $1 WHERE id = $2', [logo, schoolId]);
        res.json({ message: 'School logo updated successfully', logo });
    } catch (error) {
        console.error('[UPDATE LOGO] Error updating school logo:', error);
        res.status(500).json({ message: 'Error updating logo', error: error.message });
    }
};

const getDashboardStats = async (req, res) => {
    const school_id = req.user.schoolId;
    try {
        // 1. Get Core Counts
        const countsRes = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM students WHERE school_id = $1 AND (status IS NULL OR status NOT IN ('Deleted', 'Unassigned'))) as total_students,
                (SELECT COUNT(*) FROM students WHERE school_id = $1 AND (status IS NULL OR status NOT IN ('Deleted', 'Unassigned')) AND gender = 'Male') as male_students,
                (SELECT COUNT(*) FROM students WHERE school_id = $1 AND (status IS NULL OR status NOT IN ('Deleted', 'Unassigned')) AND gender = 'Female') as female_students,
                (SELECT COUNT(*) FROM teachers WHERE school_id = $1) as total_teachers,
                (SELECT COUNT(*) FROM staff WHERE school_id = $1) as total_staff
        `, [school_id]);

        // 2. Get Class Distribution
        const distRes = await pool.query(`
            SELECT c.name, COUNT(s.id) as count
            FROM classes c
            LEFT JOIN students s ON c.id = s.class_id AND (s.status IS NULL OR s.status NOT IN ('Deleted', 'Unassigned'))
            WHERE c.school_id = $1
            GROUP BY c.id, c.name
            ORDER BY c.name ASC
        `, [school_id]);

        res.json({
            ...countsRes.rows[0],
            classDistribution: distRes.rows
        });
    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ message: 'Error loading stats' });
    }
};

const updateMySchoolSettings = async (req, res) => {
    const schoolId = req.user.schoolId;
    if (!schoolId) return res.status(403).json({ message: 'Access denied' });

    const { geminiApiKey, smsProvider, smsApiKey, smsSenderId, latitude, longitude, attendanceRadius, attendance_radius } = req.body;
    const finalRadius = attendanceRadius !== undefined ? attendanceRadius : attendance_radius;

    try {
        await pool.query(
            `UPDATE schools SET 
                gemini_api_key = COALESCE($1, gemini_api_key),
                sms_provider = COALESCE($3, sms_provider),
                sms_api_key = COALESCE($4, sms_api_key),
                sms_sender_id = COALESCE($5, sms_sender_id),
                latitude = COALESCE($6, latitude),
                longitude = COALESCE($7, longitude),
                attendance_radius = COALESCE($8, attendance_radius)
             WHERE id = $2`,
            [
                geminiApiKey,
                schoolId,
                smsProvider,
                smsApiKey,
                smsSenderId,
                latitude === undefined ? null : (latitude === '' ? null : latitude),
                longitude === undefined ? null : (longitude === '' ? null : longitude),
                finalRadius === undefined ? null : (finalRadius === '' ? null : finalRadius)
            ]
        );
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('[UPDATE MY SCHOOL] Error:', error);
        res.status(500).json({ message: 'Error updating settings' });
    }
};

// =====================================
// Word Template Handlers
// =====================================

const uploadWordTemplate = async (req, res) => {
    const schoolId = req.user.schoolId;
    if (!schoolId) return res.status(403).json({ message: 'Access denied' });

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Template name is required' });
    }

    try {
        // Enforce max 3 templates per school
        const countRes = await pool.query('SELECT COUNT(*) FROM marksheet_custom_templates WHERE school_id = $1', [schoolId]);
        if (parseInt(countRes.rows[0].count) >= 3) {
            return res.status(400).json({ message: 'Maximum 3 custom templates allowed per school. Please delete one first.' });
        }

        // Check if it should be default (if it's the first one, make it default automatically)
        const isDefault = parseInt(countRes.rows[0].count) === 0;

        // Save binary file to base64
        const base64Data = req.file.buffer.toString('base64');
        const fileDataString = `data:${req.file.mimetype};base64,${base64Data}`;

        const insertRes = await pool.query(
            `INSERT INTO marksheet_custom_templates (school_id, name, file_path, is_default)
             VALUES ($1, $2, $3, $4) RETURNING id, name, is_default, created_at`,
            [schoolId, name, fileDataString, isDefault]
        );

        res.json({ message: 'Template uploaded successfully', template: insertRes.rows[0] });
    } catch (error) {
        console.error('[WORD TEMPLATE UPLOAD ERROR]:', error);
        res.status(500).json({ message: 'Failed to upload template' });
    }
};

const getWordTemplates = async (req, res) => {
    const schoolId = req.user.schoolId;
    try {
        const result = await pool.query(
            `SELECT id, name, is_default, created_at FROM marksheet_custom_templates WHERE school_id = $1 ORDER BY created_at ASC`,
            [schoolId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('[GET WORD TEMPLATES ERROR]:', error);
        res.status(500).json({ message: 'Failed to fetch templates' });
    }
};

const setDefaultWordTemplate = async (req, res) => {
    const schoolId = req.user.schoolId;
    const { id: templateId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Remove default from all
        await client.query('UPDATE marksheet_custom_templates SET is_default = false WHERE school_id = $1', [schoolId]);

        // Set new default
        const result = await client.query('UPDATE marksheet_custom_templates SET is_default = true WHERE school_id = $1 AND id = $2 RETURNING id', [schoolId, templateId]);

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Template not found' });
        }

        await client.query('COMMIT');
        res.json({ message: 'Default template updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[SET DEFAULT TEMPLATE ERROR]:', error);
        res.status(500).json({ message: 'Failed to set default template' });
    } finally {
        client.release();
    }
};

const deleteWordTemplate = async (req, res) => {
    const schoolId = req.user.schoolId;
    const { id: templateId } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const checkRes = await client.query('SELECT is_default FROM marksheet_custom_templates WHERE id = $1 AND school_id = $2', [templateId, schoolId]);

        if (checkRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Template not found' });
        }

        const wasDefault = checkRes.rows[0].is_default;

        await client.query('DELETE FROM marksheet_custom_templates WHERE id = $1', [templateId]);

        // If the deleted template was the default, assign a new default if possible
        if (wasDefault) {
            const nextTemp = await client.query('SELECT id FROM marksheet_custom_templates WHERE school_id = $1 LIMIT 1', [schoolId]);
            if (nextTemp.rows.length > 0) {
                await client.query('UPDATE marksheet_custom_templates SET is_default = true WHERE id = $1', [nextTemp.rows[0].id]);
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[DELETE TEMPLATE ERROR]:', error);
        res.status(500).json({ message: 'Failed to delete template' });
    } finally {
        client.release();
    }
};

const updateWordTemplate = async (req, res) => {
    const schoolId = req.user.schoolId;
    const { id: templateId } = req.params;
    const { name } = req.body;

    try {
        let updateQuery = 'UPDATE marksheet_custom_templates SET ';
        const params = [];
        const updates = [];

        if (name) {
            params.push(name);
            updates.push(`name = $${params.length}`);
        }

        if (req.file) {
            const base64Data = req.file.buffer.toString('base64');
            const fileDataString = `data:${req.file.mimetype};base64,${base64Data}`;
            params.push(fileDataString);
            updates.push(`file_path = $${params.length}`);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No changes provided' });
        }

        params.push(templateId, schoolId);
        updateQuery += updates.join(', ') + ` WHERE id = $${params.length - 1} AND school_id = $${params.length} RETURNING id, name`;

        const result = await pool.query(updateQuery, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Template not found' });
        }

        res.json({ message: 'Template updated successfully', template: result.rows[0] });
    } catch (error) {
        console.error('[UPDATE TEMPLATE ERROR]:', error);
        res.status(500).json({ message: 'Failed to update template' });
    }
};

module.exports = {
    createSchool, getSchools, getSchoolDetails, updateSchool, getMySchool,
    toggleSchoolStatus, deleteSchool, restoreSchool, getDeletedSchools,
    permanentDeleteSchool, updateSchoolFeatures, updateSchoolLogo, getDashboardStats,
    updateMySchoolSettings, uploadWordTemplate, getWordTemplates, setDefaultWordTemplate, deleteWordTemplate, updateWordTemplate
};
