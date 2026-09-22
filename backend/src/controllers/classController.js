const { pool } = require('../config/db');

exports.getAllClasses = async (req, res) => {
    try {
        let school_id = req.user.schoolId;

        // Allow Super Admin to fetch classes for a specific school
        if (req.user.role === 'SUPER_ADMIN' && req.query.schoolId) {
            school_id = req.query.schoolId;
        }

        let result;
        if (req.user.role === 'SUPER_ADMIN' && !school_id) {
            // Super Admin seeing all classes across all schools
            result = await pool.query(
                `SELECT c.*, s.name as school_name 
                 FROM classes c 
                 JOIN schools s ON c.school_id = s.id 
                 ORDER BY s.name, c.name`
            );
        } else {
            // Standard fetch for specific school
            result = await pool.query(
                'SELECT * FROM classes WHERE school_id = $1 ORDER BY name',
                [school_id]
            );
        }

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createClass = async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Access denied: Only Super Admin can create classes.' });
        }
        const { name, schoolId } = req.body;

        let school_id = req.user.schoolId;

        // Allow Super Admin to create class for a specific school
        if (req.user.role === 'SUPER_ADMIN' && schoolId) {
            school_id = schoolId;
        }

        if (!name) {
            return res.status(400).json({ message: 'Class name is required' });
        }

        const result = await pool.query(
            'INSERT INTO classes (school_id, name) VALUES ($1, $2) RETURNING *',
            [school_id, name]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Class name already exists' });
        }
        res.status(500).json({ message: 'Failed to create class' });
    }
};

exports.updateClass = async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Access denied: Only Super Admin can update classes.' });
        }
        const { id } = req.params;
        const { name } = req.body;

        // We don't strictly need school_id for update if we trust the ID, 
        // but verifying ownership is good.
        let school_id = req.user.schoolId;

        let query = 'UPDATE classes SET name = $1 WHERE id = $2 AND school_id = $3 RETURNING *';
        let params = [name, id, school_id];

        // Super Admin can update any class (bypass school check or check specific school)
        if (req.user.role === 'SUPER_ADMIN') {
            query = 'UPDATE classes SET name = $1 WHERE id = $2 RETURNING *';
            params = [name, id];
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Class not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Class name already exists' });
        }
        res.status(500).json({ message: 'Failed to update class' });
    }
};

exports.deleteClass = async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Access denied: Only Super Admin can delete classes.' });
        }
        const { id } = req.params;

        let school_id = req.user.schoolId;

        let query = 'DELETE FROM classes WHERE id = $1 AND school_id = $2 RETURNING *';
        let params = [id, school_id];

        if (req.user.role === 'SUPER_ADMIN') {
            query = 'DELETE FROM classes WHERE id = $1 RETURNING *';
            params = [id];
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Class not found' });
        }

        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        console.error(error);
        if (error.code === '23503') {
            return res.status(400).json({ message: 'Cannot delete class with existing students/sections' });
        }
        res.status(500).json({ message: 'Failed to delete class' });
    }
};

exports.getSections = async (req, res) => {
    try {
        const { classId } = req.params;
        const result = await pool.query(
            'SELECT * FROM sections WHERE class_id = $1 ORDER BY name',
            [classId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createSection = async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Access denied: Only Super Admin can create sections.' });
        }
        const { classId } = req.params;
        const { name } = req.body;

        // Security check: ensure class belongs to school (if strict)
        // For now relying on simple logic

        const result = await pool.query(
            'INSERT INTO sections (class_id, name) VALUES ($1, $2) RETURNING *',
            [classId, name]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Section name already exists in this class' });
        }
        res.status(500).json({ message: 'Failed to create section' });
    }
};

exports.deleteSection = async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Access denied: Only Super Admin can delete sections.' });
        }
        const { classId, sectionId } = req.params;
        const result = await pool.query(
            'DELETE FROM sections WHERE id = $1 AND class_id = $2 RETURNING *',
            [sectionId, classId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Section not found' });
        }
        res.json({ message: 'Section deleted' });

    } catch (error) {
        console.error(error);
        if (error.code === '23503') {
            return res.status(400).json({ message: 'Cannot delete section with existing students' });
        }
        res.status(500).json({ message: 'Failed to delete section' });
    }
};

