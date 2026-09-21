const { pool } = require('../config/db');
const { isTeacherAuthorizedForClass } = require('../utils/teacherAccess');

// Helper to format Date objects to YYYY-MM-DD string without timezone distortion
const formatLocalDateString = (d) => {
    if (!d) return null;
    if (typeof d === 'string') return d.split('T')[0];
    if (d instanceof Date) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return String(d).split('T')[0];
};

// Get Exam Schedule
exports.getExamSchedule = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id, section_id, exam_type_id } = req.query;

        let query = `
            SELECT es.*, es.topic, sub.name as subject_name, c.name as class_name, s.name as section_name, et.name as exam_type_name
            FROM exam_schedules es
            JOIN subjects sub ON es.subject_id = sub.id
            JOIN classes c ON es.class_id = c.id
            LEFT JOIN sections s ON es.section_id = s.id
            JOIN exam_types et ON es.exam_type_id = et.id
            WHERE es.school_id = $1
        `;

        const params = [school_id];
        let paramIndex = 2;

        if (exam_type_id) {
            query += ` AND es.exam_type_id = $${paramIndex}`;
            params.push(exam_type_id);
            paramIndex++;
        }

        if (class_id && !isNaN(parseInt(class_id))) {
            query += ` AND es.class_id = $${paramIndex}`;
            params.push(parseInt(class_id));
            paramIndex++;
        }

        if (section_id && !isNaN(parseInt(section_id))) {
            query += ` AND (es.section_id = $${paramIndex} OR es.section_id IS NULL)`;
            params.push(parseInt(section_id));
            paramIndex++;
        }

        query += ` ORDER BY es.exam_date, es.start_time`;

        const result = await pool.query(query, params);

        const rows = result.rows.map(item => ({
            ...item,
            exam_date: formatLocalDateString(item.exam_date)
        }));

        res.json(rows);
    } catch (error) {
        console.error('Error fetching exam schedule:', error);
        res.status(500).json({ message: 'Server error fetching schedule', error: error.message });
    }
};

