const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function fixMissingUsers() {
    try {
        console.log('Checking for students without user accounts...');

        // 1. Get all students
        const students = await pool.query('SELECT id, name, email, admission_no, school_id FROM students');

        for (const student of students.rows) {
            let loginEmail = student.email;

            // Check if user exists with this email
            let userCheck = await pool.query('SELECT id, role, email FROM users WHERE email = $1', [loginEmail]);

            let needsUser = false;
            let finalEmail = loginEmail;

            if (userCheck.rows.length === 0) {
                // No user found at all for this email -> Create one
                needsUser = true;
            } else {
                // User found. Check role.
                const user = userCheck.rows[0];
                if (user.role !== 'STUDENT') {
                    // Email taken by Staff/Teacher. Fallback to Admission No.
                    console.log(`Student ${student.admission_no} email ${loginEmail} taken by ${user.role}. checking fallback...`);

                    finalEmail = `${student.admission_no.toLowerCase()}@student.school.com`;

                    // Check fallback
                    const fallbackCheck = await pool.query('SELECT id FROM users WHERE email = $1', [finalEmail]);
                    if (fallbackCheck.rows.length === 0) {
                        needsUser = true;
                    } else {
                        console.log(`Fallback ${finalEmail} already exists. All good.`);
                    }
                } else {
                    // Correct role student exists. All good.
                }
            }

            if (needsUser) {
                console.log(`creating MISSING user for Student ${student.admission_no} (${finalEmail})`);
                const defaultPassword = await bcrypt.hash('123456', 10);

                await pool.query(
                    `INSERT INTO users (email, password, role, school_id, must_change_password, linked_id) 
                     VALUES ($1, $2, 'STUDENT', $3, TRUE, $4)`,
                    [finalEmail, defaultPassword, student.school_id, student.id]
                );
                console.log('Created successfully.');
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

fixMissingUsers();
