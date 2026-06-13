const { pool } = require('../config/db');

// ─── SUBJECTS MASTER ──────────────────────────────────────────────────────────

exports.getSubjects = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const result = await pool.query(
            `SELECT * FROM exam_subjects WHERE school_id = $1 ORDER BY type, name`,
            [school_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching subjects' });
    }
};

exports.createSubject = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { name, subject_code, type, is_common_to_all } = req.body;
        if (!name) return res.status(400).json({ message: 'Subject name is required' });

        const result = await pool.query(
            `INSERT INTO exam_subjects (school_id, name, subject_code, type, is_common_to_all)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [school_id, name.trim(), subject_code || null, type || 'CORE', !!is_common_to_all]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating subject' });
    }
};

exports.updateSubject = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const { name, subject_code, type, is_common_to_all } = req.body;

        const result = await pool.query(
            `UPDATE exam_subjects SET name=$1, subject_code=$2, type=$3, is_common_to_all=$4
             WHERE id=$5 AND school_id=$6 RETURNING *`,
            [name, subject_code || null, type || 'CORE', !!is_common_to_all, id, school_id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Subject not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating subject' });
    }
};

exports.deleteSubject = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const result = await pool.query(
            `DELETE FROM exam_subjects WHERE id=$1 AND school_id=$2 RETURNING *`,
            [id, school_id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Subject not found' });
        res.json({ message: 'Subject deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error deleting subject' });
    }
};

// ─── SUBJECT GROUPS (COMBINATIONS) ───────────────────────────────────────────

exports.getGroups = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id } = req.query;

        let q = `SELECT g.*, 
            COALESCE(json_agg(
                json_build_object(
                    'id', s.id, 'name', s.name, 'subject_code', s.subject_code,
                    'type', s.type, 'is_required', gs.is_required,
                    'choice_pool_id', gs.choice_pool_id
                ) ORDER BY s.type, s.name
            ) FILTER (WHERE s.id IS NOT NULL), '[]') AS subjects
            FROM exam_subject_groups g
            LEFT JOIN exam_group_subjects gs ON gs.group_id = g.id
            LEFT JOIN exam_subjects s ON s.id = gs.subject_id
            WHERE g.school_id = $1`;
        const params = [school_id];

        if (class_id) {
            q += ` AND g.class_id = $2`;
            params.push(class_id);
        }

        q += ` GROUP BY g.id ORDER BY g.is_default DESC, g.name`;
        const result = await pool.query(q, params);

        // Attach choice pools
        const groups = result.rows;
        if (groups.length > 0) {
            const poolRes = await pool.query(
                `SELECT * FROM exam_choice_pools WHERE school_id = $1`, [school_id]
            );
            const poolMap = {};
            poolRes.rows.forEach(p => { poolMap[p.id] = p.name; });
            groups.forEach(g => {
                g.subjects = g.subjects.map(s => ({
                    ...s,
                    choice_pool_name: s.choice_pool_id ? poolMap[s.choice_pool_id] : null
                }));
            });
        }

        res.json(groups);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching groups' });
    }
};

exports.createGroup = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { name, class_id, description, is_default, subjects } = req.body;
        // subjects = [{ subject_id, is_required, choice_pool_name }]

        if (!name) return res.status(400).json({ message: 'Group name is required' });

        await client.query('BEGIN');

        const grpRes = await client.query(
            `INSERT INTO exam_subject_groups (school_id, class_id, name, description, is_default)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [school_id, class_id || null, name.trim(), description || null, !!is_default]
        );
        const group = grpRes.rows[0];

        // Handle subjects with choice pools
        if (subjects && subjects.length > 0) {
            // Create pools if needed
            const poolCache = {};
            for (const sub of subjects) {
                if (sub.choice_pool_name && !poolCache[sub.choice_pool_name]) {
                    const pRes = await client.query(
                        `INSERT INTO exam_choice_pools (school_id, group_id, name)
                         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
                        [school_id, group.id, sub.choice_pool_name]
                    );
                    if (pRes.rows.length) poolCache[sub.choice_pool_name] = pRes.rows[0].id;
                }
            }

            for (const sub of subjects) {
                const poolId = sub.choice_pool_name ? poolCache[sub.choice_pool_name] : null;
                await client.query(
                    `INSERT INTO exam_group_subjects (group_id, subject_id, is_required, choice_pool_id)
                     VALUES ($1, $2, $3, $4)`,
                    [group.id, sub.subject_id, sub.is_required !== false, poolId]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ ...group, subjects: subjects || [] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error creating group', error: err.message });
    } finally {
        client.release();
    }
};

exports.updateGroup = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const { name, class_id, description, is_default, subjects } = req.body;

        await client.query('BEGIN');

        const grpRes = await client.query(
            `UPDATE exam_subject_groups SET name=$1, class_id=$2, description=$3, is_default=$4
             WHERE id=$5 AND school_id=$6 RETURNING *`,
            [name, class_id || null, description || null, !!is_default, id, school_id]
        );
        if (!grpRes.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Group not found' });
        }

        if (subjects !== undefined) {
            // Remove old subjects & old pools for this group
            await client.query(`DELETE FROM exam_group_subjects WHERE group_id = $1`, [id]);
            await client.query(`DELETE FROM exam_choice_pools WHERE group_id = $1`, [id]);

            const poolCache = {};
            for (const sub of subjects) {
                if (sub.choice_pool_name && !poolCache[sub.choice_pool_name]) {
                    const pRes = await client.query(
                        `INSERT INTO exam_choice_pools (school_id, group_id, name) VALUES ($1, $2, $3) RETURNING id`,
                        [school_id, id, sub.choice_pool_name]
                    );
                    poolCache[sub.choice_pool_name] = pRes.rows[0].id;
                }
            }

            for (const sub of subjects) {
                const poolId = sub.choice_pool_name ? poolCache[sub.choice_pool_name] : null;
                await client.query(
                    `INSERT INTO exam_group_subjects (group_id, subject_id, is_required, choice_pool_id)
                     VALUES ($1, $2, $3, $4)`,
                    [id, sub.subject_id, sub.is_required !== false, poolId]
                );
            }
        }

        await client.query('COMMIT');
        res.json(grpRes.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error updating group', error: err.message });
    } finally {
        client.release();
    }
};

exports.deleteGroup = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const result = await pool.query(
            `DELETE FROM exam_subject_groups WHERE id=$1 AND school_id=$2 RETURNING *`,
            [id, school_id]
        );
        if (!result.rows.length) return res.status(404).json({ message: 'Group not found' });
        res.json({ message: 'Group deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error deleting group' });
    }
};

// ─── STUDENT COMBINATION ASSIGNMENT ──────────────────────────────────────────

exports.getStudentAssignment = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { student_id } = req.params;
        const result = await pool.query(
            `SELECT a.*, g.name as group_name
             FROM student_subject_assignments a
             LEFT JOIN exam_subject_groups g ON g.id = a.group_id
             WHERE a.student_id = $1 AND a.school_id = $2
             ORDER BY a.assigned_at DESC LIMIT 1`,
            [student_id, school_id]
        );
        res.json(result.rows[0] || null);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching assignment' });
    }
};

exports.assignStudentGroup = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { student_id, group_id, class_id, academic_year, chosen_subjects } = req.body;
        // chosen_subjects: [{ pool_id, subject_id }] — language choices etc.

        await client.query('BEGIN');

        // Upsert the assignment
        const result = await client.query(
            `INSERT INTO student_subject_assignments 
                (student_id, school_id, class_id, academic_year, group_id, chosen_subjects, assigned_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             ON CONFLICT (student_id, school_id, class_id, academic_year)
             DO UPDATE SET group_id=$5, chosen_subjects=$6, assigned_at=NOW()
             RETURNING *`,
            [student_id, school_id, class_id, academic_year, group_id, JSON.stringify(chosen_subjects || [])]
        );

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error assigning group', error: err.message });
    } finally {
        client.release();
    }
};

exports.bulkAssignGroup = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { student_ids, group_id, class_id, academic_year, chosen_subjects } = req.body;

        if (!student_ids || !student_ids.length) return res.status(400).json({ message: 'No students provided' });
        if (!group_id && (!chosen_subjects || !chosen_subjects.length)) {
            return res.status(400).json({ message: 'Must provide either a group or custom subjects' });
        }

        await client.query('BEGIN');
        for (const student_id of student_ids) {
            await client.query(
                `INSERT INTO student_subject_assignments
                    (student_id, school_id, class_id, academic_year, group_id, chosen_subjects, assigned_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())
                 ON CONFLICT (student_id, school_id, class_id, academic_year)
                 DO UPDATE SET group_id=$5, chosen_subjects=$6, assigned_at=NOW()`,
                [student_id, school_id, class_id, academic_year, group_id || null, JSON.stringify(chosen_subjects || [])]
            );
        }
        await client.query('COMMIT');
        res.json({ message: `${student_ids.length} students assigned to group` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: 'Error bulk assigning', error: err.message });
    } finally {
        client.release();
    }
};

exports.clearAssignments = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { student_ids, class_id, academic_year } = req.body;

        if (!student_ids || !student_ids.length) return res.status(400).json({ message: 'No students provided' });

        await pool.query(
            `DELETE FROM student_subject_assignments 
             WHERE school_id = $1 AND class_id = $2 AND academic_year = $3 AND student_id = ANY($4::int[])`,
            [school_id, class_id, academic_year, student_ids]
        );

        res.json({ message: 'Assignments cleared successfully' });
    } catch (err) {
        console.error('Error clearing assignments:', err);
        res.status(500).json({ message: 'Error clearing assignments', error: err.message });
    }
};

// Get all students in a class with their assignment info
exports.getClassAssignments = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id, academic_year } = req.query;

        const result = await pool.query(
            `SELECT s.id, s.name, s.admission_no, s.roll_number,
                    a.group_id, a.chosen_subjects, g.name as group_name
             FROM students s
             LEFT JOIN student_subject_assignments a ON a.student_id = s.id 
                AND a.school_id = $1 AND a.class_id = $2 AND a.academic_year = $3
             LEFT JOIN exam_subject_groups g ON g.id = a.group_id
             WHERE s.school_id = $1 AND s.class_id = $2
             ORDER BY s.name`,
            [school_id, class_id, academic_year]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching class assignments' });
    }
};
