const { pool } = require('./src/config/db');

async function debugAnnouncements() {
    try {
        console.log('🔍 Checking Announcements Table Schema...');
        const schemaRes = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'announcements';
        `);
        console.table(schemaRes.rows);

        console.log('\n🔍 Checking Constraints...');
        const constraintsRes = await pool.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'announcements'::regclass;
        `);
        console.log(constraintsRes.rows);

        console.log('\n🔍 Attempting Test Insertion...');
        // We'll try to insert a dummy announcement for a dummy school 9999
        // This won't affect real users but will test the SQL logic
        try {
            const testInsert = await pool.query(`
                INSERT INTO announcements (school_id, title, message, target_role, priority, created_by, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING *
            `, [1, 'Debug Test', 'Testing persistence', 'All', 'Normal', 1]); // Assuming user ID 1 and school ID 1 exist or can be referenced.
            // Note: If ID 1 doesn't exist, foreign key constraint might fail.
            // Let's first check for a valid user

            console.log('✅ Test Insertion Successful:', testInsert.rows[0]);

            // Clean up
            await pool.query('DELETE FROM announcements WHERE id = $1', [testInsert.rows[0].id]);
            console.log('✅ Cleaned up test data.');

        } catch (insertErr) {
            console.error('❌ Insertion Failed:', insertErr.message);
            // Check for valid user to improve test
            const userCheck = await pool.query('SELECT id, school_id FROM users LIMIT 1');
            if (userCheck.rows.length > 0) {
                console.log(`(Found valid user ID: ${userCheck.rows[0].id} for School: ${userCheck.rows[0].school_id}) - You might need to use these values manually.`);
            } else {
                console.log('❌ No users found in DB to link announcement to.');
            }
        }

    } catch (err) {
        console.error('❌ Major Error:', err);
    } finally {
        pool.end();
    }
}

debugAnnouncements();
