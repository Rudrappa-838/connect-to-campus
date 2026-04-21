const { pool } = require('../config/db');
const path = require('path');
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// Startup Migration: Ensure SATS column exists to prevent 500 errors
let columnChecked = false;
async function ensureSatsColumn() {
    if (columnChecked) return;
    try {
        await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS sats_number VARCHAR(50)');
        columnChecked = true;
    } catch (err) {
        console.error('Migration Safety Check Failed:', err.message);
    }
}
ensureSatsColumn();

/**
 * Converts a number or string of digits into words (Digit-by-digit as per user request e.g. 409 -> FOUR ZERO NINE)
 * Falls back to "ZERO" if null or empty.
 */
const convertToDigitWords = (num) => {
    if (num === null || num === undefined || num === '') return '-';
    const words = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];
    const str = num.toString().replace(/[^0-9]/g, ''); // Keep only digits for words
    if (!str) return num.toString();
    return str.split('').map(digit => words[parseInt(digit)]).join(' ');
};

// Get or Create Exam Types
exports.getExamTypes = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id, student_id } = req.query;

        let query = `SELECT DISTINCT et.* FROM exam_types et WHERE et.school_id = $1`;
        const params = [school_id];

        if (class_id) {
            // Smart Filter: Show if defined in Schedule (Current Class) OR has Marks (History)
            query += ` AND (
                EXISTS (SELECT 1 FROM exam_schedules es WHERE es.exam_type_id = et.id AND es.class_id = $2)
                ${student_id ? `OR EXISTS (SELECT 1 FROM marks m WHERE m.exam_type_id = et.id AND m.student_id = $3)` : ''}
            )`;
            params.push(class_id);
            if (student_id) params.push(student_id);
        }

        query += ` ORDER BY et.name`;

        const examTypesResult = await pool.query(query, params);

        // Get components for each exam type
        const examTypes = await Promise.all(examTypesResult.rows.map(async (examType) => {
            const componentsResult = await pool.query(
                `SELECT * FROM exam_components WHERE exam_type_id = $1 ORDER BY display_order`,
                [examType.id]
            );
            return {
                ...examType,
                components: componentsResult.rows
            };
        }));

        res.json(examTypes);
    } catch (error) {
        console.error('Error fetching exam types:', error);
        res.status(500).json({ message: 'Server error fetching exam types' });
    }
};

