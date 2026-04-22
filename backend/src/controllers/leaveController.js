const { pool } = require('../config/db');

const getLeaves = async (req, res) => {
    const { schoolId } = req.user;
    const { status, role } = req.query;

    try {
        // Auto-cleanup: Delete leaves older than 1 month (based on end_date)
        await pool.query("DELETE FROM leaves WHERE end_date < CURRENT_DATE - INTERVAL '1 month'");

        let query = `
            SELECT l.*, 
                   CASE 
                       WHEN l.role = 'Student' THEN s.name 
                       WHEN l.role = 'Teacher' THEN t.name 
                       WHEN l.role = 'Staff' THEN st.name 
                   END as applicant_name,
                   CASE
                        WHEN l.role = 'Student' THEN s.admission_no
                        WHEN l.role = 'Teacher' THEN t.email
                        WHEN l.role = 'Staff' THEN st.email
                   END as applicant_id_code
            FROM leaves l
            LEFT JOIN students s ON l.user_id = s.id AND l.role = 'Student'
            LEFT JOIN teachers t ON l.user_id = t.id AND l.role = 'Teacher'
            LEFT JOIN staff st ON l.user_id = st.id AND l.role = 'Staff'
            WHERE l.school_id = $1
        `;

        const params = [schoolId];
        let paramIndex = 2;

        if (status && status !== 'All') {
            query += ` AND l.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (role && role !== 'All') {
            query += ` AND l.role = $${paramIndex}`;
            params.push(role);
            paramIndex++;
        }

        query += ` ORDER BY l.created_at DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching leaves:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const createLeave = async (req, res) => {
    const { schoolId } = req.user;
    const { user_id, role, leave_type, start_date, end_date, reason } = req.body;

    // For manual entry by admin, we trust the IDs provided. 
    // Ideally, validation should check if ID exists.

    try {
        const result = await pool.query(
            `INSERT INTO leaves (school_id, user_id, role, leave_type, start_date, end_date, reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [schoolId, user_id, role, leave_type, start_date, end_date, reason]
        );
        const leave = result.rows[0];

        // Added: Notify School Admin(s)
        try {
            const { sendPushNotification } = require('../services/notificationService');
            // Find admins for this school
            const adminRes = await pool.query('SELECT id FROM users WHERE school_id = $1 AND role = \'SCHOOL_ADMIN\'', [schoolId]);
            if (adminRes.rows.length > 0) {
                const adminBody = `New Leave application from ${role}: ${reason.substring(0, 30)}${reason.length > 30 ? '...' : ''}`;
                for (const admin of adminRes.rows) {
                    await sendPushNotification(admin.id, 'New Leave Application', adminBody, 'Admin');
                }
            }
        } catch (notifErr) {
            console.error('Failed to notify admin of leave application:', notifErr.message);
        }

        res.json(leave);
    } catch (error) {
        console.error('Error creating leave:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const updateLeaveStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const { schoolId } = req.user;
    try {
        const result = await pool.query(
            `UPDATE leaves SET status = $1 WHERE id = $2 AND school_id = $3 RETURNING *`,
            [status, id, schoolId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Leave not found' });
        }

        const leave = result.rows[0];

        // Trigger Notification
        try {
            const { sendPushNotification } = require('../services/notificationService');
            // We use the raw table ID (student.id, teacher.id) as the push target, consistent with other controllers
            // Or we could use the User Table ID if that's how tokens are stored. 
            // Given previous implementations used raw IDs (e.g. FeeController used student_id), we follow that.

            await sendPushNotification(leave.user_id, 'Leave Status Update', `Your leave application from ${new Date(leave.start_date).toLocaleDateString()} has been ${status}.`, leave.role);

        } catch (notifErr) {
            console.error('Failed to trigger notification:', notifErr);
        }

        res.json(leave);
    } catch (error) {
        console.error('Error updating leave:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteLeave = async (req, res) => {
    const { id } = req.params;
    const { schoolId } = req.user;
    try {
        const result = await pool.query('DELETE FROM leaves WHERE id = $1 AND school_id = $2 RETURNING *', [id, schoolId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Leave not found or access denied' });
        }
        res.json({ message: 'Leave record deleted' });
    } catch (error) {
        console.error('Error deleting leave:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


// Get leaves for logged-in user
const getMyLeaves = async (req, res) => {
    // const { schoolId } = req; // Remove this as we get it from req.user
    const { email, role, schoolId, linkedId } = req.user; 

    try {
        let user_id = linkedId;
        let roleString; 

        if (role === 'TEACHER') {
            roleString = 'Teacher';
            if (!user_id) {
                let tRes = await pool.query('SELECT id FROM teachers WHERE email = $1 AND school_id = $2', [email, schoolId]);
                if (tRes.rows.length === 0) {
                    const parts = email.split('@');
                    tRes = await pool.query('SELECT id FROM teachers WHERE employee_id ILIKE $1 AND school_id = $2', [parts[0], schoolId]);
                }
                if (tRes.rows.length > 0) user_id = tRes.rows[0].id;
            }
            if (!user_id) return res.status(404).json({ message: 'Teacher Profile not found' });
        } else if (role === 'STUDENT') {
            roleString = 'Student';
            if (!user_id) {
                let sRes = await pool.query('SELECT id FROM students WHERE LOWER(email) = LOWER($1) AND school_id = $2', [email, schoolId]);
                if (sRes.rows.length === 0) {
                    const emailParts = email.split('@');
                    if (emailParts.length === 2) {
                        sRes = await pool.query('SELECT id FROM students WHERE LOWER(admission_no) = LOWER($1) AND school_id = $2', [emailParts[0], schoolId]);
                    }
                }
                if (sRes.rows.length > 0) user_id = sRes.rows[0].id;
            }
            if (!user_id) return res.status(404).json({ message: 'Student Profile not found' });
        } else if (['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'].includes(role)) {
            roleString = 'Staff';
            if (!user_id) {
                let stRes = await pool.query('SELECT id FROM staff WHERE email = $1 AND school_id = $2', [email, schoolId]);
                if (stRes.rows.length === 0) {
                    const parts = email.split('@');
                    stRes = await pool.query('SELECT id FROM staff WHERE employee_id ILIKE $1 AND school_id = $2', [parts[0], schoolId]);
                }
                if (stRes.rows.length > 0) user_id = stRes.rows[0].id;
            }
            if (!user_id) return res.status(404).json({ message: 'Staff Profile not found' });
        } else {
            return res.status(400).json({ message: 'Invalid role for leave application' });
        }

        const result = await pool.query(
            `SELECT * FROM leaves WHERE school_id = $1 AND user_id = $2 AND role = $3 ORDER BY created_at DESC`,
            [schoolId, user_id, roleString]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching my leaves:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Apply for leave (Logged-in user)
const applyLeave = async (req, res) => {
    // const { schoolId } = req;
    const { email, role, schoolId, linkedId } = req.user;
    const { leave_type, start_date, end_date, reason } = req.body;

    try {
        let user_id = linkedId;
        let roleString;

        if (role === 'TEACHER') {
            roleString = 'Teacher';
            if (!user_id) {
                let tRes = await pool.query('SELECT id FROM teachers WHERE email = $1 AND school_id = $2', [email, schoolId]);
                if (tRes.rows.length === 0) {
                    const parts = email.split('@');
                    tRes = await pool.query('SELECT id FROM teachers WHERE employee_id ILIKE $1 AND school_id = $2', [parts[0], schoolId]);
                }
                if (tRes.rows.length > 0) user_id = tRes.rows[0].id;
            }
            if (!user_id) return res.status(404).json({ message: 'Teacher Profile not found' });
        } else if (role === 'STUDENT') {
            roleString = 'Student';
            if (!user_id) {
                let sRes = await pool.query('SELECT id FROM students WHERE LOWER(email) = LOWER($1) AND school_id = $2', [email, schoolId]);
                if (sRes.rows.length === 0) {
                    const emailParts = email.split('@');
                    if (emailParts.length === 2) {
                        sRes = await pool.query('SELECT id FROM students WHERE LOWER(admission_no) = LOWER($1) AND school_id = $2', [emailParts[0], schoolId]);
                    }
                }
                if (sRes.rows.length > 0) user_id = sRes.rows[0].id;
            }
            if (!user_id) return res.status(404).json({ message: 'Student Profile not found' });
        } else if (['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'].includes(role)) {
            roleString = 'Staff';
            if (!user_id) {
                let stRes = await pool.query('SELECT id FROM staff WHERE email = $1 AND school_id = $2', [email, schoolId]);
                if (stRes.rows.length === 0) {
                    const parts = email.split('@');
                    stRes = await pool.query('SELECT id FROM staff WHERE employee_id ILIKE $1 AND school_id = $2', [parts[0], schoolId]);
                }
                if (stRes.rows.length > 0) user_id = stRes.rows[0].id;
            }
            if (!user_id) return res.status(404).json({ message: 'Staff Profile not found' });
        } else {
            return res.status(400).json({ message: 'Invalid role type' });
        }

        const result = await pool.query(
            `INSERT INTO leaves (school_id, user_id, role, leave_type, start_date, end_date, reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [schoolId, user_id, roleString, leave_type, start_date, end_date, reason]
        );
        const leave = result.rows[0];

        // Added: Notify School Admin(s)
        try {
            const { sendPushNotification } = require('../services/notificationService');
            // Find admins for this school
            const adminRes = await pool.query('SELECT id FROM users WHERE school_id = $1 AND role = \'SCHOOL_ADMIN\'', [schoolId]);
            if (adminRes.rows.length > 0) {
                const adminBody = `New Leave application from ${roleString}: ${reason.substring(0, 30)}${reason.length > 30 ? '...' : ''}`;
                for (const admin of adminRes.rows) {
                    await sendPushNotification(admin.id, 'New Leave Application', adminBody, 'Admin');
                }
            }
        } catch (notifErr) {
            console.error('Failed to notify admin of leave application:', notifErr.message);
        }

        res.json(leave);

    } catch (error) {
        console.error('Error applying leave:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { getLeaves, createLeave, updateLeaveStatus, deleteLeave, getMyLeaves, applyLeave };