// Save Exam Schedule
exports.saveExamSchedule = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { schedules, delete_existing } = req.body;

        if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
            return res.status(400).json({ message: 'No schedules provided' });
        }

        if (req.user.role === 'TEACHER') {
            for (const s of schedules) {
                const ok = await isTeacherAuthorizedForClass(req.user, s.class_id, s.section_id);
                if (!ok) {
                    return res.status(403).json({ message: 'Access denied: You can only schedule exams for your assigned class.' });
                }
            }
        }

        await client.query('BEGIN');

        if (delete_existing) {
            const keys = new Set(schedules.map(s => `${s.class_id}-${s.section_id || 'NULL'}-${s.exam_type_id}`));

            for (const key of keys) {
                const [cid, sid, eid] = key.split('-');
                const sectionId = sid === 'NULL' ? null : sid;

                let fetchQuery = `
                    SELECT id, subject_id 
                    FROM exam_schedules 
                    WHERE school_id = $1 AND class_id = $2
                `;
                const fetchParams = [school_id, cid];

                if (sectionId) {
                    fetchParams.push(sectionId);
                    fetchQuery += ` AND section_id = $${fetchParams.length}`;
                } else {
                    fetchQuery += ` AND section_id IS NULL`;
                }

                fetchParams.push(eid);
                fetchQuery += ` AND exam_type_id = $${fetchParams.length}`;

                const existing = await client.query(fetchQuery, fetchParams);
                const existingMap = new Map();
                existing.rows.forEach(row => existingMap.set(row.subject_id, row.id));

                const incomingSubjects = new Set();
                const schedulesForBlock = schedules.filter(s =>
                    String(s.class_id) === cid &&
                    String(s.section_id || 'NULL') === sid &&
                    String(s.exam_type_id) === eid
                );

                const upsertPromises = schedulesForBlock.map(schedule => {
                    incomingSubjects.add(Number(schedule.subject_id));

                    if (existingMap.has(Number(schedule.subject_id))) {
                        const existingId = existingMap.get(Number(schedule.subject_id));
                        return client.query(
                            `UPDATE exam_schedules SET 
                                exam_date = $1, start_time = $2, end_time = $3, 
                                components = $4, max_marks = $5, min_marks = $6,
                                target_batch = $7, topic = $8
                             WHERE id = $9`,
                            [
                                schedule.exam_date || null,
                                schedule.start_time || null,
                                schedule.end_time || null,
                                JSON.stringify(schedule.components || []),
                                schedule.max_marks || 100,
                                schedule.min_marks || 35,
                                schedule.target_batch || null,
                                schedule.topic || null,
                                existingId
                            ]
                        );
                    } else {
                        const insertQ = `
                            INSERT INTO exam_schedules 
                            (school_id, exam_type_id, class_id, section_id, subject_id, exam_date, start_time, end_time, components, max_marks, min_marks, target_batch, topic)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                        `;
                        return client.query(insertQ, [
                            school_id,
                            schedule.exam_type_id,
                            schedule.class_id,
                            schedule.section_id || null,
                            schedule.subject_id,
                            schedule.exam_date || null,
                            schedule.start_time || null,
                            schedule.end_time || null,
                            JSON.stringify(schedule.components || []),
                            schedule.max_marks || 100,
                            schedule.min_marks || 35,
                            schedule.target_batch || null,
                            schedule.topic || null
                        ]);
                    }
                });
                
                await Promise.all(upsertPromises);

                const deletePromises = [];
                for (const [subjectId, scheduleId] of existingMap.entries()) {
                    if (!incomingSubjects.has(subjectId)) {
                        deletePromises.push(client.query(
                            `DELETE FROM exam_schedules WHERE id = $1`,
                            [scheduleId]
                        ));
                    }
                }
                if (deletePromises.length > 0) {
                    await Promise.all(deletePromises);
                }
            }
        } else {
            const insertPromises = schedules.map(schedule => {
                return client.query(
                    `INSERT INTO exam_schedules 
                     (school_id, exam_type_id, class_id, section_id, subject_id, exam_date, start_time, end_time, components, max_marks, min_marks, target_batch, topic)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                    [
                        school_id,
                        schedule.exam_type_id,
                        schedule.class_id,
                        schedule.section_id || null,
                        schedule.subject_id,
                        schedule.exam_date || null,
                        schedule.start_time || null,
                        schedule.end_time || null,
                        JSON.stringify(schedule.components || []),
                        schedule.max_marks || 100,
                        schedule.min_marks || 35,
                        schedule.target_batch || null,
                        schedule.topic || null
                    ]
                );
            });
            await Promise.all(insertPromises);
        }

        await client.query('COMMIT');
        res.json({ message: 'Exam schedule saved successfully' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving exam schedule:', error);
        res.status(500).json({ message: 'Server error saving schedule', error: error.message });
    } finally {
        client.release();
    }
};

// Update Single Exam Schedule Item
exports.updateExamScheduleItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const school_id = req.user.schoolId;
        let { exam_date, start_time, end_time, components, max_marks, min_marks, ids, subject_id, topic } = req.body;

        const itemId = parseInt(id);
        exam_date = exam_date || null;
        start_time = start_time || null;
        end_time = end_time || null;
        const newSubjectId = subject_id ? parseInt(subject_id) : null;

        await client.query('BEGIN');

        // --- Step 1: Fetch the existing schedule rows BEFORE update ---
        // We need old subject_id(s), class_id, section_id, exam_type_id to migrate marks
        const targetIds = (ids && Array.isArray(ids) && ids.length > 0)
            ? ids.map(i => parseInt(i)).filter(i => !isNaN(i))
            : [itemId];

        const existingRows = await client.query(
            `SELECT id, subject_id, class_id, section_id, exam_type_id
             FROM exam_schedules
             WHERE id = ANY($1::int[]) AND school_id = $2`,
            [targetIds, school_id]
        );

        if (existingRows.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Schedule item not found' });
        }

        // --- Step 2: Update exam_schedules ---
        const updateTopicClause = topic !== undefined ? ', topic = $10' : '';
        const queryParams = [
            exam_date,
            start_time,
            end_time,
            typeof components === 'string' ? components : JSON.stringify(components || []),
            parseFloat(max_marks) || 100,
            parseFloat(min_marks) || 35,
            targetIds,
            school_id,
            newSubjectId
        ];
        if (topic !== undefined) {
            queryParams.push(topic && topic.trim() ? topic.trim() : null);
        }

        const result = await client.query(
            `UPDATE exam_schedules 
             SET exam_date = $1, start_time = $2, end_time = $3, 
                 components = $4, max_marks = $5, min_marks = $6,
                 subject_id = COALESCE($9, subject_id)
                 ${updateTopicClause}
             WHERE id = ANY($7::int[]) AND school_id = $8
             RETURNING *`,
            queryParams
        );

        // --- Step 3: Migrate marks if subject changed ---
        if (newSubjectId) {
            for (const existingRow of existingRows.rows) {
                const oldSubjectId = existingRow.subject_id;

                // Only migrate if subject actually changed
                if (oldSubjectId && oldSubjectId !== newSubjectId) {
                    const { class_id, section_id, exam_type_id } = existingRow;

                    // Re-key marks from old subject_id → new subject_id
                    // ON CONFLICT: if marks already exist for new subject, skip (keep existing new-subject marks)
                    await client.query(
                        `UPDATE marks
                         SET subject_id = $1
                         WHERE school_id = $2
                           AND subject_id = $3
                           AND class_id = $4
                           AND exam_type_id = $5
                           AND ($6::int IS NULL OR section_id = $6)
                           AND NOT EXISTS (
                               SELECT 1 FROM marks m2
                               WHERE m2.school_id = marks.school_id
                                 AND m2.student_id = marks.student_id
                                 AND m2.subject_id = $1
                                 AND m2.exam_type_id = marks.exam_type_id
                                 AND m2.year = marks.year
                           )`,
                        [newSubjectId, school_id, oldSubjectId, class_id, exam_type_id, section_id || null]
                    );

                    console.log(`[ExamSchedule] Migrated marks: subject ${oldSubjectId} → ${newSubjectId} for class ${class_id}, section ${section_id}, exam_type ${exam_type_id}`);
                }
            }
        }

        await client.query('COMMIT');

        const item = {
            ...result.rows[0],
            exam_date: formatLocalDateString(result.rows[0].exam_date)
        };

        res.json({ message: 'Schedule updated successfully', item });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating schedule item:', error);
        res.status(500).json({ message: 'Server error updating schedule item', error: error.message });
    } finally {
        client.release();
    }
};

