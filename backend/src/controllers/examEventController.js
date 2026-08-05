const { pool } = require('../config/db');

// ─── EXAM EVENTS (CIE-1, Monthly, Annual, etc.) ───────────────────────────────

exports.getEvents = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id, academic_year, status } = req.query;

        let q = `SELECT e.*, 
            COUNT(DISTINCT ts.id) as slot_count
            FROM exam_events e
            LEFT JOIN exam_timetable_slots ts ON ts.event_id = e.id
            WHERE e.school_id = $1`;
        const params = [school_id];
        let idx = 2;

        if (class_id) { q += ` AND e.class_id = $${idx++}`; params.push(class_id); }
        if (academic_year) { q += ` AND e.academic_year = $${idx++}`; params.push(academic_year); }
        if (status) { q += ` AND e.status = $${idx++}`; params.push(status); }

        q += ` GROUP BY e.id ORDER BY e.start_date DESC`;
        const result = await pool.query(q, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching exam events' });
    }
};

exports.getEventById = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;

        const evtRes = await pool.query(
            `SELECT * FROM exam_events WHERE id=$1 AND school_id=$2`, [id, school_id]
        );
        if (!evtRes.rows.length) return res.status(404).json({ message: 'Event not found' });

        const slotsRes = await pool.query(
            `SELECT ts.*, s.name as subject_name, s.type as subject_type, s.subject_code
             FROM exam_timetable_slots ts
             JOIN exam_subjects s ON s.id = ts.subject_id
             WHERE ts.event_id = $1
             ORDER BY ts.exam_date, ts.start_time`,
            [id]
        );

        res.json({ ...evtRes.rows[0], slots: slotsRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching event' });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { name, exam_type, class_id, academic_year, start_date, end_date, target_batch } = req.body;

        if (!name || !class_id) return res.status(400).json({ message: 'Name and class are required' });

        const result = await pool.query(
            `INSERT INTO exam_events (school_id, class_id, name, exam_type, academic_year, start_date, end_date, target_batch, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT') RETURNING *`,
            [school_id, class_id, name.trim(), exam_type || 'CUSTOM', academic_year || null, start_date || null, end_date || null, target_batch || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating exam event', error: err.message });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const { name, exam_type, class_id, academic_year, start_date, end_date, status, target_batch } = req.body;

        const result = await pool.query(
            `UPDATE exam_events SET name=$1, exam_type=$2, class_id=$3, academic_year=$4,
             start_date=$5, end_date=$6, status=$7, target_batch=$8, updated_at=NOW()
             WHERE id=$9 AND school_id=$10 RETURNING *`,
            [name, exam_type, class_id, academic_year, start_date, end_date, status || 'DRAFT', target_batch || null, id, school_id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Event not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating exam event' });
    }
};

exports.publishEvent = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE exam_events SET status='PUBLISHED', updated_at=NOW()
             WHERE id=$1 AND school_id=$2 RETURNING *`,
            [id, school_id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Event not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error publishing event' });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const result = await pool.query(
            `DELETE FROM exam_events WHERE id=$1 AND school_id=$2 RETURNING *`,
            [id, school_id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Event not found' });
        res.json({ message: 'Event deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error deleting event' });
    }
};

// ─── TIMETABLE SLOTS ─────────────────────────────────────────────────────────

exports.getSlots = async (req, res) => {
    try {
        const { event_id } = req.params;
        const result = await pool.query(
            `SELECT ts.*, s.name as subject_name, s.type as subject_type, s.subject_code, s.is_common_to_all
             FROM exam_timetable_slots ts
             JOIN exam_subjects s ON s.id = ts.subject_id
             WHERE ts.event_id = $1
             ORDER BY ts.exam_date, ts.start_time`,
            [event_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching slots' });
    }
};

exports.saveSlots = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { event_id } = req.params;
        const { slots } = req.body;
        // slots: [{ subject_id, exam_date, start_time, duration_minutes, room_number, max_theory_marks, max_practical_marks }]

        // Verify event belongs to school
        const evtCheck = await client.query(
            `SELECT id FROM exam_events WHERE id=$1 AND school_id=$2`, [event_id, school_id]
        );
        if (!evtCheck.rows.length) return res.status(403).json({ message: 'Not authorized' });

        await client.query('BEGIN');

        // Delete existing slots and re-insert (simple upsert)
        await client.query(`DELETE FROM exam_timetable_slots WHERE event_id = $1`, [event_id]);

        for (const slot of slots) {
            const maxPractical = slot.max_practical_marks || 0;
            const maxTheory = slot.max_theory_marks || 100;
            await client.query(
                `INSERT INTO exam_timetable_slots 
                    (event_id, subject_id, exam_date, start_time, duration_minutes, room_number, invigilator_name,
                     max_theory_marks, max_practical_marks, max_total_marks)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    event_id, slot.subject_id, slot.exam_date || null,
                    slot.start_time || null, slot.duration_minutes || 180,
                    slot.room_number || null, slot.invigilator_name || null,
                    maxTheory, maxPractical, maxTheory + maxPractical
                ]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Timetable slots saved', count: slots.length });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error saving slots', error: err.message });
    } finally {
        client.release();
    }
};

