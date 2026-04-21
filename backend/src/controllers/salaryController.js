const { pool } = require('../config/db');

// Get Salary Overview for Teachers and Staff
exports.getSalaryOverview = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({ message: 'Month and Year are required' });
        }

        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        // Get Teachers with attendance and salary
        const teachersQuery = `
            WITH month_holidays AS (
                SELECT holiday_date
                FROM school_holidays
                WHERE school_id = $1 
                  AND holiday_date >= $2 
                  AND holiday_date <= $3
                  AND holiday_date <= CURRENT_DATE  -- Only count holidays up to today
                  AND EXTRACT(DOW FROM holiday_date) != 0  -- Exclude Sundays
            )
            SELECT 
                t.id,
                t.name,
                t.employee_id,
                t.salary_per_day,
                t.subject_specialization as role,
                'Teacher' as type,
                COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as days_present,
                COUNT(CASE WHEN a.status = 'Absent' THEN 1 END) as days_absent,
                COUNT(CASE WHEN a.status = 'Leave' THEN 1 END) as days_leave,
                COUNT(CASE WHEN a.status = 'Holiday' AND a.date IN (SELECT holiday_date FROM month_holidays) THEN 1 END) as days_holiday,
                COUNT(a.date) as total_marked_days,
                (
                    COUNT(CASE WHEN a.status = 'Present' THEN 1 END) + 
                    COUNT(CASE WHEN a.status = 'Holiday' AND a.date IN (SELECT holiday_date FROM month_holidays) THEN 1 END)
                ) * t.salary_per_day as calculated_salary,
                CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_paid,
                sp.payment_date,
                sp.payment_mode
            FROM teachers t
            LEFT JOIN teacher_attendance a ON t.id = a.teacher_id 
                AND a.date >= $2 AND a.date <= $3
            LEFT JOIN salary_payments sp ON t.id = sp.employee_id 
                AND sp.employee_type = 'Teacher' 
                AND sp.school_id = $1 
                AND sp.month = $4 
                AND sp.year = $5
            WHERE t.school_id = $1
            GROUP BY t.id, t.name, t.employee_id, t.salary_per_day, t.subject_specialization, sp.id, sp.payment_date, sp.payment_mode
        `;

        // Get Staff with attendance and salary
        const staffQuery = `
            WITH month_holidays AS (
                SELECT holiday_date
                FROM school_holidays
                WHERE school_id = $1 
                  AND holiday_date >= $2 
                  AND holiday_date <= $3
                  AND holiday_date <= CURRENT_DATE  -- Only count holidays up to today
                  AND EXTRACT(DOW FROM holiday_date) != 0  -- Exclude Sundays
            )
            SELECT 
                s.id,
                s.name,
                s.employee_id,
                s.salary_per_day,
                s.role,
                'Staff' as type,
                COUNT(CASE WHEN a.status = 'Present' THEN 1 END) as days_present,
                COUNT(CASE WHEN a.status = 'Absent' THEN 1 END) as days_absent,
                COUNT(CASE WHEN a.status = 'Leave' THEN 1 END) as days_leave,
                COUNT(CASE WHEN a.status = 'Holiday' AND a.date IN (SELECT holiday_date FROM month_holidays) THEN 1 END) as days_holiday,
                COUNT(a.date) as total_marked_days,
                (
                    COUNT(CASE WHEN a.status = 'Present' THEN 1 END) + 
                    COUNT(CASE WHEN a.status = 'Holiday' AND a.date IN (SELECT holiday_date FROM month_holidays) THEN 1 END)
                ) * s.salary_per_day as calculated_salary,
                CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_paid,
                sp.payment_date,
                sp.payment_mode
            FROM staff s
            LEFT JOIN staff_attendance a ON s.id = a.staff_id 
                AND a.date >= $2 AND a.date <= $3
            LEFT JOIN salary_payments sp ON s.id = sp.employee_id 
                AND sp.employee_type = 'Staff' 
                AND sp.school_id = $1 
                AND sp.month = $4 
                AND sp.year = $5
            WHERE s.school_id = $1
            GROUP BY s.id, s.name, s.employee_id, s.salary_per_day, s.role, sp.id, sp.payment_date, sp.payment_mode
        `;

        const [teachers, staff] = await Promise.all([
            pool.query(teachersQuery, [school_id, startDate, endDate, parseInt(month), parseInt(year)]),
            pool.query(staffQuery, [school_id, startDate, endDate, parseInt(month), parseInt(year)])
        ]);

        const combined = [...teachers.rows, ...staff.rows];

        res.json(combined);
    } catch (error) {
        console.error('Error fetching salary overview:', error);
        res.status(500).json({ message: 'Server error fetching salary overview' });
    }
};