exports.createExamType = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { name, max_marks, min_marks, start_month, end_month, weightage, components } = req.body;

        await client.query('BEGIN');

        const result = await client.query(
            `INSERT INTO exam_types (school_id, name, max_marks, min_marks, start_month, end_month, weightage)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [school_id, name, max_marks || 100, min_marks || 35, start_month || 1, end_month || 12, weightage || 0]
        );

        const examType = result.rows[0];

        // If components are provided, insert them
        if (components && Array.isArray(components) && components.length > 0) {
            for (let i = 0; i < components.length; i++) {
                const component = components[i];
                await client.query(
                    `INSERT INTO exam_components (exam_type_id, component_name, max_marks, display_order)
                     VALUES ($1, $2, $3, $4)`,
                    [examType.id, component.name, component.max_marks, i + 1]
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json(examType);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating exam type:', error);
        res.status(500).json({ message: 'Server error creating exam type' });
    } finally {
        client.release();
    }
};

exports.updateExamType = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const { name, max_marks, min_marks, start_month, end_month } = req.body;

        const result = await pool.query(
            `UPDATE exam_types 
             SET name = $1, max_marks = COALESCE($2, max_marks), min_marks = COALESCE($3, min_marks), 
                 start_month = COALESCE($4, start_month), end_month = COALESCE($5, end_month)
             WHERE id = $6 AND school_id = $7 RETURNING *`,
            [name, max_marks, min_marks, start_month, end_month, id, school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Exam type not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating exam type:', error);
        res.status(500).json({ message: 'Server error updating exam type' });
    }
};

exports.deleteExamType = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;

        await client.query('BEGIN');

        // Delete related schedules
        await client.query('DELETE FROM exam_schedules WHERE exam_type_id = $1 AND school_id = $2', [id, school_id]);

        // Delete related marks
        await client.query('DELETE FROM marks WHERE exam_type_id = $1 AND school_id = $2', [id, school_id]);

        // Delete related exam components
        await client.query('DELETE FROM exam_components WHERE exam_type_id = $1', [id]);

        // Delete the type
        const result = await client.query('DELETE FROM exam_types WHERE id = $1 AND school_id = $2 RETURNING *', [id, school_id]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Exam type not found' });
        }

        await client.query('COMMIT');
        res.json({ message: 'Exam type deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting exam type:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
    }
};

// Get Marks for a Class/Section/Exam
exports.getMarks = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id, section_id, exam_type_id, year, month, subject_id } = req.query;

        if (!class_id || !exam_type_id) {
            return res.status(400).json({ message: 'Class and Exam Type are required' });
        }

        console.log(`[Get Marks] Fetching marks for class_id=${class_id}, section_id=${section_id || 'NULL'}, exam_type_id=${exam_type_id}, year=${year || 'current'}`);

        let query = `SELECT m.*, 
                    st.name as student_name,
                    st.admission_no as admission_number,
                    st.roll_number,
                    sub.name as subject_name,
                    et.name as exam_name,
                    et.max_marks
             FROM marks m
             JOIN students st ON m.student_id = st.id AND (st.status IS NULL OR st.status != 'Deleted')
             LEFT JOIN subjects sub ON m.subject_id = sub.id
             JOIN exam_types et ON m.exam_type_id = et.id
             WHERE m.school_id = $1 AND m.class_id = $2 AND m.exam_type_id = $3`;

        const params = [school_id, class_id, exam_type_id];

        // Handle section_id properly
        if (section_id && section_id !== 'null' && section_id !== 'undefined') {
            params.push(section_id);
            query += ` AND m.section_id = $${params.length}`;
        }
        // If no section_id provided, we fetch marks for ALL sections in this class (Standard behavior)

        if (year) {
            params.push(year);
            query += ` AND m.year = $${params.length}`;
        }

        if (subject_id) {
            params.push(subject_id);
            query += ` AND m.subject_id = $${params.length}`;
        }

        query += ` ORDER BY st.roll_number, sub.name`;

        console.log(`[Get Marks] SQL Query:`, query);
        console.log(`[Get Marks] Params:`, params);

        const result = await pool.query(query, params);

        console.log(`[Get Marks] Found ${result.rows.length} marks`);

        // Log unique students found
        const uniqueStudents = [...new Set(result.rows.map(r => r.student_id))];
        console.log(`[Get Marks] Unique students: ${uniqueStudents.length} (IDs: ${uniqueStudents.join(', ')})`);

        // If no marks found, return empty array
        if (!result.rows || result.rows.length === 0) {
            return res.json([]);
        }

        // Fetch component marks for each mark
        const marksWithComponents = await Promise.all(result.rows.map(async (mark) => {
            try {
                const componentsResult = await pool.query(
                    `SELECT mc.*, ec.component_name, ec.max_marks as component_max_marks
                     FROM mark_components mc
                     JOIN exam_components ec ON mc.component_id = ec.id
                     WHERE mc.mark_id = $1
                     ORDER BY ec.display_order`,
                    [mark.id]
                );
                return {
                    ...mark,
                    components: componentsResult.rows || []
                };
            } catch (compError) {
                console.error('Error fetching components for mark:', mark.id, compError);
                return {
                    ...mark,
                    components: []
                };
            }
        }));

        res.json(marksWithComponents);
    } catch (error) {
        console.error('Error fetching marks:', error);
        res.status(500).json({ message: 'Server error fetching marks', error: error.message });
    }
};

exports.getMyMarks = async (req, res) => {
    try {
        const user_id = req.user.id;

        // Find student linked to this user
        const studentRes = await pool.query(
            `SELECT s.id, s.school_id 
             FROM students s 
             JOIN users u ON LOWER(s.email) = LOWER(u.email)
             WHERE u.id = $1`,
            [user_id]
        );

        if (studentRes.rows.length === 0) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        const student = studentRes.rows[0];

        // Fetch exams and marks for this student
        const marksResult = await pool.query(
            `SELECT m.*, 
                    sub.name as subject_name,
                    et.name as exam_name
             FROM marks m
             JOIN subjects sub ON m.subject_id = sub.id
             JOIN exam_types et ON m.exam_type_id = et.id
             WHERE m.student_id = $1
             ORDER BY et.name, sub.name`,
            [student.id]
        );

        // Fetch components
        const marksWithComponents = await Promise.all(marksResult.rows.map(async (mark) => {
            const componentsResult = await pool.query(
                `SELECT mc.*, ec.component_name 
                 FROM mark_components mc
                 JOIN exam_components ec ON mc.component_id = ec.id
                 WHERE mc.mark_id = $1`,
                [mark.id]
            );
            return {
                ...mark,
                components: componentsResult.rows || []
            };
        }));

        res.json(marksWithComponents);
    } catch (error) {
        console.error('Error fetching my marks:', error);
        res.status(500).json({ message: 'Server error fetching your marks' });
    }
};

exports.saveMarks = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { marks, year } = req.body;

        if (!marks || !Array.isArray(marks) || marks.length === 0) {
            return res.status(400).json({ message: 'Marks data is required' });
        }

        console.log(`[Marks Save] Received ${marks.length} marks to save for school ${school_id}`);

        const targetYear = year || new Date().getFullYear();

        await client.query('BEGIN');

        let savedCount = 0;
        let failedCount = 0;
        const failedMarks = [];

        for (let i = 0; i < marks.length; i++) {
            const mark = marks[i];
            const rowYear = mark.year || targetYear;

            // Allow section_id to be NULL or 0 if not provided
            const sectionVal = mark.section_id || null;

            console.log(`[Marks Save] Processing mark ${i + 1}/${marks.length}: student_id=${mark.student_id}, subject_id=${mark.subject_id}, marks=${mark.marks_obtained}`);

            try {
                if (mark.component_id) {
                    // Component-based mark

                    const mainMarkResult = await client.query(
                        `INSERT INTO marks 
                         (school_id, student_id, class_id, section_id, subject_id, exam_type_id, marks_obtained, year, updated_at)
                         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, CURRENT_TIMESTAMP)
                         ON CONFLICT (school_id, student_id, subject_id, exam_type_id, year)
                         DO UPDATE SET marks_obtained = marks.marks_obtained, updated_at = CURRENT_TIMESTAMP
                         RETURNING id`,
                        [school_id, mark.student_id, mark.class_id, sectionVal,
                            mark.subject_id, mark.exam_type_id, rowYear]
                    );

                    const markId = mainMarkResult.rows[0].id;

                    await client.query(
                        `INSERT INTO mark_components (mark_id, component_id, marks_obtained)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (mark_id, component_id)
                         DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained`,
                        [markId, mark.component_id, mark.marks_obtained]
                    );

                    const totalResult = await client.query(
                        `SELECT COALESCE(SUM(marks_obtained), 0) as total 
                         FROM mark_components 
                         WHERE mark_id = $1`,
                        [markId]
                    );

                    await client.query(
                        `UPDATE marks SET marks_obtained = $1 WHERE id = $2`,
                        [totalResult.rows[0].total, markId]
                    );
                    savedCount++;
                    console.log(`[Marks Save] ✅ Saved mark ${i + 1}: student_id=${mark.student_id}, subject_id=${mark.subject_id}`);
                } else {
                    // Simple mark OR JSON-based Component Mark
                    await client.query(
                        `INSERT INTO marks 
                         (school_id, student_id, class_id, section_id, subject_id, exam_type_id, marks_obtained, remarks, year, component_scores, updated_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
                         ON CONFLICT (school_id, student_id, subject_id, exam_type_id, year)
                         DO UPDATE SET 
                            marks_obtained = EXCLUDED.marks_obtained,
                            remarks = EXCLUDED.remarks,
                            component_scores = EXCLUDED.component_scores,
                            updated_at = CURRENT_TIMESTAMP`,
                        [school_id, mark.student_id, mark.class_id, sectionVal,
                            mark.subject_id, mark.exam_type_id, mark.marks_obtained, mark.remarks || null, rowYear, mark.component_scores || {}]
                    );
                    savedCount++;
                    console.log(`[Marks Save] ✅ Saved mark ${i + 1}: student_id=${mark.student_id}, subject_id=${mark.subject_id}`);
                }
            } catch (markError) {
                failedCount++;
                failedMarks.push({
                    student_id: mark.student_id,
                    subject_id: mark.subject_id,
                    error: markError.message
                });
                console.error(`[Marks Save] ❌ FAILED mark ${i + 1}: student_id=${mark.student_id}, subject_id=${mark.subject_id}`);
                console.error(`[Marks Save] Error:`, markError.message);
                console.error(`[Marks Save] Error detail:`, markError.detail);
                console.error(`[Marks Save] Error constraint:`, markError.constraint);
            }
        }

        await client.query('COMMIT');

        console.log(`[Marks Save] Successfully saved ${savedCount} marks`);
        if (failedCount > 0) {
            console.log(`[Marks Save] Failed to save ${failedCount} marks:`, failedMarks);
        }

        // Notification Logic (wrapped in try-catch to prevent failures from affecting save)
        try {
            const { sendPushNotification } = require('../services/notificationService');
            const uniqueStudentIds = [...new Set(marks.map(m => m.student_id))];
            for (const studentId of uniqueStudentIds) {
                await sendPushNotification(studentId, 'Exam Results', 'New marks have been updated in your report card.');
            }
        } catch (notifyError) {
            console.error('[Marks Save] Notification error (non-critical):', notifyError.message);
        }

        const response = {
            message: `Marks saved: ${savedCount} successful${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
            count: savedCount,
            savedCount,
            failedCount
        };

        if (failedCount > 0) {
            response.failedMarks = failedMarks;
        }

        res.json(response);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving marks:', error);
        res.status(500).json({ message: 'Server error saving marks', error: error.message });
    } finally {
        client.release();
    }
};