// ─── MARKS ENTRY ─────────────────────────────────────────────────────────────

// Get students who should take a given timetable slot (filtered by their combination)
exports.getStudentsForSlot = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { slot_id } = req.params;

        // Get slot info to find subject + event (which has class_id)
        const slotRes = await pool.query(
            `SELECT ts.*, e.class_id, e.academic_year, e.target_batch, s.is_common_to_all, s.type as subject_type
             FROM exam_timetable_slots ts
             JOIN exam_events e ON e.id = ts.event_id
             JOIN exam_subjects s ON s.id = ts.subject_id
             WHERE ts.id = $1`,
            [slot_id]
        );
        if (!slotRes.rows.length) return res.status(404).json({ message: 'Slot not found' });
        const slot = slotRes.rows[0];

        // If subject is common to all, get all students in class
        // Otherwise, get only students whose group contains this subject
        let studentQuery;
        let batchFilter = slot.target_batch ? ` AND ',' || LOWER(REPLACE(s.exam_batch, ' ', '')) || ',' LIKE '%,${slot.target_batch.trim().toLowerCase()},%'` : '';

        if (slot.is_common_to_all) {
            studentQuery = await pool.query(
                `SELECT s.id, s.name, s.admission_no, s.roll_no,
                        m.theory_marks, m.practical_marks, m.total_marks, m.is_absent, m.id as mark_id
                 FROM students s
                 LEFT JOIN student_exam_marks m ON m.student_id = s.id AND m.slot_id = $1
                 WHERE s.school_id = $2 AND s.class_id = $3 ${batchFilter}
                 ORDER BY s.roll_no, s.name`,
                [slot_id, school_id, slot.class_id]
            );
        } else {
            // Get students whose group includes this subject, or whose chosen_subjects includes it
            studentQuery = await pool.query(
                `SELECT s.id, s.name, s.admission_no, s.roll_no,
                        m.theory_marks, m.practical_marks, m.total_marks, m.is_absent, m.id as mark_id
                 FROM students s
                 JOIN student_subject_assignments a ON a.student_id = s.id 
                    AND a.school_id = $2 AND a.class_id = $3 AND a.academic_year = $4
                 JOIN exam_group_subjects gs ON gs.group_id = a.group_id AND gs.subject_id = $5
                 LEFT JOIN student_exam_marks m ON m.student_id = s.id AND m.slot_id = $1
                 WHERE s.school_id = $2 AND s.class_id = $3 ${batchFilter}
                 UNION
                 -- Also include students who individually chose this subject (language pool)
                 SELECT s.id, s.name, s.admission_no, s.roll_no,
                        m.theory_marks, m.practical_marks, m.total_marks, m.is_absent, m.id as mark_id
                 FROM students s
                 JOIN student_subject_assignments a ON a.student_id = s.id 
                    AND a.school_id = $2 AND a.class_id = $3 AND a.academic_year = $4
                 LEFT JOIN student_exam_marks m ON m.student_id = s.id AND m.slot_id = $1
                 WHERE s.school_id = $2 AND s.class_id = $3
                   AND a.chosen_subjects::jsonb @> jsonb_build_array(jsonb_build_object('subject_id', $5))
                   ${batchFilter}
                 ORDER BY roll_no, name`,
                [slot_id, school_id, slot.class_id, slot.academic_year, slot.subject_id]
            );
        }

        res.json({
            slot,
            students: studentQuery.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching students for slot', error: err.message });
    }
};

