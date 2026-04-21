const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const { sendPushNotification } = require('../services/notificationService');

// Add Staff
exports.addStaff = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { name, email, phone, role, gender, address, join_date, salary_per_day, library_access, hostel_access, can_enroll_face, can_take_face_attendance } = req.body;

        await client.query('BEGIN');

        // 1. Check if phone number already exists
        if (phone) {
            const phoneCheck = await client.query(
                'SELECT id, name FROM staff WHERE phone = $1 AND school_id = $2',
                [phone, school_id]
            );
            if (phoneCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Phone number already exists for staff: ${phoneCheck.rows[0].name}`
                });
            }
        }

        // 1.1 Check if email already exists
        if (email) {
            const emailCheck = await client.query(
                'SELECT id, name FROM staff WHERE email = $1 AND school_id = $2',
                [email, school_id]
            );
            if (emailCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Email already exists for staff: ${emailCheck.rows[0].name}`
                });
            }
        }

        // 2. Generate Employee ID - NEW FORMAT: [School First 2 Letters] + [Role 1 Letter] + [4 Digits]
        // Example: Driver at DAS School -> DAD1234
        const schoolRes = await client.query('SELECT name FROM schools WHERE id = $1', [school_id]);
        const schoolName = schoolRes.rows[0]?.name || 'XX';
        let schoolPrefix = schoolName.replace(/[^a-zA-Z]/g, '').substring(0, 2).toUpperCase();
        if (schoolPrefix.length < 2) schoolPrefix = (schoolPrefix + 'X').substring(0, 2);

        const roleLetter = (role || 'S').substring(0, 1).toUpperCase(); // D for Driver

        let employee_id;
        const providedId = req.body.employee_id;

        if (providedId) {
            employee_id = providedId.toUpperCase();
        } else {
            let isUnique = false;
            while (!isUnique) {
                const rand4 = Math.floor(1000 + Math.random() * 9000); // 1000 to 9999
                employee_id = `${schoolPrefix}${roleLetter}${rand4}`; // XX + D + 1234 = 7 chars
                const check = await client.query('SELECT 1 FROM staff WHERE employee_id = $1 AND school_id = $2', [employee_id, school_id]);
                if (check.rows.length === 0) isUnique = true;
            }
        }

        const result = await client.query(
            `INSERT INTO staff (school_id, name, email, phone, role, gender, address, join_date, employee_id, salary_per_day, library_access, hostel_access, can_enroll_face, can_take_face_attendance)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
            [school_id, name, email, phone, role, gender, address, join_date || new Date(), employee_id, salary_per_day || 0, library_access || false, hostel_access || false, can_enroll_face || false, can_take_face_attendance || false]
        );

        // Create User Login - Always Use Employee ID for Login
        let loginEmail = employee_id.trim().toLowerCase();
        const defaultPassword = await bcrypt.hash('123456', 10);

        // Convert 'DRIVER' to 'STAFF' role for user table simplification, or keep DRIVER? 
        // Logic in authController says: "Allow DRIVER to login as STAFF". 
        // But if I create user as STAFF, it's safer. However, preserving specific role is better.
        // Let's use the provided role if it matches enum, or default to STAFF. 
        // Actually, users table 'role' column likely supports 'STAFF', 'DRIVER'.
        const userRole = ['DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'].includes(role.toUpperCase()) ? role.toUpperCase() : 'STAFF';

        let userCheck = await client.query('SELECT id FROM users WHERE email = $1 AND role = $2', [loginEmail, userRole]);
        if (userCheck.rows.length > 0) {
            loginEmail = `${employee_id}@staff.school.com`;
            userCheck = await client.query('SELECT id FROM users WHERE email = $1 AND role = $2', [loginEmail, userRole]);
        }

        if (userCheck.rows.length === 0) {
            await client.query(
                `INSERT INTO users (email, password, role, school_id, must_change_password, linked_id) VALUES ($1, $2, $3, $4, TRUE, $5)`,
                [loginEmail, defaultPassword, userRole, school_id, result.rows[0].id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Server error adding staff' });
    } finally {
        client.release();
    }
};

// Get Staff
exports.getStaff = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { search } = req.query;
        let query = `SELECT *, 
                           COALESCE(can_enroll_face, TRUE) as can_enroll_face,
                           COALESCE(can_take_face_attendance, TRUE) as can_take_face_attendance 
                    FROM staff WHERE school_id = $1`;
        const params = [school_id];

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (name ILIKE $2 OR employee_id ILIKE $2 OR phone ILIKE $2)`;
        }

        query += ` ORDER BY name ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching staff' });
    }
};

// Update Staff
exports.updateStaff = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const { name, email, phone, role, gender, address, join_date, salary_per_day, employee_id, library_access, hostel_access, can_enroll_face, can_take_face_attendance } = req.body;

        await client.query('BEGIN');

        // Check if phone number already exists for another staff member
        if (phone) {
            const phoneCheck = await client.query(
                'SELECT id, name FROM staff WHERE phone = $1 AND school_id = $2 AND id != $3',
                [phone, school_id, id]
            );
            if (phoneCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Phone number already exists for staff: ${phoneCheck.rows[0].name}`
                });
            }
        }

        // Check if email already exists for another staff member
        if (email) {
            const emailCheck = await client.query(
                'SELECT id, name FROM staff WHERE email = $1 AND school_id = $2 AND id != $3',
                [email, school_id, id]
            );
            if (emailCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Email already exists for staff: ${emailCheck.rows[0].name}`
                });
            }
        }
        // Check if employee_id already exists for another staff member
        if (employee_id) {
            const idCheck = await client.query(
                'SELECT id, name FROM staff WHERE employee_id = $1 AND school_id = $2 AND id != $3',
                [employee_id, school_id, id]
            );
            if (idCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Employee ID already exists for staff: ${idCheck.rows[0].name}`
                });
            }
        }

        // Get Existing Staff to check for email change
        const existingStaff = await client.query('SELECT email, employee_id FROM staff WHERE id = $1', [id]);

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
            `UPDATE public.staff SET name = $1, email = $2, phone = $3, role = $4, gender = $5, address = $6, join_date = $7, salary_per_day = $8,
             first_name = $9, last_name = $10, employee_id = COALESCE($13, employee_id), library_access = $14, hostel_access = $15,
             can_enroll_face = COALESCE($16, can_enroll_face),
             can_take_face_attendance = COALESCE($17, can_take_face_attendance)
             WHERE id = $11 AND school_id = $12 RETURNING *`,
            [name, email, phone, role, gender, address, safe_join_date, safe_salary,
                first_name, last_name,
                id, school_id, employee_id, library_access || false, hostel_access || false, can_enroll_face, can_take_face_attendance]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Staff member not found' });
        }

        await client.query('COMMIT');

        const updatedStaff = result.rows[0];

        // SYNC USER TABLE: If email changed, update the Login User record
        if (existingStaff.rows.length > 0 && email && existingStaff.rows[0].email !== email) {
            try {
                await client.query(
                    `UPDATE users SET email = $1 WHERE email = $2 AND role IN ('STAFF', 'DRIVER', 'ACCOUNTANT')`,
                    [email, existingStaff.rows[0].email]
                );
                console.log(`[Sync] Updated User Login Email for Staff ${updatedStaff.employee_id}`);
            } catch (uErr) {
                console.error('Failed to sync user email:', uErr.message);
            }
        }

        // Trigger Notification
        sendPushNotification(updatedStaff.id, "Profile Updated", "Your staff profile has been updated by the administration.", "Staff")
            .catch(err => console.error('Notification failed:', err));

        res.json(updatedStaff);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Server error updating staff' });
    } finally {
        client.release();
    }
};

