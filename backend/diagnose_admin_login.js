const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./src/config/db');
const jwt = require('jsonwebtoken');

// CHANGE THIS TO THE AFFECTED EMAIL
const TARGET_EMAIL = process.argv[2] || 'Softnetbgk@gmail.com';

async function diagnose() {
    const client = await pool.connect();
    try {
        console.log(`\n🔍 DIAGNOSING USER: ${TARGET_EMAIL}`);
        console.log('------------------------------------------------');

        // 1. Check User Existence & Role
        const userRes = await client.query('SELECT * FROM users WHERE email = $1', [TARGET_EMAIL]);
        if (userRes.rows.length === 0) {
            console.log('❌ User NOT FOUND in database.');
            return;
        }
        const user = userRes.rows[0];
        console.log(`✅ User Found: ID=${user.id}, Role=${user.role}, SchoolID=${user.school_id}`);

        if (!user.school_id) {
            console.log('❌ CRITICAL: User has NO school_id associated! Dashboard cannot load.');
            return;
        }

        // 2. Check School Status
        const schoolRes = await client.query('SELECT * FROM schools WHERE id = $1', [user.school_id]);
        if (schoolRes.rows.length === 0) {
            console.log(`❌ CRITICAL: Linked School (ID ${user.school_id}) does NOT EXIST in schools table.`);
            return;
        }
        const school = schoolRes.rows[0];
        console.log(`✅ School Found: Name="${school.name}", ID=${school.id}, Active=${school.is_active}`);

        // 3. Check Academic Year Checks
        console.log('\n📅 Checking Academic Years...');
        try {
            const ayRes = await client.query('SELECT * FROM academic_years WHERE school_id = $1', [user.school_id]);
            if (ayRes.rows.length === 0) {
                console.log('❌ NO ACADEMIC YEARS found for this school.');
                console.log('   -> This is likely causing the dashboard crash.');
            } else {
                console.log(`✅ Academic Years Detected: ${ayRes.rows.length}`);
                ayRes.rows.forEach(ay => console.log(`   - ${ay.year_label} (${ay.status})`));
            }
        } catch (err) {
            console.log('❌ TABLE MISSING: academic_years check failed.');
            console.log('   Error:', err.message);
        }

        // 4. Simulate Dashboard Stats Query (Common Failure Point)
        console.log('\n📊 Simulating Dashboard Stats Query...');
        try {
            const countsRes = await client.query(`
                SELECT 
                    (SELECT COUNT(*) FROM students WHERE school_id = $1) as total_students,
                    (SELECT COUNT(*) FROM teachers WHERE school_id = $1) as total_teachers
            `, [user.school_id]);
            console.log('✅ Stats Query SUCCESS:', countsRes.rows[0]);
        } catch (err) {
            console.log('❌ Stats Query FAILED');
            console.log('   Error:', err.message);
        }

        // 5. Check Token Generation
        console.log('\n🔑 Token Test...');
        try {
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role, schoolId: user.school_id },
                process.env.JWT_SECRET || 'secret',
                { expiresIn: '1h' }
            );
            console.log('✅ Token generated successfully.');
        } catch (err) {
            console.log('❌ Token Generation Failed:', err.message);
        }

        console.log('\n------------------------------------------------');
        console.log('CONCLUSION:');
        if (!user.school_id) console.log('👉 ISSUE: User is not linked to a school.');
        else if (schoolRes.rows.length === 0) console.log('👉 ISSUE: School ID in user table points to non-existent school.');
        else console.log('👉 If all checks passed above, the issue might be network/CORS or frontend-specific.');

    } catch (e) {
        console.error('❌ Unexpected Error:', e);
    } finally {
        client.release();
        pool.end();
    }
}

diagnose();
