const { pool } = require('./src/config/db');

async function run() {
    try {
        console.log('--- AUDITING MISSING USER ACCOUNTS ---');

        // Audit Students
        const students = await pool.query('SELECT admission_no, email, school_id FROM students');
        let missingStudents = 0;
        for (const s of students.rows) {
            const synth = `${s.admission_no.toLowerCase()}@student.school.com`;
            const check = await pool.query('SELECT id FROM users WHERE (email = $1 OR email = $2) AND role = $3', [s.email, synth, 'STUDENT']);
            if (check.rows.length === 0) missingStudents++;
        }
        console.log(`Students missing user accounts: ${missingStudents} / ${students.rows.length}`);

        // Audit Teachers
        const teachers = await pool.query('SELECT employee_id, email, school_id FROM teachers');
        let missingTeachers = 0;
        for (const t of teachers.rows) {
            const synth = `${t.employee_id.toLowerCase()}@teacher.school.com`;
            const check = await pool.query('SELECT id FROM users WHERE (email = $1 OR email = $2) AND role = $3', [t.email, synth, 'TEACHER']);
            if (check.rows.length === 0) missingTeachers++;
        }
        console.log(`Teachers missing user accounts: ${missingTeachers} / ${teachers.rows.length}`);

        // Audit Staff
        const staff = await pool.query('SELECT employee_id, email, school_id FROM staff');
        let missingStaff = 0;
        for (const st of staff.rows) {
            const synth = `${st.employee_id.toLowerCase()}@staff.school.com`;
            const check = await pool.query('SELECT id FROM users WHERE (email = $1 OR email = $2) AND role IN ($3, $4, $5, $6)', [st.email, synth, 'STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN']);
            if (check.rows.length === 0) missingStaff++;
        }
        console.log(`Staff missing user accounts: ${missingStaff} / ${staff.rows.length}`);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

run();
