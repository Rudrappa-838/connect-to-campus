const { pool } = require('./src/config/db');

async function debugLookup(id, role) {
    try {
        console.log(`\n=== DEBUG LOOKUP FOR: ${id} (${role}) ===`);
        id = id.trim();
        let checkEmails = [id, id.toLowerCase()];

        // 1. PROFILE LOOKUP
        let profileEmail = null;
        let profileName = null;
        let foundProfile = false;

        if (role === 'STAFF') {
            console.log(`Searching STAFF table for employee_id: ${id}`);
            const res = await pool.query('SELECT * FROM staff WHERE employee_id ILIKE $1', [id]);
            if (res.rows.length > 0) {
                foundProfile = true;
                const p = res.rows[0];
                console.log(`✅ FOUND STAFF PROFILE: ID=${p.id}, Name=${p.name}, Email=${p.email}`);
                if (p.email) {
                    profileEmail = p.email;
                    checkEmails.push(p.email);
                } else {
                    console.log('⚠️ Staff profile has NO EMAIL.');
                }
            } else {
                console.log('❌ Staff profile NOT FOUND.');
            }

            checkEmails.push(`${id}@staff.school.com`);
            checkEmails.push(`${id.toLowerCase()}@staff.school.com`);
        }
        else if (role === 'STUDENT') {
            console.log(`Searching STUDENTS table for admission_no: ${id}`);
            const res = await pool.query('SELECT * FROM students WHERE admission_no ILIKE $1', [id]);
            if (res.rows.length > 0) {
                foundProfile = true;
                const p = res.rows[0];
                console.log(`✅ FOUND STUDENT PROFILE: ID=${p.id}, Name=${p.first_name} ${p.last_name}, Email=${p.email}`);
                if (p.email) {
                    profileEmail = p.email;
                    checkEmails.push(p.email);
                } else {
                    console.log('⚠️ Student profile has NO EMAIL.');
                }
            } else {
                console.log('❌ Student profile NOT FOUND.');
            }

            checkEmails.push(`${id}@student.school.com`);
            checkEmails.push(`${id.toLowerCase()}@student.school.com`);
        }

        console.log('checking against these emails:', checkEmails);

        // 2. USERS TABLE LOOKUP
        let query = `SELECT * FROM users WHERE email = ANY($1::text[])`;
        let params = [checkEmails]; // checkEmails is array of strings. 
        // Note: In pg driver, ANY($1) expects an array.

        // Simulating the controller logic for Role
        if (role === 'STAFF') {
            query += ` AND role IN ('STAFF', 'DRIVER')`;
        } else {
            query += ` AND role = '${role}'`;
        }

        console.log(`Executing Users Query: ${query}`);
        const userRes = await pool.query(query, params);

        if (userRes.rows.length > 0) {
            console.log('✅ FOUND USER IN USERS TABLE:');
            userRes.rows.forEach(u => console.log(`   - ID: ${u.id}, Email: ${u.email}, Role: ${u.role}`));
        } else {
            console.log('❌ NO MATCH IN USERS TABLE.');

            // 3. DIAGNOSTIC: What DOES exist for this email/role?
            console.log('--- DIAGNOSTIC ---');
            if (profileEmail) {
                const diag1 = await pool.query('SELECT * FROM users WHERE email = $1', [profileEmail]);
                console.log(`Is there a user with profile email '${profileEmail}'?`, diag1.rows.length > 0 ? diag1.rows[0] : 'NO');
            }

            const synthetic = checkEmails.find(e => e.includes('@'));
            if (synthetic) {
                const diag2 = await pool.query('SELECT * FROM users WHERE email ILIKE $1', [synthetic]);
                console.log(`Is there a user with synthetic email '${synthetic}'?`, diag2.rows.length > 0 ? diag2.rows[0] : 'NO');
            }
        }

    } catch (e) {
        console.error('ERROR:', e);
    }
}

async function run() {
    await debugLookup('DAD8663', 'STAFF');
    await debugLookup('DAS5778', 'STUDENT');
    pool.end();
}

run();
