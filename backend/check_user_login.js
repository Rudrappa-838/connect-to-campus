const { Pool } = require('pg');
require('dotenv').config();
const bcrypt = require('bcrypt');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function checkStudentAndUser() {
    try {
        const username = 'DAS7304'; // Admission No
        console.log(`Checking for student with admission_no: ${username}`);
        const studRes = await pool.query('SELECT id, name, email, admission_no FROM students WHERE admission_no = $1', [username]);

        let studentEmail = null;
        if (studRes.rows.length === 0) {
            console.log('Student NOT FOUND in students table.');
        } else {
            console.log('Student FOUND:', studRes.rows[0]);
            studentEmail = studRes.rows[0].email;
        }

        console.log(`Checking for user...`);
        // Try all casing
        const possibleEmail1 = `${username.toLowerCase()}@student.school.com`;
        const possibleEmail2 = `${username.toUpperCase()}@student.school.com`;

        console.log(`Possible emails: ${possibleEmail1}, ${possibleEmail2}, ${studentEmail}`);

        const userRes = await pool.query(`SELECT * FROM users WHERE email = $1 OR email = $2 OR (email = $3 AND $3 IS NOT NULL)`,
            [possibleEmail1, possibleEmail2, studentEmail]);

        if (userRes.rows.length === 0) {
            console.log(`User NOT FOUND for specific emails.`);

            // Fuzzy search just in case
            const fuzzyUser = await pool.query('SELECT * FROM users WHERE email ILIKE $1', [`%${username}%`]);
            if (fuzzyUser.rows.length > 0) {
                console.log('Found fuzzy match users (probably wrong format):', fuzzyUser.rows.map(u => ({ email: u.email, role: u.role })));
            } else {
                // Check if user exists for studentEmail specifically
                if (studentEmail) {
                    const emailUser = await pool.query('SELECT * FROM users WHERE email = $1', [studentEmail]);
                    if (emailUser.rows.length > 0) {
                        console.log('User FOUND via student email:', emailUser.rows[0]);
                        return; // Continue to password check
                    }
                }
            }
        } else {
            console.log('User FOUND:', userRes.rows[0]);
            const valid = await bcrypt.compare('123456', userRes.rows[0].password);
            console.log(`Password '123456' valid? ${valid}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkStudentAndUser();