exports.getStudentMarksheet = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { student_id, exam_type_id } = req.query;

        if (!student_id || !exam_type_id) {
            return res.status(400).json({ message: 'Student ID and Exam Type are required' });
        }

        // Get student info
        const studentRes = await pool.query(
            `SELECT st.*, c.name as class_name, sec.name as section_name
             FROM students st
             JOIN classes c ON st.class_id = c.id
             LEFT JOIN sections sec ON st.section_id = sec.id
             WHERE st.id = $1 AND st.school_id = $2`,
            [student_id, school_id]
        );

        if (studentRes.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const student = studentRes.rows[0];

        // Get Marks
        // Get Marks
        let marksQuery = `SELECT m.*, 
                    sub.name as subject_name,
                    et.name as exam_name,
                    et.max_marks
             FROM marks m
             JOIN subjects sub ON m.subject_id = sub.id
             JOIN exam_types et ON m.exam_type_id = et.id
             WHERE m.student_id = $1 AND m.exam_type_id = $2`;

        const marksParams = [student_id, exam_type_id];

        if (req.query.year) {
            marksParams.push(req.query.year);
            marksQuery += ` AND m.year = $${marksParams.length}`;
        }

        marksQuery += ` ORDER BY sub.name`;

        const marksResult = await pool.query(marksQuery, marksParams);

        // Fetch components for these marks
        const marksWithComponents = await Promise.all(marksResult.rows.map(async (mark) => {
            const componentsResult = await pool.query(
                `SELECT mc.*, ec.component_name, ec.max_marks as component_max_marks
                 FROM mark_components mc
                 JOIN exam_components ec ON mc.component_id = ec.id
                 WHERE mc.mark_id = $1
                 ORDER BY ec.display_order`,
                [mark.id]
            );
            return {
                ...mark,
                components: componentsResult.rows || []
            };
        }));

        const totalMarks = marksWithComponents.reduce((sum, m) => sum + parseFloat(m.marks_obtained || 0), 0);
        const maxMarks = marksWithComponents.reduce((sum, m) => sum + parseFloat(m.max_marks || 0), 0);
        const percentage = maxMarks > 0 ? ((totalMarks / maxMarks) * 100).toFixed(2) : 0;

        const marksheet = {
            student,
            marks: marksWithComponents,
            summary: {
                total_marks: totalMarks,
                max_marks: maxMarks,
                percentage
            }
        };

        res.json(marksheet);
    } catch (error) {
        console.error('Error fetching student marksheet:', error);
        res.status(500).json({ message: 'Server error fetching marksheet' });
    }
};

