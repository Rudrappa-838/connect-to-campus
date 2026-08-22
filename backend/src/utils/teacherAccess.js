const { pool } = require('../config/db');

/**
 * Resolves a teacher's ID and allowed classes/sections.
 * @param {number} teacherId - ID from teachers table
 * @param {number} schoolId - School ID
 * @returns {Promise<Array<{ class_id: number|string|null, section_id: number|null, is_all: boolean }>>}
 */
async function getTeacherAllowedClasses(teacherId, schoolId) {
    if (!teacherId || !schoolId) return [];

    const allowed = [];

    // 1. Check sections assigned to teacher
    const secRes = await pool.query(
        `SELECT id, class_id FROM sections WHERE class_teacher_id = $1`,
        [teacherId]
    );
    secRes.rows.forEach(r => {
        allowed.push({ class_id: r.class_id, section_id: r.id, is_all: false });
    });

    // 2. Check classes assigned directly to teacher
    const clsRes = await pool.query(
        `SELECT id FROM classes WHERE class_teacher_id = $1 AND school_id = $2`,
        [teacherId, schoolId]
    );
    clsRes.rows.forEach(r => {
        allowed.push({ class_id: r.id, section_id: null, is_all: true });
    });

    // 3. Check manual_attendance_classes from teachers table
    const teacherRes = await pool.query(
        `SELECT manual_attendance_classes FROM teachers WHERE id = $1 AND school_id = $2`,
        [teacherId, schoolId]
    );

    if (teacherRes.rows.length > 0) {
        let manualClasses = teacherRes.rows[0].manual_attendance_classes;
        if (typeof manualClasses === 'string') {
            try { manualClasses = JSON.parse(manualClasses); } catch (e) { manualClasses = []; }
        }
        if (Array.isArray(manualClasses)) {
            if (manualClasses.includes('ALL')) {
                return [{ class_id: 'ALL', section_id: null, is_all: true }];
            }
            manualClasses.forEach(item => {
                if (typeof item === 'number' || (typeof item === 'string' && !isNaN(item))) {
                    allowed.push({ class_id: parseInt(item), section_id: null, is_all: true });
                } else if (typeof item === 'string' && item.startsWith('C_')) {
                    allowed.push({ class_id: parseInt(item.replace('C_', '')), section_id: null, is_all: true });
                } else if (typeof item === 'string' && item.startsWith('S_')) {
                    const secId = parseInt(item.replace('S_', ''));
                    allowed.push({ class_id: null, section_id: secId, is_all: false });
                }
            });
        }
    }

    return allowed;
}

/**
 * Resolves teacher's DB linked ID from req.user
 */
async function resolveTeacherId(reqUser) {
    if (reqUser.linkedId) return reqUser.linkedId;

    let tRes = await pool.query(
        'SELECT id FROM teachers WHERE school_id = $1 AND LOWER(email) = LOWER($2)',
        [reqUser.schoolId, reqUser.email]
    );
    if (tRes.rows.length === 0) {
        const potentialEmpId = (reqUser.email || '').split('@')[0];
        tRes = await pool.query(
            'SELECT id FROM teachers WHERE school_id = $1 AND employee_id ILIKE $2',
            [reqUser.schoolId, potentialEmpId]
        );
    }
    return tRes.rows.length > 0 ? tRes.rows[0].id : null;
}

/**
 * Checks if reqUser is authorized to operate on classId and sectionId.
 * Admin roles (SCHOOL_ADMIN, SUPER_ADMIN) are always authorized.
 */
async function isTeacherAuthorizedForClass(reqUser, classId, sectionId = null) {
    if (['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(reqUser.role)) {
        return true;
    }

    if (reqUser.role !== 'TEACHER') {
        return false;
    }

    const teacherId = await resolveTeacherId(reqUser);
    if (!teacherId) return false;

    const allowed = await getTeacherAllowedClasses(teacherId, reqUser.schoolId);

    // If teacher has ALL access
    if (allowed.some(a => a.class_id === 'ALL')) {
        return true;
    }

    const targetClassId = classId ? parseInt(classId) : null;
    const targetSectionId = sectionId ? parseInt(sectionId) : null;

    return allowed.some(a => {
        // Direct match on section
        if (targetSectionId && a.section_id === targetSectionId) return true;
        // Direct match on class
        if (targetClassId && a.class_id === targetClassId) {
            if (a.is_all || !targetSectionId || !a.section_id || a.section_id === targetSectionId) {
                return true;
            }
        }
        return false;
    });
}

module.exports = {
    getTeacherAllowedClasses,
    resolveTeacherId,
    isTeacherAuthorizedForClass
};