// Delete Staff - Robust
exports.deleteStaff = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;

        await client.query('BEGIN');

        // 0. Get Staff Info
        const staffRes = await client.query('SELECT email, employee_id, role FROM staff WHERE id = $1', [id]);
        if (staffRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Staff member not found' });
        }
        const staff = staffRes.rows[0];

        // 1. Delete Attendance Records
        await client.query('DELETE FROM staff_attendance WHERE staff_id = $1', [id]);

        // 1.5 Delete Salary Records (Force Clean)
        await client.query("DELETE FROM salary_payments WHERE employee_id = $1 AND employee_type = 'Staff'", [id]);

        // 1.6 Unassign from Transport Vehicles (If Driver)
        await client.query('UPDATE transport_vehicles SET driver_id = NULL WHERE driver_id = $1', [id]);

        // 2. Start Deletion
        const result = await client.query(
            `DELETE FROM staff WHERE id = $1 AND school_id = $2 RETURNING *`,
            [id, school_id]
        );

        // 3. Delete User Login Account
        if (staff.email) {
            // Delete user where email matches AND role is one of the staff roles
            await client.query("DELETE FROM users WHERE email = $1 AND role IN ('STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN')", [staff.email]);
        }
        if (staff.employee_id) {
            const genEmail = `${staff.employee_id}@staff.school.com`;
            await client.query("DELETE FROM users WHERE email = $1 AND role IN ('STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN')", [genEmail]);
        }

        await client.query('COMMIT');
        res.json({ message: 'Staff member deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Data Integrity Error deleting staff:', error.message);
        if (error.code === '23503') { // Foreign Key Violation
            return res.status(400).json({ message: 'Cannot delete staff. They are referenced in other records (e.g. Salary, Transport). Please clear those first.' });
        }
        res.status(500).json({ message: 'Server error deleting staff: ' + error.message });
    } finally {
        client.release();
    }
};