exports.getStudentResultYears = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { student_id } = req.query;

        if (!student_id) {
            return res.status(400).json({ message: 'Student ID is required' });
        }

        const result = await pool.query(
            `SELECT DISTINCT year FROM marks WHERE student_id = $1 AND school_id = $2 ORDER BY year DESC`,
            [student_id, school_id]
        );

        res.json(result.rows.map(row => row.year));
    } catch (error) {
        console.error('Error fetching student years:', error);
        res.status(500).json({ message: 'Server error fetching years' });
    }
};

exports.getAllMarksheets = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id, section_id, exam_type_id } = req.query;

        if (!class_id || !exam_type_id) {
            return res.status(400).json({ message: 'Class and Exam Type are required' });
        }

        // Get all students in this class/section
        // Adjust query to support optional section
        let studentsQuery = `SELECT st.*, c.name as class_name, sec.name as section_name
             FROM students st
             JOIN classes c ON st.class_id = c.id
             LEFT JOIN sections sec ON st.section_id = sec.id
             WHERE st.class_id = $1 AND st.school_id = $2 AND (st.status IS NULL OR st.status != 'Deleted')`;

        const params = [class_id, school_id];

        if (section_id) {
            params.push(section_id);
            studentsQuery += ` AND st.section_id = $${params.length}`;
        }

        studentsQuery += ` ORDER BY st.roll_number`;

        const studentsResult = await pool.query(studentsQuery, params);

        const marksheets = [];

        for (const student of studentsResult.rows) {
            const marksResult = await pool.query(
                `SELECT m.*, 
                        sub.name as subject_name,
                        et.name as exam_name,
                        et.max_marks
                 FROM marks m
                 JOIN subjects sub ON m.subject_id = sub.id
                 JOIN exam_types et ON m.exam_type_id = et.id
                 WHERE m.student_id = $1 AND m.exam_type_id = $2 AND m.school_id = $3
                 ORDER BY sub.name`,
                [student.id, exam_type_id, school_id]
            );

            const totalMarks = marksResult.rows.reduce((sum, m) => sum + parseFloat(m.marks_obtained || 0), 0);
            const maxMarks = marksResult.rows.reduce((sum, m) => sum + parseFloat(m.max_marks || 0), 0);
            const percentage = maxMarks > 0 ? ((totalMarks / maxMarks) * 100).toFixed(2) : 0;

            marksheets.push({
                student,
                marks: marksResult.rows,
                summary: {
                    total_marks: totalMarks,
                    max_marks: maxMarks,
                    percentage
                }
            });
        }

        res.json(marksheets);
    } catch (error) {
        console.error('Error fetching all marksheets:', error);
        res.status(500).json({ message: 'Server error fetching marksheets' });
    }
};

