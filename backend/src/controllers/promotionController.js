const { pool } = require('../config/db');

// Promote Students to Next Class
exports.promoteStudents = async (req, res) => {
    const client = await pool.connect();

    try {
        const { student_ids, to_class_id, to_section_id, to_academic_year, notes } = req.body;
        const school_id = req.user.schoolId;
        const promoted_by = req.user.id;

        if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
            return res.status(400).json({ message: 'Please select at least one student' });
        }

        if ((!to_class_id && to_class_id !== 'vacant') || !to_academic_year) {
            return res.status(400).json({ message: 'Target class and academic year are required' });
        }

        const isVacantPromotion = to_class_id === 'vacant';
        const targetClassId = isVacantPromotion ? null : to_class_id;
        const targetSectionId = isVacantPromotion ? null : to_section_id;

        await client.query('BEGIN');

        const promotedStudents = [];
        const errors = [];

        for (const student_id of student_ids) {
            try {
                // Get current student details
                const studentRes = await client.query(
                    'SELECT * FROM students WHERE id = $1 AND school_id = $2',
                    [student_id, school_id]
                );

                if (studentRes.rows.length === 0) {
                    errors.push({ student_id, error: 'Student not found' });
                    continue;
                }

                const student = studentRes.rows[0];

                // Record promotion history
                await client.query(`
                    INSERT INTO student_promotions 
                    (student_id, school_id, from_class_id, from_section_id, to_class_id, to_section_id, 
                     from_academic_year, to_academic_year, promoted_by, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    student_id,
                    school_id,
                    student.class_id,
                    student.section_id,
                    targetClassId,
                    targetSectionId,
                    student.academic_year || '2025-2026',
                    to_academic_year,
                    promoted_by,
                    notes
                ]);

                // Update student's class, section, academic year, and set status to Active
                await client.query(`
                    UPDATE students 
                    SET class_id = $1, section_id = $2, academic_year = $3, status = 'Active'
                    WHERE id = $4 AND school_id = $5
                `, [targetClassId, targetSectionId, to_academic_year, student_id, school_id]);

                // If Class is CHANGING (not just section), clear individual fee assignments
                // Use strict comparison, but handle nulls for targetClassId (vacant)
                if (student.class_id != targetClassId) {
                    await client.query(`
                        DELETE FROM student_fees 
                        WHERE student_id = $1 AND school_id = $2
                    `, [student_id, school_id]);
                }

                promotedStudents.push({
                    student_id,
                    name: student.name,
                    from_class: student.class_id,
                    to_class: targetClassId
                });

            } catch (error) {
                console.error(`Error promoting student ${student_id}:`, error);
                errors.push({ student_id, error: error.message });
            }
        }

        await client.query('COMMIT');

        res.json({
            message: `Successfully promoted ${promotedStudents.length} student(s)`,
            promoted: promotedStudents,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Promotion error:', error);
        res.status(500).json({ message: 'Failed to promote students', error: error.message });
    } finally {
        client.release();
    }
};

// Get Promotion History for a Student
exports.getPromotionHistory = async (req, res) => {
    try {
        const { student_id } = req.params;
        const school_id = req.user.schoolId;

        const result = await pool.query(`
            SELECT 
                sp.*,
                fc.name as from_class_name,
                fs.name as from_section_name,
                tc.name as to_class_name,
                ts.name as to_section_name,
                u.name as promoted_by_name
            FROM student_promotions sp
            LEFT JOIN classes fc ON sp.from_class_id = fc.id
            LEFT JOIN sections fs ON sp.from_section_id = fs.id
            LEFT JOIN classes tc ON sp.to_class_id = tc.id
            LEFT JOIN sections ts ON sp.to_section_id = ts.id
            LEFT JOIN users u ON sp.promoted_by = u.id
            WHERE sp.student_id = $1 AND sp.school_id = $2
            ORDER BY sp.promoted_at DESC
        `, [student_id, school_id]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching promotion history:', error);
        res.status(500).json({ message: 'Failed to fetch promotion history' });
    }
};

// Get Current Academic Year (helper function)
exports.getCurrentAcademicYear = (req, res) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Academic year typically starts in April (month 4) or June (month 6)
    // Adjust based on your school's calendar
    let academicYear;
    if (currentMonth >= 4) {
        academicYear = `${currentYear}-${currentYear + 1}`;
    } else {
        academicYear = `${currentYear - 1}-${currentYear}`;
    }

    res.json({ academic_year: academicYear });
};
