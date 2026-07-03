const { pool } = require('../config/db');

/**
 * Regenerates IDs for all students, teachers, and staff in a school based on a new ID prefix.
 * It also updates their login emails in the users table.
 * 
 * @param {number} schoolId 
 * @param {string} newPrefix 
 * @param {object} client - Optional pg client for transaction support
 */
const regenerateSchoolIds = async (schoolId, newPrefix, client = null) => {
    const dbClient = client || pool;
    try {
        console.log(`[ID MIGRATION] Starting migration for school ${schoolId} with prefix ${newPrefix}`);
        
        console.log('[ID MIGRATION] Cleaning duplicate users...');
        // Clean up duplicate users before updating to prevent unique constraint violations
        await dbClient.query(`
            DELETE FROM users a USING (
              SELECT id,
                  ROW_NUMBER() OVER (PARTITION BY linked_id, role, school_id ORDER BY id ASC) as rnum
              FROM users WHERE school_id = $1 AND linked_id IS NOT NULL
            ) b
            WHERE a.id = b.id AND b.rnum > 1;
        `, [schoolId]);
        console.log('[ID MIGRATION] Duplicate users cleaned.');

        // 1. Migrate Students (Prefix + 'S' + 4 digits)
        console.log('[ID MIGRATION] Fetching students...');
        const students = await dbClient.query('SELECT id, admission_no FROM students WHERE school_id = $1 AND (status IS NULL OR status != \'Deleted\')', [schoolId]);
        console.log(`[ID MIGRATION] Found ${students.rows.length} students to migrate.`);
        for (const student of students.rows) {
            let isUnique = false;
            let newId;
            while (!isUnique) {
                const rand4 = Math.floor(1000 + Math.random() * 9000);
                newId = `${newPrefix.toUpperCase()}S${rand4}`;
                const checkStudent = await dbClient.query('SELECT id FROM students WHERE admission_no = $1', [newId]);
                const checkUser = await dbClient.query('SELECT id FROM users WHERE email = $1', [newId.toLowerCase()]);
                if (checkStudent.rows.length === 0 && checkUser.rows.length === 0) isUnique = true;
            }
            
            // Update student record
            await dbClient.query('UPDATE students SET admission_no = $1 WHERE id = $2', [newId, student.id]);
            
            // Update user record (login email)
            await dbClient.query(`UPDATE users SET email = $1 WHERE linked_id = $2 AND role = 'STUDENT' AND school_id = $3`, [newId.toLowerCase(), student.id, schoolId]);
        }
        console.log('[ID MIGRATION] Students migrated successfully. Fetching teachers...');
        
        // 2. Migrate Teachers (Prefix + 'T' + 4 digits)
        const teachers = await dbClient.query('SELECT id, employee_id FROM teachers WHERE school_id = $1', [schoolId]); 
        console.log(`[ID MIGRATION] Found ${teachers.rows.length} teachers to migrate.`);
        for (const teacher of teachers.rows) {
            let isUnique = false;
            let newId;
            while (!isUnique) {
                const rand4 = Math.floor(1000 + Math.random() * 9000);
                newId = `${newPrefix.toUpperCase()}T${rand4}`;
                const checkTeacher = await dbClient.query('SELECT id FROM teachers WHERE employee_id = $1', [newId]);
                const checkUser = await dbClient.query('SELECT id FROM users WHERE email = $1', [newId.toLowerCase()]);
                if (checkTeacher.rows.length === 0 && checkUser.rows.length === 0) isUnique = true;
            }
            
            // Update teacher record
            await dbClient.query('UPDATE teachers SET employee_id = $1 WHERE id = $2', [newId, teacher.id]);
            
            // Update user record
            await dbClient.query(`UPDATE users SET email = $1 WHERE linked_id = $2 AND role = 'TEACHER' AND school_id = $3`, [newId.toLowerCase(), teacher.id, schoolId]);
        }
        console.log('[ID MIGRATION] Teachers migrated successfully. Fetching staff...');

        // 3. Migrate Staff (Prefix + Role Initial + 4 digits)
        const staff = await dbClient.query('SELECT id, employee_id, role FROM staff WHERE school_id = $1', [schoolId]);
        console.log(`[ID MIGRATION] Found ${staff.rows.length} staff to migrate.`);
        for (const staffMember of staff.rows) {
            let isUnique = false;
            let newId;
            const roleLetter = (staffMember.role || 'S').substring(0, 1).toUpperCase();
            while (!isUnique) {
                const rand4 = Math.floor(1000 + Math.random() * 9000);
                newId = `${newPrefix.toUpperCase()}${roleLetter}${rand4}`;
                const checkStaff = await dbClient.query('SELECT id FROM staff WHERE employee_id = $1', [newId]);
                const checkUser = await dbClient.query('SELECT id FROM users WHERE email = $1', [newId.toLowerCase()]);
                if (checkStaff.rows.length === 0 && checkUser.rows.length === 0) isUnique = true;
            }
            
            // Update staff record
            await dbClient.query('UPDATE staff SET employee_id = $1 WHERE id = $2', [newId, staffMember.id]);
            
            // Update user record
            await dbClient.query(`UPDATE users SET email = $1 WHERE linked_id = $2 AND role NOT IN ('STUDENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN') AND school_id = $3`, [newId.toLowerCase(), staffMember.id, schoolId]);
        }
        
        console.log(`[ID MIGRATION] Completed successfully for school ${schoolId}`);
        return true;
    } catch (error) {
        console.error('[ID MIGRATION ERROR]', error);
        throw error;
    }
};

module.exports = { regenerateSchoolIds };