// Get Toppers List for a Class/Section/Exam
exports.getToppers = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_name, section, exam_type, schedule_id, class_id, section_id, exam_type_id } = req.query;

        if ((!class_name && !class_id) || (!exam_type && !exam_type_id) || !schedule_id) {
            return res.status(400).json({ message: 'Class, Exam Type, and Schedule ID are required' });
        }

        let finalClassId = class_id;
        // Get class_id from class_name if ID not provided
        if (!finalClassId) {
            const classResult = await pool.query(
                `SELECT id FROM classes WHERE name = $1 AND school_id = $2`,
                [class_name, school_id]
            );
            if (classResult.rows.length === 0) {
                return res.status(404).json({ message: 'Class not found' });
            }
            finalClassId = classResult.rows[0].id;
        }

        // Get section_id
        let finalSectionId = null;
        if (section_id) {
            finalSectionId = section_id;
        } else if (section) {
            const sectionResult = await pool.query(
                `SELECT id FROM sections WHERE name = $1 AND class_id = $2 AND school_id = $3`,
                [section, finalClassId, school_id]
            );
            if (sectionResult.rows.length > 0) {
                finalSectionId = sectionResult.rows[0].id;
            }
        }

        // Get exam_type_id
        let finalExamTypeId = exam_type_id;
        if (!finalExamTypeId) {
            const examTypeResult = await pool.query(
                `SELECT id FROM exam_types WHERE name = $1 AND school_id = $2`,
                [exam_type, school_id]
            );

            if (examTypeResult.rows.length === 0) {
                return res.status(404).json({ message: 'Exam type not found' });
            }
            finalExamTypeId = examTypeResult.rows[0].id;
        }

        // Get all students in the class/section
        let studentsQuery = `
            SELECT st.id, st.name, st.admission_no, st.roll_number, st.father_name, sec.name as section
            FROM students st
            LEFT JOIN sections sec ON st.section_id = sec.id
            WHERE st.class_id = $1 AND st.school_id = $2 AND (st.status IS NULL OR st.status != 'Deleted')
        `;
        const studentsParams = [finalClassId, school_id];

        if (finalSectionId) {
            studentsParams.push(finalSectionId);
            studentsQuery += ` AND st.section_id = $${studentsParams.length}`;
        }

        studentsQuery += ` ORDER BY st.roll_number`;

        const studentsResult = await pool.query(studentsQuery, studentsParams);

        if (studentsResult.rows.length === 0) {
            return res.json({ toppers: [], subjects: [] });
        }

        // Get all subjects for this class
        const subjectsResult = await pool.query(
            `SELECT DISTINCT sub.name 
             FROM marks m
             JOIN subjects sub ON m.subject_id = sub.id
             WHERE m.class_id = $1 AND m.exam_type_id = $2 AND m.school_id = $3
             ORDER BY sub.name`,
            [finalClassId, finalExamTypeId, school_id]
        );

        const subjects = subjectsResult.rows.map(row => row.name);

        // Calculate marks for each student
        const studentsWithMarks = [];

        for (const student of studentsResult.rows) {
            // Get marks for this student with max_marks from exam_schedules
            const marksResult = await pool.query(
                `SELECT DISTINCT ON (m.id)
                        m.marks_obtained, sub.name as subject_name, 
                        COALESCE(es.max_marks, et.max_marks, 100) as max_marks
                 FROM marks m
                 JOIN subjects sub ON m.subject_id = sub.id
                 LEFT JOIN exam_schedules es ON es.subject_id = m.subject_id 
                    AND es.exam_type_id = m.exam_type_id 
                    AND es.class_id = m.class_id 
                    AND es.school_id = m.school_id
                    AND (es.section_id = m.section_id OR es.section_id IS NULL)
                 LEFT JOIN exam_types et ON et.id = m.exam_type_id
                 WHERE m.student_id = $1 AND m.exam_type_id = $2 AND m.school_id = $3
                 ORDER BY m.id`,
                [student.id, finalExamTypeId, school_id]
            );

            if (marksResult.rows.length === 0) {
                continue; // Skip students with no marks
            }

            // Create marks object with subject-wise marks
            const marks = {};
            let totalMarks = 0;
            let totalMaxMarks = 0;

            marksResult.rows.forEach(mark => {
                marks[mark.subject_name] = parseFloat(mark.marks_obtained || 0);
                totalMarks += parseFloat(mark.marks_obtained || 0);
                totalMaxMarks += parseFloat(mark.max_marks || 100); // Use actual max_marks from schedule
            });

            const percentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;

            studentsWithMarks.push({
                student_id: student.id,
                student_name: student.name,
                father_name: student.father_name,
                admission_number: student.admission_no,
                roll_number: student.roll_number,
                section: student.section,
                marks: marks,
                total_marks: totalMarks,
                total_max_marks: totalMaxMarks,
                percentage: percentage
            });
        }

        // Sort by percentage (descending)
        studentsWithMarks.sort((a, b) => b.percentage - a.percentage);

        // Assign ranks
        studentsWithMarks.forEach((student, index) => {
            student.rank = index + 1;
        });

        res.json({
            toppers: studentsWithMarks,
            subjects: subjects
        });

    } catch (error) {
        console.error('Error fetching toppers:', error);
        res.status(500).json({ message: 'Server error fetching toppers', error: error.message });
    }
};

