const { pool } = require('../config/db');

// Teacher/Staff: Create an out pass (checkout)
exports.createOutPass = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const user_id = req.user.id;
        const role = req.user.role; // TEACHER or STAFF
        const { reason } = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json({ message: 'Reason is required' });
        }

        const personType = role === 'TEACHER' ? 'TEACHER' : 'STAFF';

        // Get person name from the teachers or staff table
        let personName = null;
        if (role === 'TEACHER') {
            const t = await pool.query(
                'SELECT name FROM teachers WHERE school_id = $1 AND user_id = $2',
                [school_id, user_id]
            );
            if (t.rows.length === 0) {
                // Try by email
                const u = await pool.query('SELECT email FROM users WHERE id = $1', [user_id]);
                const t2 = await pool.query(
                    'SELECT name FROM teachers WHERE school_id = $1 AND LOWER(email) = LOWER($2)',
                    [school_id, u.rows[0]?.email]
                );
                personName = t2.rows[0]?.name || null;
            } else {
                personName = t.rows[0].name;
            }
        } else {
            const s = await pool.query(
                'SELECT name FROM staff WHERE school_id = $1 AND user_id = $2',
                [school_id, user_id]
            );
            if (s.rows.length === 0) {
                const u = await pool.query('SELECT email FROM users WHERE id = $1', [user_id]);
                const s2 = await pool.query(
                    'SELECT name FROM staff WHERE school_id = $1 AND LOWER(email) = LOWER($2)',
                    [school_id, u.rows[0]?.email]
                );
                personName = s2.rows[0]?.name || null;
            } else {
                personName = s.rows[0].name;
            }
        }

        // Check if already OUT (prevent duplicate active passes)
        const existing = await pool.query(
            `SELECT id FROM out_passes WHERE school_id = $1 AND user_id = $2 AND status = 'OUT'`,
            [school_id, user_id]
        );
        if (existing.rows.length > 0) {
            return res.status(400).json({ message: 'You already have an active out pass. Please check in first.' });
        }

        const result = await pool.query(
            `INSERT INTO out_passes (school_id, user_id, person_type, person_name, reason, checkout_time, status)
             VALUES ($1, $2, $3, $4, $5, NOW(), 'OUT') RETURNING *`,
            [school_id, user_id, personType, personName, reason.trim()]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('createOutPass Error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// Teacher/Staff: Mark return (check in)
exports.checkIn = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const user_id = req.user.id;
        const { id } = req.params;

        const result = await pool.query(
            `UPDATE out_passes 
             SET checkin_time = NOW(), status = 'RETURNED'
             WHERE id = $1 AND school_id = $2 AND user_id = $3 AND status = 'OUT'
             RETURNING *`,
            [id, school_id, user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Active out pass not found or already returned.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('checkIn Error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// Teacher/Staff: Get own out pass history
exports.getMyOutPasses = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const user_id = req.user.id;

        const result = await pool.query(
            `SELECT * FROM out_passes 
             WHERE school_id = $1 AND user_id = $2
             ORDER BY checkout_time DESC
             LIMIT 30`,
            [school_id, user_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('getMyOutPasses Error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

// Admin: Get all out passes (filterable by type and date)
exports.getAllOutPasses = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { type, date } = req.query;

        // Default to today
        const filterDate = date || new Date().toISOString().split('T')[0];

        let query = `
            SELECT * FROM out_passes
            WHERE school_id = $1
            AND DATE(checkout_time AT TIME ZONE 'Asia/Kolkata') = $2
        `;
        const params = [school_id, filterDate];

        if (type === 'TEACHER' || type === 'STAFF') {
            params.push(type);
            query += ` AND person_type = $${params.length}`;
        }

        query += ` ORDER BY checkout_time DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('getAllOutPasses Error:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};