exports.saveMarks = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { slot_id } = req.params;
        const { marks } = req.body;
        // marks: [{ student_id, theory_marks, practical_marks, is_absent }]

        // Verify slot belongs to school via event
        const slotCheck = await client.query(
            `SELECT ts.id, ts.max_theory_marks, ts.max_practical_marks, ts.max_total_marks, ts.subject_id,
                    e.class_id, e.academic_year
             FROM exam_timetable_slots ts
             JOIN exam_events e ON e.id = ts.event_id AND e.school_id = $1
             WHERE ts.id = $2`,
            [school_id, slot_id]
        );
        if (!slotCheck.rows.length) return res.status(403).json({ message: 'Not authorized' });
        const slot = slotCheck.rows[0];

        await client.query('BEGIN');

        for (const m of marks) {
            const theory = m.is_absent ? null : (parseFloat(m.theory_marks) || 0);
            const practical = m.is_absent ? null : (parseFloat(m.practical_marks) || 0);
            const total = (theory !== null && practical !== null) ? theory + practical : null;

            await client.query(
                `INSERT INTO student_exam_marks
                    (student_id, slot_id, school_id, theory_marks, practical_marks, total_marks, is_absent, entered_by, entered_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                 ON CONFLICT (student_id, slot_id)
                 DO UPDATE SET theory_marks=$4, practical_marks=$5, total_marks=$6, is_absent=$7, entered_by=$8, entered_at=NOW()`,
                [m.student_id, slot_id, school_id, theory, practical, total, !!m.is_absent, req.user.id]
            );
        }

        await client.query('COMMIT');
        res.json({ message: `Marks saved for ${marks.length} students` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error saving marks', error: err.message });
    } finally {
        client.release();
    }
};

// Get student marksheet (all their marks for an event)
exports.getStudentMarksheet = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { student_id, event_id } = req.query;

        const result = await pool.query(
            `SELECT 
                ts.exam_date, ts.max_theory_marks, ts.max_practical_marks, ts.max_total_marks,
                s.name as subject_name, s.subject_code, s.type as subject_type,
                m.theory_marks, m.practical_marks, m.total_marks, m.is_absent
             FROM exam_timetable_slots ts
             JOIN exam_subjects s ON s.id = ts.subject_id
             LEFT JOIN student_exam_marks m ON m.slot_id = ts.id AND m.student_id = $1
             WHERE ts.event_id = $2
               AND (
                   s.is_common_to_all = TRUE
                   OR EXISTS (
                       SELECT 1 FROM student_subject_assignments a
                       JOIN exam_group_subjects gs ON gs.group_id = a.group_id AND gs.subject_id = ts.subject_id
                       WHERE a.student_id = $1 AND a.school_id = $3
                   )
               )
             ORDER BY ts.exam_date, s.name`,
            [student_id, event_id, school_id]
        );

        const studentRes = await pool.query(
            `SELECT s.name, s.admission_no, s.roll_no, c.class_name, sec.section_name
             FROM students s
             LEFT JOIN classes c ON c.id = s.class_id
             LEFT JOIN sections sec ON sec.id = s.section_id
             WHERE s.id = $1 AND s.school_id = $2`,
            [student_id, school_id]
        );

        const eventRes = await pool.query(`SELECT * FROM exam_events WHERE id=$1`, [event_id]);

        const marks = result.rows;
        const totalObtained = marks.reduce((sum, m) => sum + (m.total_marks || 0), 0);
        const totalMax = marks.reduce((sum, m) => sum + (m.max_total_marks || 0), 0);
        const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(2) : 0;

        res.json({
            student: studentRes.rows[0] || null,
            event: eventRes.rows[0] || null,
            marks,
            summary: { total_obtained: totalObtained, total_max: totalMax, percentage }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching marksheet', error: err.message });
    }
};

