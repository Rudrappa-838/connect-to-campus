const { pool } = require('../config/db');

// Get all academic years for a school
exports.getAcademicYears = async (req, res) => {
    try {
        const school_id = req.user.schoolId;

        const result = await pool.query(
            `SELECT * FROM academic_years 
             WHERE school_id = $1 
             ORDER BY start_date DESC`,
            [school_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching academic years:', error);
        res.status(500).json({ message: 'Server error fetching academic years' });
    }
};

// Get current active academic year
exports.getCurrentAcademicYear = async (req, res) => {
    try {
        const school_id = req.user.schoolId;

        const result = await pool.query(
            `SELECT * FROM academic_years 
             WHERE school_id = $1 AND status = 'active' 
             LIMIT 1`,
            [school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No active academic year found' });
        }

        const academicYear = result.rows[0];

        // Calculate statistics
        const today = new Date();
        const startDate = new Date(academicYear.start_date);
        const endDate = new Date(academicYear.end_date);

        const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const daysCompleted = Math.max(0, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)));
        const daysRemaining = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
        const percentageCompleted = Math.min(100, Math.round((daysCompleted / totalDays) * 100));

        res.json({
            ...academicYear,
            stats: {
                totalDays,
                daysCompleted,
                daysRemaining,
                percentageCompleted,
                isNearingEnd: daysRemaining <= 30 && daysRemaining > 0,
                hasEnded: daysRemaining <= 0
            }
        });
    } catch (error) {
        console.error('Error fetching current academic year:', error);
        res.status(500).json({ message: 'Server error fetching current academic year' });
    }
};

// Get specific academic year
exports.getAcademicYear = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;

        const result = await pool.query(
            `SELECT * FROM academic_years 
             WHERE id = $1 AND school_id = $2`,
            [id, school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Academic year not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching academic year:', error);
        res.status(500).json({ message: 'Server error fetching academic year' });
    }
};

// Create new academic year
exports.createAcademicYear = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { year_label, start_date, end_date, status } = req.body;
        console.log('[CREATE ACADEMIC YEAR] Request Body:', JSON.stringify(req.body));

        // Validation
        if (!year_label || !start_date || !end_date) {
            return res.status(400).json({ message: 'Year label, start date, and end date are required' });
        }

        const start = new Date(start_date);
        const end = new Date(end_date);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ message: 'Invalid start or end date format' });
        }

        if (end <= start) {
            return res.status(400).json({ message: 'End date must be after start date' });
        }

        // Check for overlapping years
        const overlapCheck = await pool.query(
            `SELECT * FROM academic_years 
             WHERE school_id = $1 
             AND (
                 (start_date <= $2 AND end_date >= $2) OR
                 (start_date <= $3 AND end_date >= $3) OR
                 (start_date >= $2 AND end_date <= $3)
             )`,
            [school_id, start_date, end_date]
        );

        if (overlapCheck.rows.length > 0) {
            return res.status(400).json({
                message: `Academic year dates overlap with existing year: ${overlapCheck.rows[0].year_label} (${new Date(overlapCheck.rows[0].start_date).toLocaleDateString()} - ${new Date(overlapCheck.rows[0].end_date).toLocaleDateString()})`
            });
        }

        // If setting as active, deactivate other years
        if (status === 'active') {
            await pool.query(
                `UPDATE academic_years 
                 SET status = 'completed' 
                 WHERE school_id = $1 AND status = 'active'`,
                [school_id]
            );
        }

        const result = await pool.query(
            `INSERT INTO academic_years (school_id, year_label, start_date, end_date, status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [school_id, year_label, start_date, end_date, status || 'upcoming']
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating academic year:', error);
        if (error.constraint === 'unique_school_year') {
            return res.status(400).json({ message: 'Academic year with this label already exists' });
        }
        res.status(500).json({ message: 'Server error creating academic year' });
    }
};

// Update academic year
exports.updateAcademicYear = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const { year_label, start_date, end_date, status } = req.body;

        // Check if year exists
        const existingYear = await pool.query(
            `SELECT * FROM academic_years WHERE id = $1 AND school_id = $2`,
            [id, school_id]
        );

        if (existingYear.rows.length === 0) {
            return res.status(404).json({ message: 'Academic year not found' });
        }

        // Helper to check validity if new dates are provided
        if (start_date || end_date) {
            const newStart = start_date ? new Date(start_date) : new Date(existingYear.rows[0].start_date);
            const newEnd = end_date ? new Date(end_date) : new Date(existingYear.rows[0].end_date);

            if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
                return res.status(400).json({ message: 'Invalid start or end date format' });
            }

            if (newEnd <= newStart) {
                return res.status(400).json({ message: 'End date must be after start date' });
            }

            // Check for overlapping years (excluding current)
            const overlapCheck = await pool.query(
                `SELECT * FROM academic_years 
                 WHERE school_id = $1 AND id != $4
                 AND (
                     (start_date <= $2 AND end_date >= $2) OR
                     (start_date <= $3 AND end_date >= $3) OR
                     (start_date >= $2 AND end_date <= $3)
                 )`,
                [school_id, newStart, newEnd, id]
            );

            if (overlapCheck.rows.length > 0) {
                return res.status(400).json({
                    message: `Academic year dates overlap with existing year: ${overlapCheck.rows[0].year_label}`
                });
            }
        }

        // If setting as active, deactivate other years
        if (status === 'active') {
            await pool.query(
                `UPDATE academic_years 
                 SET status = 'completed' 
                 WHERE school_id = $1 AND status = 'active' AND id != $2`,
                [school_id, id]
            );
        }

        const result = await pool.query(
            `UPDATE academic_years 
             SET year_label = COALESCE($1, year_label),
                 start_date = COALESCE($2, start_date),
                 end_date = COALESCE($3, end_date),
                 status = COALESCE($4, status)
             WHERE id = $5 AND school_id = $6
             RETURNING *`,
            [year_label, start_date, end_date, status, id, school_id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating academic year:', error);
        res.status(500).json({ message: 'Server error updating academic year' });
    }
};

// Delete academic year
exports.deleteAcademicYear = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;

        // Check if year has any associated data
        const dataCheck = await pool.query(
            `SELECT 
                (SELECT COUNT(*) FROM marks WHERE academic_year_id = $1) as marks_count,
                (SELECT COUNT(*) FROM attendance WHERE academic_year_id = $1) as attendance_count,
                (SELECT COUNT(*) FROM fee_payments WHERE academic_year_id = $1) as fees_count,
                (SELECT COUNT(*) FROM salary_payments WHERE academic_year_id = $1) as salary_count,
                (SELECT COUNT(*) FROM expenditures WHERE academic_year_id = $1) as expenditure_count
            `,
            [id]
        );

        const counts = dataCheck.rows[0];
        const totalRecords = parseInt(counts.marks_count) + parseInt(counts.attendance_count) +
            parseInt(counts.fees_count) + parseInt(counts.salary_count) +
            parseInt(counts.expenditure_count);

        if (totalRecords > 0) {
            return res.status(400).json({
                message: `Cannot delete academic year. It has ${totalRecords} associated records. Consider marking it as completed instead.`,
                details: counts
            });
        }

        const result = await pool.query(
            `DELETE FROM academic_years 
             WHERE id = $1 AND school_id = $2 
             RETURNING *`,
            [id, school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Academic year not found' });
        }

        res.json({ message: 'Academic year deleted successfully' });
    } catch (error) {
        console.error('Error deleting academic year:', error);
        res.status(500).json({ message: 'Server error deleting academic year' });
    }
};

// Get academic year statistics
exports.getAcademicYearStats = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;

        const stats = await pool.query(
            `SELECT 
                (SELECT COUNT(*) FROM marks WHERE academic_year_id = $1) as total_marks,
                (SELECT COUNT(DISTINCT student_id) FROM marks WHERE academic_year_id = $1) as students_with_marks,
                (SELECT COUNT(*) FROM attendance WHERE academic_year_id = $1) as total_attendance,
                (SELECT COUNT(*) FROM fee_payments WHERE academic_year_id = $1) as total_fee_payments,
                (SELECT COALESCE(SUM(amount), 0) FROM fee_payments WHERE academic_year_id = $1) as total_fees_collected,
                (SELECT COUNT(*) FROM salary_payments WHERE academic_year_id = $1) as total_salary_payments,
                (SELECT COALESCE(SUM(amount), 0) FROM salary_payments WHERE academic_year_id = $1) as total_salaries_paid,
                (SELECT COUNT(*) FROM expenditures WHERE academic_year_id = $1) as total_expenditures,
                (SELECT COALESCE(SUM(amount), 0) FROM expenditures WHERE academic_year_id = $1) as total_expenditure_amount
            `,
            [id]
        );

        res.json(stats.rows[0]);
    } catch (error) {
        console.error('Error fetching academic year stats:', error);
        res.status(500).json({ message: 'Server error fetching statistics' });
    }
};

// Mark academic year as completed
exports.completeAcademicYear = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;

        const result = await pool.query(
            `UPDATE academic_years 
             SET status = 'completed', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND school_id = $2
             RETURNING *`,
            [id, school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Academic year not found' });
        }

        res.json({
            message: 'Academic year marked as completed',
            academicYear: result.rows[0]
        });
    } catch (error) {
        console.error('Error completing academic year:', error);
        res.status(500).json({ message: 'Server error completing academic year' });
    }
};
