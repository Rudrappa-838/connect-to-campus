const jwt = require('jsonwebtoken');

const { pool } = require('../config/db');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) {
            console.error('🔐 Auth Failed:', err.message); // DEBUG LOG
            return res.status(403).json({ message: 'Invalid or expired token' });
        }

        try {
            // Verify if this is the active session token AND if school is active
            const dbRes = await pool.query(`
                SELECT u.current_session_token, u.school_id, s.is_active 
                FROM users u 
                LEFT JOIN schools s ON u.school_id = s.id 
                WHERE u.id = $1
            `, [user.id]);

            if (dbRes.rows.length === 0) {
                return res.status(401).json({ message: 'User not found.' });
            }

            const userData = dbRes.rows[0];

            if (userData.current_session_token !== token) {
                return res.status(401).json({ message: 'Session expired or invalidated.' });
            }

            if (user.role !== 'SUPER_ADMIN' && userData.school_id && userData.is_active === false) {
                return res.status(403).json({ message: 'School Service Disabled. Contact Super Admin.' });
            }

            // Check if student account is deleted
            if (user.role === 'STUDENT') {
                const studentRes = await pool.query(
                    'SELECT status FROM students WHERE school_id = $1 AND LOWER(email) = LOWER($2)',
                    [userData.school_id, user.email]
                );

                if (studentRes.rows.length > 0 && studentRes.rows[0].status === 'Deleted') {
                    return res.status(403).json({
                        message: 'Your account has been deactivated. Please contact the school administration.'
                    });
                }
            }

            // Always update schoolId from DB to ensure we have the latest assignment
            if (userData.school_id) {
                user.schoolId = userData.school_id;
            }

        } catch (dbErr) {
            console.error('Session verification failed:', dbErr);
            return res.status(500).json({ message: 'Session verification failed' });
        }

        req.user = user;
        next();
    });
};

const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Access denied: Super Admin only' });
    }
    next();
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};

module.exports = { authenticateToken, requireSuperAdmin, authorize };