exports.getSubjects = async (req, res) => {
    try {
        const { classId } = req.params;

        // Subjects are associated with Classes
        const result = await pool.query(
            'SELECT * FROM subjects WHERE class_id = $1 ORDER BY id',
            [classId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Fetch summary of all distinct subjects in a school with class count and marks count
exports.getSchoolSubjectsSummary = async (req, res) => {
    try {
        let schoolId = req.query.schoolId || req.params.schoolId || req.headers['x-school-id'] || req.user.schoolId;
        if (req.user.role !== 'SUPER_ADMIN' && req.user.schoolId) {
            schoolId = req.user.schoolId;
        }

        const targetSchoolId = parseInt(schoolId, 10);
        if (!targetSchoolId || isNaN(targetSchoolId)) {
            return res.status(400).json({ message: 'Valid school ID is required to fetch subject summary.' });
        }

        const query = `
            SELECT 
                s.name,
                COUNT(DISTINCT s.id)::int as subject_count,
                COUNT(DISTINCT s.class_id)::int as class_count,
                jsonb_agg(DISTINCT jsonb_build_object(
                    'id', s.id, 
                    'class_id', c.id, 
                    'class_name', c.name
                )) as class_details,
                COUNT(DISTINCT m.id)::int as marks_count
            FROM subjects s
            JOIN classes c ON s.class_id = c.id
            LEFT JOIN marks m ON m.subject_id = s.id
            WHERE c.school_id = $1 AND s.name IS NOT NULL AND TRIM(s.name) != ''
            GROUP BY s.name
            ORDER BY s.name ASC
        `;

        const result = await pool.query(query, [targetSchoolId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching subjects summary:', error);
        res.status(500).json({ message: 'Server error fetching subjects summary' });
    }
};

// Universal Subject Rename: Renames a subject across one or all classes in a school without affecting marks
exports.renameSubject = async (req, res) => {
    const client = await pool.connect();
    try {
        if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'SCHOOL_ADMIN') {
            return res.status(403).json({ message: 'Access denied: Only Super Admin and School Admin can rename subjects.' });
        }

        const { schoolId, oldName, newName, classId, classIds } = req.body;

        if (!oldName || !oldName.trim()) {
            return res.status(400).json({ message: 'Current subject name (oldName) is required.' });
        }
        if (!newName || !newName.trim()) {
            return res.status(400).json({ message: 'New subject name (newName) is required.' });
        }

        const trimmedOld = oldName.trim();
        const trimmedNew = newName.trim();

        if (trimmedOld.toLowerCase() === trimmedNew.toLowerCase()) {
            return res.status(400).json({ message: 'The new subject name must be different from the current name.' });
        }

        let effectiveSchoolId = req.user.schoolId;
        if (req.user.role === 'SUPER_ADMIN') {
            effectiveSchoolId = schoolId || req.query.schoolId || req.body.school_id;
        }

        await client.query('BEGIN');

        // Build class filter
        let targetClassIds = [];
        if (classId) {
            targetClassIds = [parseInt(classId)];
        } else if (Array.isArray(classIds) && classIds.length > 0) {
            targetClassIds = classIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        }

        // Find all matching subjects
        let findQuery = `
            SELECT s.id, s.class_id, s.name, c.name as class_name, c.school_id
            FROM subjects s
            JOIN classes c ON s.class_id = c.id
            WHERE LOWER(TRIM(s.name)) = LOWER(TRIM($1))
        `;
        const params = [trimmedOld];

        if (effectiveSchoolId) {
            params.push(effectiveSchoolId);
            findQuery += ` AND c.school_id = $${params.length}`;
        }

        if (targetClassIds.length > 0) {
            params.push(targetClassIds);
            findQuery += ` AND s.class_id = ANY($${params.length}::int[])`;
        }

        const matchingRes = await client.query(findQuery, params);
        const matchingSubjects = matchingRes.rows;

        if (matchingSubjects.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: `No subjects found with name "${trimmedOld}".` });
        }

        // Check if any target class already has a subject with trimmedNew
        const targetClasses = matchingSubjects.map(s => s.class_id);
        const conflictRes = await client.query(`
            SELECT s.id, s.class_id, s.name, c.name as class_name
            FROM subjects s
            JOIN classes c ON s.class_id = c.id
            WHERE LOWER(TRIM(s.name)) = LOWER(TRIM($1))
              AND s.class_id = ANY($2::int[])
        `, [trimmedNew, targetClasses]);

        if (conflictRes.rows.length > 0) {
            await client.query('ROLLBACK');
            const conflictClasses = conflictRes.rows.map(r => r.class_name).join(', ');
            return res.status(409).json({ 
                message: `Cannot rename: A subject named "${trimmedNew}" already exists in: ${conflictClasses}.` 
            });
        }

        // Update subjects table
        const subjectIdsToUpdate = matchingSubjects.map(s => s.id);
        const updateRes = await client.query(`
            UPDATE subjects
            SET name = $1
            WHERE id = ANY($2::int[])
            RETURNING id, class_id, name
        `, [trimmedNew, subjectIdsToUpdate]);

        // Count how many marks records are preserved
        const marksCountRes = await client.query(`
            SELECT COUNT(*)::int as marks_count
            FROM marks
            WHERE subject_id = ANY($1::int[])
        `, [subjectIdsToUpdate]);
        const marksCount = parseInt(marksCountRes.rows[0]?.marks_count || 0);

        // Also update teachers table subject_specialization if applicable
        if (effectiveSchoolId) {
            await client.query(`
                UPDATE teachers
                SET subject_specialization = $1
                WHERE school_id = $2 AND LOWER(TRIM(subject_specialization)) = LOWER(TRIM($3))
            `, [trimmedNew, effectiveSchoolId, trimmedOld]);

            // Update exam_subjects table if it exists
            try {
                await client.query(`
                    UPDATE exam_subjects
                    SET name = $1
                    WHERE school_id = $2 AND LOWER(TRIM(name)) = LOWER(TRIM($3))
                `, [trimmedNew, effectiveSchoolId, trimmedOld]);
            } catch (e) {
                // Table might not exist or empty
            }
        }

        await client.query('COMMIT');

        const affectedClasses = [...new Set(matchingSubjects.map(s => s.class_name))];

        res.json({
            success: true,
            message: `Subject successfully renamed from "${trimmedOld}" to "${trimmedNew}" in ${updateRes.rowCount} class(es). All ${marksCount} marks records already entered remain completely safe and intact!`,
            renamedCount: updateRes.rowCount,
            marksPreserved: marksCount,
            classes: affectedClasses
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error renaming subject:', error);
        res.status(500).json({ message: 'Failed to rename subject', error: error.message });
    } finally {
        client.release();
    }
};

exports.createSubject = async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'SCHOOL_ADMIN') {
            return res.status(403).json({ message: 'Access denied: Only Super Admin and School Admin can create subjects.' });
        }
        const { classId } = req.params;
        const { name, code, type } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Subject name is required.' });
        }

        // Check duplicate within this class
        const dup = await pool.query(
            'SELECT id FROM subjects WHERE class_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))',
            [classId, name.trim()]
        );
        if (dup.rows.length > 0) {
            return res.status(409).json({ message: `Subject "${name.trim()}" already exists in this class.` });
        }

        const result = await pool.query(
            'INSERT INTO subjects (class_id, name, code, type) VALUES ($1, $2, $3, $4) RETURNING *',
            [classId, name.trim(), code || null, type || 'Theory']
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create subject' });
    }
};

exports.updateSubject = async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'SCHOOL_ADMIN') {
            return res.status(403).json({ message: 'Access denied: Only Super Admin and School Admin can update subjects.' });
        }
        const { classId, subjectId } = req.params;
        const { name, code, type, renameAllClasses, schoolId } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Subject name is required.' });
        }
        const trimmedName = name.trim();

        // If user wants to rename across all classes in this school
        if (renameAllClasses) {
            const oldSub = await pool.query('SELECT name FROM subjects WHERE id = $1', [subjectId]);
            if (oldSub.rows.length > 0) {
                req.body.oldName = oldSub.rows[0].name;
                req.body.newName = trimmedName;
                return exports.renameSubject(req, res);
            }
        }

        // Check duplicate within this class
        const duplicateCheck = await pool.query(
            'SELECT id FROM subjects WHERE class_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) AND id != $3',
            [classId, trimmedName, subjectId]
        );
        if (duplicateCheck.rows.length > 0) {
            return res.status(409).json({ message: `Subject "${trimmedName}" already exists in this class.` });
        }

        const result = await pool.query(
            'UPDATE subjects SET name = $1, code = $2, type = $3 WHERE id = $4 AND class_id = $5 RETURNING *',
            [trimmedName, code || null, type || 'Theory', subjectId, classId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Subject not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update subject' });
    }
};

