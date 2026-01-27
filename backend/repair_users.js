const { pool } = require('./src/config/db');
const bcrypt = require('bcrypt');

async function runPlan() {
    const client = await pool.connect();
    try {
        console.log('--- REPAIRING MISSING USER ACCOUNTS ---');
        const defaultPassword = await bcrypt.hash('123456', 10);

        // 1. Repair Students
        const students = await client.query('SELECT admission_no, email, school_id FROM students');
        for (const s of students.rows) {
            const synth = `${s.admission_no.toLowerCase()}@student.school.com`;
            const check = await client.query('SELECT id FROM users WHERE (email = $1 OR email = $2) AND role = $3', [s.email, synth, 'STUDENT']);
            if (check.rows.length === 0) {
                console.log(`Creating user for Student ${s.admission_no}`);
                await client.query(
                    `INSERT INTO users (email, password, role, school_id, must_change_password) VALUES ($1, $2, $3, $4, TRUE)`,
                    [synth, defaultPassword, 'STUDENT', s.school_id]
                );
            }
        }

        // 2. Repair Teachers
        const teachers = await client.query('SELECT employee_id, email, school_id FROM teachers');
        for (const t of teachers.rows) {
            const synth = `${t.employee_id.toLowerCase()}@teacher.school.com`;
            const check = await client.query('SELECT id FROM users WHERE (email = $1 OR email = $2) AND role = $3', [t.email, synth, 'TEACHER']);
            if (check.rows.length === 0) {
                console.log(`Creating user for Teacher ${t.employee_id}`);
                await client.query(
                    `INSERT INTO users (email, password, role, school_id, must_change_password) VALUES ($1, $2, $3, $4, TRUE)`,
                    [synth, defaultPassword, 'TEACHER', t.school_id]
                );
            }
        }

        // 3. Repair Staff
        const staff = await client.query('SELECT employee_id, email, role, school_id FROM staff');
        for (const st of staff.rows) {
            const synth = `${st.employee_id.toLowerCase()}@staff.school.com`;
            const userRole = ['DRIVER', 'ACCOUNTANT', 'LIBRARIAN'].includes(st.role.toUpperCase()) ? st.role.toUpperCase() : 'STAFF';

            const check = await client.query('SELECT id FROM users WHERE (email = $1 OR email = $2) AND role IN ($3, $4, $5, $6)', [st.email, synth, 'STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN']);
            if (check.rows.length === 0) {
                console.log(`Creating user for Staff ${st.employee_id}`);
                await client.query(
                    `INSERT INTO users (email, password, role, school_id, must_change_password) VALUES ($1, $2, $3, $4, TRUE)`,
                    [synth, defaultPassword, userRole, st.school_id]
                );
            }
        }

        console.log('REPAIR COMPLETED SUCCESSFULLY.');

    } catch (e) {
        console.error('REPAIR FAILED:', e);
    } finally {
        client.release();
        pool.end();
    }
}

runPlan();
