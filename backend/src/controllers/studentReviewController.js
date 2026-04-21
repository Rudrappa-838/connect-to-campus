const { pool } = require('../config/db');
const { createNotification } = require('./notificationController');

// Add a Review for a Student
exports.addReview = async (req, res) => {
    const client = await pool.connect();
    try {
        const { student_id, message, review_type } = req.body;
        const school_id = req.user.schoolId;
        const sender_id = req.user.id;
        const sender_role = req.user.role;

        console.log('[REVIEW] Adding review:', { student_id, school_id, sender_id, sender_role });

        // Resolve sender's real display name from DB
        let sender_name = req.user.email || 'Staff';
        if (sender_role === 'SCHOOL_ADMIN') {
            const schoolRes = await pool.query('SELECT name FROM schools WHERE id = $1', [school_id]);
            sender_name = schoolRes.rows.length > 0
                ? `${schoolRes.rows[0].name} (Admin)`
                : (req.user.email || 'Admin');
        } else if (sender_role === 'TEACHER' && req.user.linkedId) {
            const tRes = await pool.query(
                `SELECT name FROM teachers WHERE id = $1`,
                [req.user.linkedId]
            );
            if (tRes.rows.length > 0) {
                const t = tRes.rows[0];
                sender_name = t.name || req.user.email;
            }
        }

        await client.query('BEGIN');

        // 1. Insert Review
        const result = await client.query(
            `INSERT INTO student_reviews 
             (school_id, student_id, sender_id, sender_role, sender_name, message, review_type) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [school_id, student_id, sender_id, sender_role, sender_name, message, review_type || 'GENERAL']
        );

        await client.query('COMMIT');

        // 2. Notify student — safe wrapper, never blocks review save
        try {
            const stInfo = await pool.query(
                `SELECT admission_no, email FROM students WHERE id = $1`,
                [student_id]
            );
            if (stInfo.rows.length > 0) {
                const st = stInfo.rows[0];
                const syntheticEmail = `${(st.admission_no || '').toLowerCase()}@student.school.com`;
                const userRes = await pool.query(
                    `SELECT id FROM users WHERE role = 'STUDENT' AND (LOWER(email) = LOWER($1) OR LOWER(email) = $2) LIMIT 1`,
                    [st.email || '', syntheticEmail]
                );
                if (userRes.rows.length > 0) {
                    await createNotification(
                        userRes.rows[0].id,
                        'New Review Received',
                        `You have a new ${review_type || 'General'} review from ${sender_name}.`,
                        'REVIEW',
                        { review_id: result.rows[0].id }
                    );
                } else {
                    console.warn(`[REVIEW] No user found for student ${student_id}. Notification skipped.`);
                }
            }
        } catch (notifErr) {
            console.warn('[REVIEW] Notification error (non-critical):', notifErr.message);
        }

        res.status(201).json(result.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding student review:', error);
        res.status(500).json({ message: 'Error adding student review', error: error.message });
    } finally {
        client.release();
    }
};

// Get Reviews for a specific student (Teacher/Admin view)
exports.getStudentReviews = async (req, res) => {
    try {
        const { student_id } = req.params;
        const school_id = req.user.schoolId;

        const result = await pool.query(
            `SELECT * FROM student_reviews 
             WHERE student_id = $1 AND school_id = $2 
             AND created_at > NOW() - INTERVAL '30 days'
             ORDER BY created_at DESC`,
            [student_id, school_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching student reviews:', error);
        res.status(500).json({ message: 'Server error fetching reviews' });
    }
};

// Get Personal Reviews (Student view)
exports.getMyReviews = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const student_id = req.user.studentId || req.user.linked_id || req.user.linkedId;

        if (!student_id) {
            return res.status(403).json({ message: 'Student account is not linked to a student record' });
        }

        const result = await pool.query(
            `SELECT * FROM student_reviews 
             WHERE student_id = $1 AND school_id = $2 
             AND created_at > NOW() - INTERVAL '30 days'
             ORDER BY created_at DESC`,
            [student_id, school_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching my reviews:', error);
        res.status(500).json({ message: 'Server error fetching reviews' });
    }
};

// Delete a Review (Sender or Admin only)
exports.deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const school_id = req.user.schoolId;

        const review = await pool.query(
            'SELECT sender_id FROM student_reviews WHERE id = $1 AND school_id = $2',
            [id, school_id]
        );

        if (review.rows.length === 0) {
            return res.status(404).json({ message: 'Review not found' });
        }

        if (review.rows[0].sender_id !== req.user.id && req.user.role !== 'SCHOOL_ADMIN') {
            return res.status(403).json({ message: "Access denied: Cannot delete other's reviews" });
        }

        await pool.query('DELETE FROM student_reviews WHERE id = $1', [id]);
        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