// Mark Attendance
exports.markAttendance = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { date, attendanceData } = req.body; // [{ staff_id, status }]

        await client.query('BEGIN');

        for (const record of attendanceData) {
            await client.query(
                `INSERT INTO staff_attendance(school_id, staff_id, date, status)
                VALUES($1, $2, $3, $4)
                ON CONFLICT(staff_id, date) 
                DO UPDATE SET status = EXCLUDED.status`,
                [school_id, record.staff_id, date, record.status]
            );

            // Trigger Notification (Async)
            if (['Absent', 'Present', 'Late'].includes(record.status)) {
                sendPushNotification(record.staff_id, 'Attendance Updated', `Your attendance for ${new Date(date).toLocaleDateString()} has been marked as ${record.status}.`, 'Staff')
                    .catch(err => console.error('Staff Attendance Notification Error:', err));
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

// Get Daily Attendance
exports.getDailyAttendance = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { date } = req.query;

        if (!date) return res.status(400).json({ message: 'Date is required' });

        const query = `
            SELECT t.id, t.name, t.phone, t.role, COALESCE(a.status, 'Unmarked') as status
            FROM staff t
            LEFT JOIN staff_attendance a ON t.id = a.staff_id AND a.date = $2
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
                t.id as staff_id, 
                t.name, 
                TO_CHAR(d.date, 'YYYY-MM-DD') as date,
                COALESCE(a.status, CASE WHEN mh.holiday_date IS NOT NULL THEN 'Holiday' ELSE 'Unmarked' END) as status
            FROM staff t
            CROSS JOIN generate_series($2::date, $3::date, '1 day'::interval) d(date)
            LEFT JOIN staff_attendance a ON t.id = a.staff_id AND a.date = d.date::date
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

// Get My Attendance (Logged in Staff)
exports.getMyAttendance = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const user_email = req.user.email;
        const { month, year } = req.query;

        let staff_id = req.user.linkedId;

        // Fallback if missing
        if (!staff_id) {
            let staffRes = await pool.query('SELECT id FROM staff WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND school_id = $2', [user_email, school_id]);
            if (staffRes.rows.length === 0) {
                const potentialEmpId = user_email.includes('@') ? user_email.split('@')[0].toUpperCase() : user_email.toUpperCase();
                staffRes = await pool.query('SELECT id FROM staff WHERE employee_id ILIKE $1 AND school_id = $2', [potentialEmpId, school_id]);
            }
            if (staffRes.rows.length === 0) return res.json([]);
            staff_id = staffRes.rows[0].id;
        }

        // 2. Fetch Attendance
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const query = `
            WITH month_holidays AS (
                SELECT holiday_date, holiday_name
                FROM school_holidays
                WHERE school_id = (SELECT school_id FROM staff WHERE id = $1) 
                AND holiday_date >= $2 AND holiday_date <= $3
            )
            SELECT 
                TO_CHAR(d.date, 'YYYY-MM-DD') as date,
                COALESCE(a.status, CASE WHEN mh.holiday_date IS NOT NULL THEN 'Holiday' ELSE 'Unmarked' END) as status
            FROM generate_series($2::date, $3::date, '1 day'::interval) d(date)
            LEFT JOIN staff_attendance a ON a.staff_id = $1 AND a.date = d.date::date
            LEFT JOIN month_holidays mh ON mh.holiday_date = d.date::date
            ORDER BY d.date DESC
        `;
        const result = await pool.query(query, [staff_id, startDate, endDate]);

        res.json(result.rows);

    } catch (error) {
        console.error('Error fetching my attendance:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get My Profile (Logged in Staff)
exports.getProfile = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const user_email = req.user.email;
        let staff_id = req.user.linkedId;

        if (!staff_id) {
            // Try email match first
            let staffRes = await pool.query('SELECT id FROM staff WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND school_id = $2', [user_email, school_id]);
            if (staffRes.rows.length === 0) {
                // Fallback: treat login email as employee_id (handles both DAD1234 and DAD1234@staff.school.com)
                const potentialEmpId = user_email.includes('@') ? user_email.split('@')[0].toUpperCase() : user_email.toUpperCase();
                staffRes = await pool.query('SELECT id FROM staff WHERE employee_id ILIKE $1 AND school_id = $2', [potentialEmpId, school_id]);
            }
            if (staffRes.rows.length > 0) staff_id = staffRes.rows[0].id;
        }

        if (!staff_id) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        const query = `
            SELECT t.*, 
                   tr.route_name, tr.vehicle_id, 
                   tv.vehicle_number, tv.driver_name, tv.driver_phone,
                   COALESCE(t.can_enroll_face, TRUE) as can_enroll_face,
                   COALESCE(t.can_take_face_attendance, TRUE) as can_take_face_attendance
            FROM staff t
            LEFT JOIN transport_routes tr ON t.transport_route_id = tr.id
            LEFT JOIN transport_vehicles tv ON tr.vehicle_id = tv.id
            WHERE t.id = $1 AND t.school_id = $2
        `;

        const result = await pool.query(query, [staff_id, school_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get My Salary Slips
exports.getSalarySlips = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const user_email = req.user.email;

        let staff_id = req.user.linkedId;

        if (!staff_id) {
            let staffRes = await pool.query('SELECT id FROM staff WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND school_id = $2', [user_email, school_id]);
            if (staffRes.rows.length === 0) {
                const potentialEmpId = user_email.includes('@') ? user_email.split('@')[0].toUpperCase() : user_email.toUpperCase();
                staffRes = await pool.query('SELECT id FROM staff WHERE employee_id ILIKE $1 AND school_id = $2', [potentialEmpId, school_id]);
            }
            if (staffRes.rows.length === 0) return res.json([]);
            staff_id = staffRes.rows[0].id;
        }

        // 2. Fetch Salary Records using the correct schema (employee_id + employee_type)
        const result = await pool.query(`
            SELECT * FROM salary_payments 
            WHERE employee_id = $1 AND employee_type = 'Staff' AND school_id = $2
            ORDER BY year DESC, month DESC
        `, [staff_id, school_id]);

        res.json(result.rows);

    } catch (error) {
        // If table doesn't exist, return empty array gracefully for now
        if (error.code === '42P01') { // undefined_table
            console.warn("Salary table missing");
            return res.json([]);
        }
        console.error('Error fetching salary slips:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
