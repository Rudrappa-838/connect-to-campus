const { pool } = require('./src/config/db');

async function run() {
    try {
        const ids = ['DAD8663', 'DAS5778'];

        for (const id of ids) {
            console.log(`\n--- DIAGNOSING ID: ${id} ---`);

            // 1. Check Students
            const sRes = await pool.query('SELECT id, admission_no, email, first_name, last_name, school_id FROM students WHERE admission_no ILIKE $1', [id]);
            if (sRes.rows.length > 0) {
                console.log('STUDENT RECORD:', sRes.rows[0]);
                const profileEmail = sRes.rows[0].email;
                if (profileEmail) {
                    const uRes = await pool.query('SELECT id, email, role, school_id FROM users WHERE email ILIKE $1', [profileEmail]);
                    console.log(`USERS records for profile email '${profileEmail}':`, uRes.rows);
                }
            } else {
                console.log('NO STUDENT RECORD FOUND.');
            }

            // 2. Check Staff
            const stRes = await pool.query('SELECT id, employee_id, email, name, role, school_id FROM staff WHERE employee_id ILIKE $1', [id]);
            if (stRes.rows.length > 0) {
                console.log('STAFF RECORD:', stRes.rows[0]);
                const profileEmail = stRes.rows[0].email;
                if (profileEmail) {
                    const uRes = await pool.query('SELECT id, email, role, school_id FROM users WHERE email ILIKE $1', [profileEmail]);
                    console.log(`USERS records for profile email '${profileEmail}':`, uRes.rows);
                }
            } else {
                console.log('NO STAFF RECORD FOUND.');
            }

            // 3. Check for specific synthetic emails
            const synthStaff = `${id.toLowerCase()}@staff.school.com`;
            const synthStudent = `${id.toLowerCase()}@student.school.com`;

            const uSynth = await pool.query('SELECT id, email, role, school_id FROM users WHERE email IN ($1, $2)', [synthStaff, synthStudent]);
            console.log(`USERS records for synthetic emails:`, uSynth.rows);
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

run();