// Mark Salary as Paid
exports.markSalaryPaid = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { employee_id, employee_type, month, year, amount, payment_mode, notes } = req.body;

        if (!employee_id || !employee_type || !month || !year || !amount) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        await client.query('BEGIN');

        // Check if salary_payments table exists, if not create it
        await client.query(`
            CREATE TABLE IF NOT EXISTS salary_payments (
                id SERIAL PRIMARY KEY,
                school_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                employee_type VARCHAR(20) NOT NULL,
                month INTEGER NOT NULL,
                year INTEGER NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                payment_mode VARCHAR(50),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_salary_payment UNIQUE (school_id, employee_id, employee_type, month, year)
            );
        `);

        // Insert or update payment record
        const result = await client.query(
            `INSERT INTO salary_payments 
                (school_id, employee_id, employee_type, month, year, amount, payment_mode, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (school_id, employee_id, employee_type, month, year) 
             DO UPDATE SET 
                amount = EXCLUDED.amount,
                payment_date = CURRENT_TIMESTAMP,
                payment_mode = EXCLUDED.payment_mode,
                notes = EXCLUDED.notes
             RETURNING *`,
            [school_id, employee_id, employee_type, month, year, amount, payment_mode, notes]
        );

        const { sendPushNotification } = require('../services/notificationService');

        // ... existing code ...

        await client.query('COMMIT');

        // Notification
        const empNameRes = employee_type === 'Teacher'
            ? await pool.query('SELECT name FROM teachers WHERE id = $1', [employee_id])
            : await pool.query('SELECT name FROM staff WHERE id = $1', [employee_id]);

        if (empNameRes.rows.length > 0) {
            const title = 'Salary Credited';
            const body = `Dear ${empNameRes.rows[0].name}, your salary of ₹${amount} for ${month}/${year} has been credited.`;
            // Fixed: Pass employee_id and the correct roleHint so notificationService can resolve the user
            await sendPushNotification(employee_id, title, body, employee_type);
        }

        res.json({ message: 'Salary marked as paid', payment: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error marking salary as paid:', error);
        res.status(500).json({ message: 'Server error marking salary as paid' });
    } finally {
        client.release();
    }
};

