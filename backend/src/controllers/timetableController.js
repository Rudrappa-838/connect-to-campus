const { pool } = require('../config/db');

// Auto-Generate Timetable
exports.generateTimetable = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { class_id, section_id, subjects: customSubjects, periods: customPeriods } = req.body;

        if (!class_id) {
            return res.status(400).json({ message: 'Class ID is required' });
        }

        await client.query('BEGIN');

        // 1. Get Subjects (Prefer custom config from frontend)
        let subjects = [];
        if (customSubjects && customSubjects.length > 0) {
            subjects = customSubjects.map(s => ({
                id: s.subject_id, // Map frontend subject_id to id
                name: s.subject_name,
                teacher_id: s.teacher_id,
                teacher_name: s.teacher_name
            }));
        } else {
            // Fallback to DB defaults
            const subjectsResult = await client.query(
                `SELECT s.id, s.name, t.id as teacher_id, t.name as teacher_name
                 FROM subjects s
                 LEFT JOIN teachers t ON t.subject_specialization = s.name AND t.school_id = $1
                 WHERE s.class_id = $2
                 ORDER BY s.name`,
                [school_id, class_id]
            );
            subjects = subjectsResult.rows;
        }

        if (subjects.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'No subjects found/selected for this class' });
        }

        // 2. Delete existing timetable
        let deleteQuery = `DELETE FROM timetables WHERE school_id = $1 AND class_id = $2`;
        const deleteParams = [school_id, class_id];

        if (section_id) {
            deleteQuery += ` AND section_id = $3`;
            deleteParams.push(section_id);
        } else {
            deleteQuery += ` AND section_id IS NULL`;
        }

        await client.query(deleteQuery, deleteParams);

        // 3. Define Periods (Prefer custom config)
        let periods = [];
        if (customPeriods && customPeriods.length > 0) {
            periods = customPeriods;
        } else {
            periods = [
                { number: 1, start: '08:00', end: '08:45' },
                { number: 2, start: '08:45', end: '09:30' },
                { number: 3, start: '09:30', end: '10:15' },
                { number: 4, start: '10:30', end: '11:15' },
                { number: 5, start: '11:15', end: '12:00' },
                { number: 6, start: '12:00', end: '12:45' },
                { number: 7, start: '13:30', end: '14:15' }
            ];
        }

        let subjectIndex = 0;
        const timetableEntries = [];

        for (let day = 1; day <= 6; day++) { // Monday to Saturday
            for (const period of periods) {
                const subject = subjects[subjectIndex % subjects.length];

                // Check for teacher conflict
                let teacher_id = subject.teacher_id;
                if (teacher_id) {
                    let conflictQuery = `SELECT id FROM timetables 
                         WHERE teacher_id = $1 AND day_of_week = $2 AND period_number = $3 AND school_id = $4
                         AND NOT (class_id = $5`;

                    const conflictParams = [teacher_id, day, period.number, school_id, class_id];

                    if (section_id) {
                        conflictQuery += ` AND section_id = $6)`;
                        conflictParams.push(section_id);
                    } else {
                        conflictQuery += ` AND section_id IS NULL)`;
                    }

                    const conflictCheck = await client.query(conflictQuery, conflictParams);

                    if (conflictCheck.rows.length > 0) {
                        // Teacher has conflict, assign null (unassigned)
                        teacher_id = null;
                    }
                }

                timetableEntries.push({
                    school_id,
                    class_id,
                    section_id: section_id || null,
                    day_of_week: day,
                    period_number: period.number,
                    subject_id: subject.id,
                    teacher_id,
                    start_time: period.start,
                    end_time: period.end
                });

                subjectIndex++;
            }
        }

        // Insert all entries
        for (const entry of timetableEntries) {
            await client.query(
                `INSERT INTO timetables 
                 (school_id, class_id, section_id, day_of_week, period_number, subject_id, teacher_id, start_time, end_time)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [entry.school_id, entry.class_id, entry.section_id, entry.day_of_week,
                entry.period_number, entry.subject_id, entry.teacher_id, entry.start_time, entry.end_time]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Timetable generated successfully', count: timetableEntries.length });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error generating timetable:', error);
        res.status(500).json({ message: 'Server error generating timetable' });
    } finally {
        client.release();
    }
};

// Get Timetable
exports.getTimetable = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id, section_id } = req.query;

        if (!class_id) {
            return res.status(400).json({ message: 'Class ID is required' });
        }

        let query = `SELECT t.*, 
                    s.name as subject_name,
                    te.name as teacher_name,
                    te.id as teacher_id
             FROM timetables t
             LEFT JOIN subjects s ON t.subject_id = s.id
             LEFT JOIN teachers te ON t.teacher_id = te.id
             WHERE t.school_id = $1 AND t.class_id = $2`;

        const params = [school_id, class_id];

        if (section_id) {
            query += ` AND t.section_id = $3`;
            params.push(section_id);
        } else {
            // If section_id is NOT provided, explicitly allow NULL sections OR all sections? 
            // In strict mode (class w/o sections), we want section_id IS NULL.
            // If the user just didn't select a section (but sections exist), this might return mixed data.
            // Frontend logic: If class has sections, frontend selects one. If no sections, frontend sends null.
            // So we should enforce strict check: if null sent, check IS NULL.
            // HOWEVER, req.query param missing means 'undefined'. 
            // We should assume if it's missing, maybe we want IS NULL?
            // Let's stick to strict check.
            query += ` AND t.section_id IS NULL`;
        }

        query += ` ORDER BY t.day_of_week, t.period_number`;

        const result = await pool.query(query, params);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching timetable:', error);
        res.status(500).json({ message: 'Server error fetching timetable' });
    }
};

// Update Timetable Slot (Manual Edit)
exports.updateTimetableSlot = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const { subject_id, teacher_id, start_time, end_time } = req.body;

        const result = await pool.query(
            `UPDATE timetables 
             SET subject_id = $1, teacher_id = $2, start_time = $3, end_time = $4
             WHERE id = $5 AND school_id = $6
             RETURNING *`,
            [subject_id, teacher_id, start_time, end_time, id, school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Timetable slot not found' });
        }
        res.json({ message: 'Slot updated successfully', slot: result.rows[0] });
    } catch (error) {
        console.error('Error updating timetable slot:', error);
        res.status(500).json({ message: 'Server error updating slot', error: error.message });
    }
};

// Delete Timetable
exports.deleteTimetable = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id, section_id } = req.query;

        let query = `DELETE FROM timetables WHERE school_id = $1 AND class_id = $2`;
        const params = [school_id, class_id];

        if (section_id) {
            query += ` AND section_id = $3`;
            params.push(section_id);
        } else {
            query += ` AND section_id IS NULL`;
        }

        await pool.query(query, params);

        res.json({ message: 'Timetable deleted successfully' });
    } catch (error) {
        console.error('Error deleting timetable:', error);
        res.status(500).json({ message: 'Server error deleting timetable' });
    }
};

// Get Teacher's Personal Timetable
exports.getTeacherTimetable = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { teacher_id } = req.query;

        // If no teacher_id provided, try to infer from user.email if they are logged in as teacher
        let targetTeacherId = teacher_id;
        if (!targetTeacherId && req.user.role === 'TEACHER') {
            const tResult = await pool.query('SELECT id FROM teachers WHERE email = $1', [req.user.email]);
            if (tResult.rows.length > 0) targetTeacherId = tResult.rows[0].id;
        }

        if (!targetTeacherId) {
            return res.status(400).json({ message: 'Teacher ID required' });
        }

        const result = await pool.query(
            `SELECT t.*, 
                    s.name as subject_name,
                    c.name as class_name,
                    sec.name as section_name
             FROM timetables t
             LEFT JOIN subjects s ON t.subject_id = s.id
             LEFT JOIN classes c ON t.class_id = c.id
             LEFT JOIN sections sec ON t.section_id = sec.id
             WHERE t.school_id = $1 AND t.teacher_id = $2
             ORDER BY t.day_of_week, t.period_number`,
            [school_id, targetTeacherId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching teacher timetable:', error);
        res.status(500).json({ message: 'Server error fetching teacher timetable' });
    }
};

// Get Student's Personal Timetable
exports.getMyTimetable = async (req, res) => {
    try {
        const { id, role, schoolId, linkedId } = req.user;
        let student_id = linkedId;

        if (!student_id && role === 'STUDENT') {
            // Fallback
            const studentRes = await pool.query(
                'SELECT id FROM students WHERE school_id = $1 AND LOWER(email) = LOWER($2)',
                [schoolId, req.user.email]
            );
            if (studentRes.rows.length > 0) student_id = studentRes.rows[0].id;
        }

        if (!student_id) return res.status(404).json({ message: 'Student profile not found' });

        // Get class/section
        const student = await pool.query('SELECT class_id, section_id FROM students WHERE id = $1', [student_id]);
        if (student.rows.length === 0) return res.status(404).json({ message: 'Student record not found' });

        const { class_id, section_id } = student.rows[0];

        const result = await pool.query(
            `SELECT t.*, 
                    s.name as subject_name,
                    te.name as teacher_name,
                    te.id as teacher_id
             FROM timetables t
             LEFT JOIN subjects s ON t.subject_id = s.id
             LEFT JOIN teachers te ON t.teacher_id = te.id
             WHERE t.school_id = $1 AND t.class_id = $2 AND (t.section_id = $3 OR t.section_id IS NULL)
             ORDER BY t.day_of_week, t.period_number`,
            [schoolId, class_id, section_id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching my timetable:', error);
        res.status(500).json({ message: 'Server error fetching timetable' });
    }
};