// Get All Marks for a Student (Overall History)
exports.getStudentAllMarks = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { admission_no } = req.query;

        console.log('[Get Student All Marks] Searching for:', admission_no);

        if (!admission_no) {
            return res.status(400).json({ message: 'Admission Number is required' });
        }

        // First, try to find active student
        const studentRes = await pool.query(
            `SELECT * FROM students 
             WHERE admission_no ILIKE $1 AND school_id = $2 AND (status IS NULL OR status != 'Deleted')`,
            [admission_no.trim(), school_id]
        );

        if (studentRes.rows.length > 0) {
            // Active student found - fetch their marks
            const student = studentRes.rows[0];

            // Fetch ALL Marks with actual max_marks from exam_schedules
            const marksQuery = `
                 SELECT DISTINCT ON (m.id) 
                        m.marks_obtained, sub.name as subject_name, et.name as exam_name, 
                        m.exam_type_id,
                        COALESCE(es.max_marks, et.max_marks, 100) as max_marks
                 FROM marks m
                 JOIN subjects sub ON m.subject_id = sub.id
                 JOIN exam_types et ON m.exam_type_id = et.id
                 LEFT JOIN exam_schedules es ON es.subject_id = m.subject_id 
                    AND es.exam_type_id = m.exam_type_id 
                    AND es.school_id = m.school_id
                    AND (es.class_id = m.class_id OR es.class_id IS NULL)
                    AND (es.section_id = m.section_id OR es.section_id IS NULL)
                 WHERE m.student_id = $1 AND m.school_id = $2
                 ORDER BY m.id, et.id, sub.name
            `;

            const marksRes = await pool.query(marksQuery, [student.id, school_id]);

            // Group by Exam
            const examsMap = {};

            marksRes.rows.forEach(mark => {
                const examName = mark.exam_name;
                if (!examsMap[examName]) {
                    examsMap[examName] = {
                        id: mark.exam_type_id,
                        exam_name: examName,
                        total_obtained: 0,
                        total_max: 0,
                        subjects: []
                    };
                }

                const obtained = parseFloat(mark.marks_obtained || 0);
                const max = parseFloat(mark.max_marks || 100);

                examsMap[examName].subjects.push({
                    subject: mark.subject_name,
                    subject_code: mark.subject_code || null,
                    marks: obtained,
                    max: max
                });

                examsMap[examName].total_obtained += obtained;
                examsMap[examName].total_max += max;
            });

            // Calculate Percentages
            const exams = Object.values(examsMap).map(exam => ({
                ...exam,
                percentage: exam.total_max > 0 ? ((exam.total_obtained / exam.total_max) * 100).toFixed(2) : 0
            }));

            return res.json({
                student: {
                    name: student.name,
                    admission_no: student.admission_no,
                    roll_number: student.roll_number,
                    class_id: student.class_id,
                    father_name: student.father_name,
                    mother_name: student.mother_name,
                    sats_number: student.sats_number,
                    status: 'Active'
                },
                exams: exams
            });
        }

        // Active student not found - search in deleted students' marks
        console.log('[Get Student All Marks] Active student not found, searching deleted records...');

        const deletedMarksQuery = `
            SELECT DISTINCT ON (m.id)
                   m.marks_obtained, 
                   sub.name as subject_name, 
                   et.name as exam_name,
                   m.exam_type_id,
                   COALESCE(es.max_marks, et.max_marks, 100) as max_marks,
                   m.deleted_student_name,
                   m.deleted_student_admission_no
            FROM marks m
            JOIN subjects sub ON m.subject_id = sub.id
            JOIN exam_types et ON m.exam_type_id = et.id
            LEFT JOIN exam_schedules es ON es.subject_id = m.subject_id 
               AND es.exam_type_id = m.exam_type_id 
               AND es.school_id = m.school_id
            WHERE m.school_id = $1 
              AND m.student_id IS NULL 
              AND m.deleted_student_admission_no ILIKE $2
            ORDER BY m.id, et.id, sub.name
        `;

        const deletedMarksRes = await pool.query(deletedMarksQuery, [school_id, admission_no.trim()]);

        if (deletedMarksRes.rows.length === 0) {
            return res.status(404).json({
                message: `No records found for admission number: ${admission_no}`,
                note: 'Student may not exist or may have been deleted without any marks recorded'
            });
        }

        // Deleted student marks found
        const deletedStudentInfo = {
            name: deletedMarksRes.rows[0].deleted_student_name,
            admission_no: deletedMarksRes.rows[0].deleted_student_admission_no,
            status: 'Deleted'
        };

        // Group by Exam
        const examsMap = {};

        deletedMarksRes.rows.forEach(mark => {
            const examName = mark.exam_name;
            if (!examsMap[examName]) {
                examsMap[examName] = {
                    id: mark.exam_type_id,
                    exam_name: examName,
                    total_obtained: 0,
                    total_max: 0,
                    subjects: []
                };
            }

            const obtained = parseFloat(mark.marks_obtained || 0);
            const max = parseFloat(mark.max_marks || 100);

            examsMap[examName].subjects.push({
                subject: mark.subject_name,
                marks: obtained,
                max: max
            });

            examsMap[examName].total_obtained += obtained;
            examsMap[examName].total_max += max;
        });

        // Calculate Percentages
        const exams = Object.values(examsMap).map(exam => ({
            ...exam,
            percentage: exam.total_max > 0 ? ((exam.total_obtained / exam.total_max) * 100).toFixed(2) : 0
        }));

        res.json({
            student: deletedStudentInfo,
            exams: exams,
            note: 'This student has been permanently deleted. Showing preserved academic records.'
        });

    } catch (error) {
        console.error('Error fetching student all marks:', error);
        res.status(500).json({ message: 'Server error fetching result', error: error.message });
    }
};