// Get Payment History
exports.getPaymentHistory = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { employee_id, employee_type } = req.query;

        let query = `
            SELECT sp.*, 
                   CASE 
                       WHEN sp.employee_type = 'Teacher' THEN t.name
                       WHEN sp.employee_type = 'Staff' THEN s.name
                   END as employee_name,
                   CASE 
                       WHEN sp.employee_type = 'Teacher' THEN t.employee_id
                       WHEN sp.employee_type = 'Staff' THEN s.employee_id
                   END as emp_id
            FROM salary_payments sp
            LEFT JOIN teachers t ON sp.employee_id = t.id AND sp.employee_type = 'Teacher'
            LEFT JOIN staff s ON sp.employee_id = s.id AND sp.employee_type = 'Staff'
            WHERE sp.school_id = $1
        `;

        const params = [school_id];

        if (employee_id && employee_type) {
            query += ` AND sp.employee_id = $2 AND sp.employee_type = $3`;
            params.push(employee_id, employee_type);
        }

        query += ` ORDER BY sp.year DESC, sp.month DESC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({ message: 'Server error fetching payment history' });
    }
};

// Get My Salary Details (Logged-in User)
exports.getMySalaryDetails = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const email = req.user.email;
        const { year } = req.query; // Optional filter by year

        const STAFF_ROLES = ['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN', 'TRANSPORT_MANAGER'];

        let employee_id, employee_type, profile_data;

        if (req.user.role === 'TEACHER') {
            // Use linkedId from JWT first (fastest path)
            if (req.user.linkedId) {
                const tRes = await pool.query(
                    'SELECT id, employee_id, salary_per_day, join_date FROM teachers WHERE id = $1 AND school_id = $2',
                    [req.user.linkedId, school_id]
                );
                if (tRes.rows.length > 0) {
                    employee_id = tRes.rows[0].id;
                    profile_data = tRes.rows[0];
                    employee_type = 'Teacher';
                }
            }

            // Fallback to email lookup
            if (!employee_id) {
                let tRes = await pool.query(
                    'SELECT id, employee_id, salary_per_day, join_date FROM teachers WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND school_id = $2',
                    [email, school_id]
                );
                if (tRes.rows.length === 0 && email.includes('@')) {
                    const potentialEmpId = email.split('@')[0].toUpperCase();
                    tRes = await pool.query(
                        'SELECT id, employee_id, salary_per_day, join_date FROM teachers WHERE employee_id ILIKE $1 AND school_id = $2',
                        [potentialEmpId, school_id]
                    );
                }
                if (tRes.rows.length === 0) return res.status(404).json({ message: 'Teacher profile not found' });
                employee_id = tRes.rows[0].id;
                profile_data = tRes.rows[0];
                employee_type = 'Teacher';
            }

        } else if (STAFF_ROLES.includes(req.user.role)) {
            // Use linkedId from JWT first
            if (req.user.linkedId) {
                const sRes = await pool.query(
                    'SELECT id, employee_id, salary_per_day, join_date FROM staff WHERE id = $1 AND school_id = $2',
                    [req.user.linkedId, school_id]
                );
                if (sRes.rows.length > 0) {
                    employee_id = sRes.rows[0].id;
                    profile_data = sRes.rows[0];
                    employee_type = 'Staff';
                }
            }

            // Fallback to email lookup
            if (!employee_id) {
                let sRes = await pool.query(
                    'SELECT id, employee_id, salary_per_day, join_date FROM staff WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND school_id = $2',
                    [email, school_id]
                );
                if (sRes.rows.length === 0 && email.includes('@')) {
                    const potentialEmpId = email.split('@')[0].toUpperCase();
                    sRes = await pool.query(
                        'SELECT id, employee_id, salary_per_day, join_date FROM staff WHERE employee_id ILIKE $1 AND school_id = $2',
                        [potentialEmpId, school_id]
                    );
                }
                if (sRes.rows.length === 0) return res.status(404).json({ message: 'Staff profile not found' });
                employee_id = sRes.rows[0].id;
                profile_data = sRes.rows[0];
                employee_type = 'Staff';
            }
        } else {
            return res.status(403).json({ message: 'Salary details only available for Teachers and Staff' });
        }

        const queryStr = `
            SELECT sp.* 
            FROM salary_payments sp
            WHERE sp.school_id = $1 
              AND sp.employee_id = $2 
              AND sp.employee_type = $3
              ${year ? 'AND sp.year = $4' : ''}
            ORDER BY sp.year DESC, sp.month DESC
        `;

        const params = [school_id, employee_id, employee_type];
        if (year) params.push(year);

        const payments = await pool.query(queryStr, params);

        res.json({
            profile: {
                employee_id: profile_data.employee_id,
                employee_type
            },
            salary_history: payments.rows
        });

    } catch (error) {
        console.error('Error fetching my salary:', error);
        res.status(500).json({ message: 'Server error fetching salary details' });
    }
};