exports.deleteSubject = async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'SCHOOL_ADMIN') {
            return res.status(403).json({ message: 'Access denied: Only Super Admin and School Admin can delete subjects.' });
        }
        const { classId, subjectId } = req.params;

        // Safety check: protect subjects that already have marks entered!
        const marksCheck = await pool.query(
            'SELECT COUNT(*)::int as count FROM marks WHERE subject_id = $1',
            [subjectId]
        );
        if (parseInt(marksCheck.rows[0]?.count || 0) > 0) {
            return res.status(400).json({ 
                message: `Cannot delete subject: ${marksCheck.rows[0].count} mark(s) have already been entered for this subject. If you want to change its name, please use the Rename feature to keep all marks safe.` 
            });
        }

        const result = await pool.query(
            'DELETE FROM subjects WHERE id = $1 AND class_id = $2 RETURNING *',
            [subjectId, classId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Subject not found' });
        }
        res.json({ message: 'Subject deleted' });
    } catch (error) {
        console.error(error);
        if (error.code === '23503') {
            return res.status(400).json({ message: 'Cannot delete subject with existing marks/exams' });
        }
        res.status(500).json({ message: 'Failed to delete subject' });
    }
};

exports.updateSection = async (req, res) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'Access denied: Only Super Admin can update sections.' });
        }
        const { classId, sectionId } = req.params;
        const { name } = req.body;

        const result = await pool.query(
            'UPDATE sections SET name = $1 WHERE id = $2 AND class_id = $3 RETURNING *',
            [name, sectionId, classId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Section not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(409).json({ message: 'Section name already exists in this class' });
        }
        res.status(500).json({ message: 'Failed to update section' });
    }
};
