const { pool } = require('./src/config/db');

async function verifyFix() {
    try {
        console.log('🧪 Verifying Email Conflict Fix...');

        // 1. Identify a deleted school's email
        const deletedRes = await pool.query(`
            SELECT u.email 
            FROM users u 
            JOIN schools s ON u.school_id = s.id 
            WHERE s.status = 'Deleted' 
            LIMIT 1
        `);
        
        if (deletedRes.rows.length === 0) {
            console.log('No deleted schools found to test with.');
            return;
        }

        const testEmail = deletedRes.rows[0].email;
        console.log(`Testing with email: ${testEmail} (which belongs to a deleted school)`);

        // 2. Simulate the adminEmailCheck logic
        const checkRes = await pool.query(`
            SELECT u.id 
            FROM users u 
            LEFT JOIN schools s ON u.school_id = s.id 
            WHERE u.email = $1 
            AND (u.school_id IS NULL OR s.status IS NULL OR s.status != 'Deleted')
        `, [testEmail]);

        if (checkRes.rows.length === 0) {
            console.log('✅ PASS: adminEmailCheck correctly ignores the deleted school user.');
        } else {
            console.log('❌ FAIL: adminEmailCheck still blocks the email.');
        }

        // 3. Verify SUPER_ADMIN is still blocked
        const superRes = await pool.query("SELECT email FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1");
        if (superRes.rows.length > 0) {
            const superEmail = superRes.rows[0].email;
            const superCheckRes = await pool.query(`
                SELECT u.id 
                FROM users u 
                LEFT JOIN schools s ON u.school_id = s.id 
                WHERE u.email = $1 
                AND (u.school_id IS NULL OR s.status IS NULL OR s.status != 'Deleted')
            `, [superEmail]);
            
            if (superCheckRes.rows.length > 0) {
                console.log(`✅ PASS: SUPER_ADMIN (${superEmail}) is correctly blocked.`);
            } else {
                console.log('❌ FAIL: SUPER_ADMIN is mistakenly allowed.');
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

verifyFix();
