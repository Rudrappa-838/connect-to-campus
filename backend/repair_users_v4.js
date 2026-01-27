const { pool } = require('./src/config/db');
const bcrypt = require('bcrypt');

async function repair() {
    try {
        console.log('Starting Repair...');
        const pass = await bcrypt.hash('123456', 10);

        // Students
        const students = await pool.query('SELECT admission_no, school_id FROM students');
        for (const s of students.rows) {
            if (!s.admission_no) continue;
            const synth = `${s.admission_no.toLowerCase()}@student.school.com`;
            const check = await pool.query('SELECT id FROM users WHERE email = $1', [synth]);
            if (check.rows.length === 0) {
                console.log(`Fixing Student ${s.admission_no}`);
                await pool.query('INSERT INTO users (email, password, role, school_id, must_change_password) VALUES ($1, $2, $3, $4, TRUE)', [synth, pass, 'STUDENT', s.school_id]);
            }
        }

        // Teachers
        const teachers = await pool.query('SELECT employee_id, school_id FROM teachers');
        for (const t of teachers.rows) {
            if (!t.employee_id) continue;
            const synth = `${t.employee_id.toLowerCase()}@teacher.school.com`;
            const check = await pool.query('SELECT id FROM users WHERE email = $1', [synth]);
            if (check.rows.length === 0) {
                console.log(`Fixing Teacher ${t.employee_id}`);
                await pool.query('INSERT INTO users (email, password, role, school_id, must_change_password) VALUES ($1, $2, $3, $4, TRUE)', [synth, pass, 'TEACHER', t.school_id]);
            }
        }

        // Staff
        const staff = await pool.query('SELECT employee_id, role, school_id FROM staff');
        for (const st of staff.rows) {
            if (!st.employee_id) continue;
            const synth = `${st.employee_id.toLowerCase()}@staff.school.com`;
            const check = await pool.query('SELECT id FROM users WHERE email = $1', [synth]);
            if (check.rows.length === 0) {
                console.log(`Fixing Staff ${st.employee_id}`);
                const roleFlag = st.role ? st.role.toUpperCase() : 'STAFF';
                const finalRole = ['DRIVER', 'ACCOUNTANT', 'LIBRARIAN'].includes(roleFlag) ? roleFlag : 'STAFF';
                await pool.query('INSERT INTO users (email, password, role, school_id, must_change_password) VALUES ($1, $2, $3, $4, TRUE)', [synth, pass, finalRole, st.school_id]);
            }
        }

        console.log('Done.');
    } catch (e) {
        console.error('FAIL:', e.message);
        console.error(e.stack);
    } finally {
        pool.end();
    }
}

repair();