// Get class rank list for an event
exports.getClassRanks = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { event_id } = req.params;

        const evtRes = await pool.query(`SELECT * FROM exam_events WHERE id=$1 AND school_id=$2`, [event_id, school_id]);
        if (!evtRes.rows.length) return res.status(404).json({ message: 'Event not found' });
        const evt = evtRes.rows[0];

        // Aggregate total marks per student across all slots they took
        const result = await pool.query(
            `SELECT 
                s.id as student_id, s.name, s.admission_no, s.roll_no,
                a.group_id, g.name as group_name,
                SUM(m.total_marks) as total_obtained,
                SUM(ts.max_total_marks) as total_max,
                COUNT(CASE WHEN m.is_absent = TRUE THEN 1 END) as absences
             FROM students s
             JOIN student_subject_assignments a ON a.student_id = s.id AND a.school_id = $1 AND a.class_id = $2
             LEFT JOIN exam_subject_groups g ON g.id = a.group_id
             JOIN exam_timetable_slots ts ON ts.event_id = $3
             LEFT JOIN student_exam_marks m ON m.student_id = s.id AND m.slot_id = ts.id
             WHERE s.school_id = $1 AND s.class_id = $2
             GROUP BY s.id, s.name, s.admission_no, s.roll_no, a.group_id, g.name
             ORDER BY a.group_id, total_obtained DESC NULLS LAST`,
            [school_id, evt.class_id, event_id]
        );

        // Add rank within each group
        let grouped = {};
        result.rows.forEach(row => {
            const key = row.group_id || 'default';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(row);
        });

        const ranked = [];
        for (const key of Object.keys(grouped)) {
            grouped[key].forEach((student, idx) => {
                ranked.push({ ...student, rank: idx + 1 });
            });
        }

        res.json({ event: evt, students: ranked });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching ranks', error: err.message });
    }
};

// Student's own marks (for student dashboard)
exports.getMyExamMarks = async (req, res) => {
    try {
        const { schoolId, linkedId, email } = req.user;

        let studentId = linkedId;
        if (!studentId) {
            const st = await pool.query(
                `SELECT id FROM students WHERE school_id=$1 AND LOWER(email)=LOWER($2) LIMIT 1`,
                [schoolId, email]
            );
            if (st.rows.length) studentId = st.rows[0].id;
        }
        if (!studentId) return res.status(404).json({ message: 'Student not found' });

        const result = await pool.query(
            `SELECT e.name as event_name, e.exam_type, e.start_date,
                    s.name as subject_name, s.subject_code,
                    ts.exam_date, ts.max_theory_marks, ts.max_practical_marks, ts.max_total_marks,
                    m.theory_marks, m.practical_marks, m.total_marks, m.is_absent
             FROM student_exam_marks m
             JOIN exam_timetable_slots ts ON ts.id = m.slot_id
             JOIN exam_events e ON e.id = ts.event_id AND e.status = 'PUBLISHED'
             JOIN exam_subjects s ON s.id = ts.subject_id
             WHERE m.student_id = $1 AND m.school_id = $2
             ORDER BY e.start_date DESC, ts.exam_date`,
            [studentId, schoolId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching my marks' });
    }
};