exports.generateWordMarksheet = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { templateId } = req.params;
        const { admission_no, selected_exam_id, year: selectedYear } = req.query;

        if (!admission_no) {
            return res.status(400).json({ message: 'Admission number is required' });
        }

        // 1. Fetch Template
        const templateRes = await pool.query(
            `SELECT file_path, name FROM marksheet_custom_templates WHERE id = $1 AND school_id = $2`,
            [templateId, school_id]
        );

        if (templateRes.rows.length === 0) {
            return res.status(404).json({ message: 'Template not found' });
        }

        const templateDataUri = templateRes.rows[0].file_path;
        if (!templateDataUri.startsWith('data:')) {
            return res.status(500).json({ message: 'Invalid template format in database' });
        }

        const base64Data = templateDataUri.split(',')[1];
        const templateBuffer = Buffer.from(base64Data, 'base64');

        console.log(`📡 [WORD GEN] Generating for: ${admission_no} | Exam ID: ${selected_exam_id}`);

        // Run migration check once to prevent crash
        await ensureSatsColumn();

        // 2. Fetch Student Information (Including Parent Details & SATS)
        const studentInfoResult = await pool.query(`
            SELECT st.id, st.name as student_name, st.admission_no, st.roll_number, st.status,
                   st.father_name, st.mother_name, st.sats_number,
                   c.name as class_name, sec.name as section_name, st.class_id
            FROM students st
            JOIN classes c ON st.class_id = c.id
            LEFT JOIN sections sec ON st.section_id = sec.id
            WHERE st.school_id = $1 AND st.admission_no = $2
        `, [school_id, admission_no]);

        if (studentInfoResult.rows.length === 0) {
            console.log(`❌ [WORD GEN] Student NOT FOUND: ${admission_no}`);
            return res.status(404).json({ message: 'Student not found' });
        }

        const student = studentInfoResult.rows[0];
        console.log(`✅ [WORD GEN] Found Student: ${student.student_name} (ID: ${student.id})`);

        // 3. Fetch Marks based on Exam Schedule (to ensure only scheduled subjects appear)
        // (selected_exam_id destructured at top)

        // If no exam is selected, we fallback to pulling all marks (legacy behavior)
        let marksQuery = "";
        let params = [];

        if (selected_exam_id) {
            console.log(`🔍 [WORD GEN] Selecting marks for exam ${selected_exam_id}...`);
            
            // Define params consistently
            params = [school_id, student.id, selected_exam_id]; // $1, $2, $3
            
            let yearClause;
            if (selectedYear) {
                params.push(selectedYear); // $4
                yearClause = `$4`;
            } else {
                yearClause = `(SELECT MAX(m2.year) FROM marks m2 WHERE m2.student_id = $2 AND m2.exam_type_id = $3 AND m2.school_id = $1)`;
            }

            marksQuery = `
                SELECT 
                    m.marks_obtained, 
                    m.year, m.component_scores,
                    COALESCE(es.max_marks, et.max_marks, 100) as max_marks,
                    sub.name as subject_name, sub.code as subject_code,
                    et.name as exam_type_name, et.id as exam_type_id,
                    m.id as mark_id
                FROM marks m
                JOIN exam_types et ON m.exam_type_id = et.id
                JOIN subjects sub ON m.subject_id = sub.id
                JOIN exam_schedules es ON m.subject_id = es.subject_id 
                      AND m.exam_type_id = es.exam_type_id 
                      AND es.school_id = m.school_id
                      AND (es.class_id = m.class_id OR es.class_id IS NULL)
                WHERE m.school_id = $1 
                  AND m.student_id = $2
                  AND m.exam_type_id = $3
                  AND m.year = ${yearClause}
                ORDER BY sub.name
            `;
        } else {
            // Legacy fallback if no specific exam selected: Pull all available marks for student
            marksQuery = `
                SELECT m.marks_obtained, m.year, m.component_scores,
                       COALESCE(es.max_marks, et.max_marks, 100) as max_marks,
                       sub.name as subject_name, sub.code as subject_code,
                       et.name as exam_type_name, et.id as exam_type_id
                FROM marks m
                JOIN exam_types et ON m.exam_type_id = et.id
                JOIN subjects sub ON m.subject_id = sub.id
                LEFT JOIN exam_schedules es ON m.exam_type_id = es.exam_type_id 
                      AND m.class_id = es.class_id 
                      AND m.subject_id = es.subject_id 
                      AND (m.section_id = es.section_id OR es.section_id IS NULL)
                WHERE m.school_id = $1 AND m.student_id = $2
            `;
            params = [school_id, student.student_id];
            if (selectedYear) {
                marksQuery += ` AND m.year = $3`;
                params.push(selectedYear);
            }
            marksQuery += ` ORDER BY et.name, sub.name`;
        }

        let marksResult;
        try {
            marksResult = await pool.query(marksQuery, params);
        } catch (queryError) {
            console.error('❌ [WORD GEN ERROR] Database Query Failed:', queryError);
            console.error('Query:', marksQuery);
            console.error('Params:', params);
            throw queryError;
        }

        // 4. Transform Data for Docxtemplater
        const examsMap = {};
        marksResult.rows.forEach(mark => {
            const examName = mark.exam_type_name;
            if (!examsMap[examName]) {
                examsMap[examName] = {
                    id: mark.exam_type_id,
                    exam_name: examName,
                    year: mark.year,
                    subjects: [],
                    total_obtained: 0,
                    total_max: 0
                };
            }

            const obtained = parseFloat(mark.marks_obtained || 0);
            const max = parseFloat(mark.max_marks || 100);

            let pass_status = "Pass";
            if (obtained < (max * 0.35)) {
                pass_status = "Fail";
            }

            const subjectObj = {
                subject_name: mark.subject_name,
                subject_code: mark.subject_code || '',
                marks_obtained: obtained,
                marks_words: convertToDigitWords(obtained),
                max_marks: max,
                status: pass_status,
                ...mark.component_scores // Flat mapping theory, internal, practical etc.
            };

            // Normalize component keys to title case for common use in templates
            if (mark.component_scores) {
                Object.keys(mark.component_scores).forEach(key => {
                    const normalizedKey = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
                    subjectObj[normalizedKey] = mark.component_scores[key];
                });
            }

            examsMap[examName].subjects.push(subjectObj);

            examsMap[examName].total_obtained += obtained;
            examsMap[examName].total_max += max;
        });

        const examsList = Object.values(examsMap).map(exam => ({
            ...exam,
            percentage: exam.total_max > 0 ? ((exam.total_obtained / exam.total_max) * 100).toFixed(2) : "0.00"
        }));

        // Build Payload
        // If a specific exam was selected, prioritize it for flat fields (all_subjects, total etc)
        const selectedExam = selected_exam_id
            ? examsList.find(e => e.id == selected_exam_id)
            : (examsList.length > 0 ? examsList[0] : null);

        const today = new Date();
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        const templatePayload = {
            student_name: student.student_name,
            admission_no: student.admission_no,
            roll_number: student.roll_number || '-',
            father_name: student.father_name || '-',
            mother_name: student.mother_name || '-',
            sats_number: student.sats_number || '-',
            class_name: student.class_name || '-',
            section_name: student.section_name || '-',
            exams: examsList,
            // Meta
            exam_year: selectedYear || today.getFullYear(),
            exam_month: selectedYear ? "" : months[today.getMonth()], // If historical year is picked, month is ambiguous
            result_date: today.toLocaleDateString('en-GB'), // DD/MM/YYYY
            result_month: months[today.getMonth()],
            
            // Provide a flat list of subjects for the selected/primary exam
            all_subjects: selectedExam ? selectedExam.subjects : [],
            total_obtained: selectedExam ? selectedExam.total_obtained : 0,
            total_max: selectedExam ? selectedExam.total_max : 0,
            percentage: selectedExam ? selectedExam.percentage : "0.00",
            exam_name: selectedExam ? selectedExam.exam_name : ''
        };

        // Flat mapping subjects to the main payload (e.g., {{Mathematics}}: 58)
        if (selectedExam) {
            selectedExam.subjects.forEach(sub => {
                const rawName = sub.subject_name;
                const safeName = rawName.replace(/\s+/g, '_'); // e.g. "Social Science" -> "Social_Science"
                
                // Add various iterations for template compatibility
                templatePayload[rawName] = sub.marks_obtained;
                templatePayload[safeName] = sub.marks_obtained;
                templatePayload[rawName.toUpperCase()] = sub.marks_obtained;
                templatePayload[rawName.toLowerCase()] = sub.marks_obtained;
                
                // Add "In Words" for each subject
                templatePayload[`${safeName}_words`] = convertToDigitWords(sub.marks_obtained);
                templatePayload[`${rawName}_words`] = convertToDigitWords(sub.marks_obtained);
            });
            
            // Global words
            templatePayload.total_obtained_words = convertToDigitWords(selectedExam.total_obtained);
            templatePayload.percentage_words = convertToDigitWords(Math.round(selectedExam.percentage));
        } else {
            templatePayload.total_obtained_words = "-";
            templatePayload.percentage_words = "-";
        }

        // 5. Generate Word Document
        const zip = new PizZip(templateBuffer);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        doc.render(templatePayload);

        const generatedBuffer = doc.getZip().generate({ type: 'nodebuffer' });

        // 6. Send Response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Marksheet_${student.admission_no}.docx"`);
        res.send(generatedBuffer);

    } catch (error) {
        console.error('Error generating Word template:', error);
        res.status(500).json({ message: 'Failed to generate Word template' });
    }
};


