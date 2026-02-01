const { pool } = require('./src/config/db');

async function inspectAnnouncements() {
    try {
        console.log('🔍 Fetching last 10 announcements...');
        const res = await pool.query(`
            SELECT id, school_id, title, target_role, created_at 
            FROM announcements 
            ORDER BY created_at DESC 
            LIMIT 10
        `);

        if (res.rows.length === 0) {
            console.log('❌ No announcements found in database.');
        } else {
            console.log(JSON.stringify(res.rows, null, 2));
            console.log(`✅ Found ${res.rows.length} announcements.`);
        }

        // Also check if there are any announcements for the user's school if known (we can't know for sure without auth, but we can dump school_ids)
        const schoolCounts = await pool.query('SELECT school_id, COUNT(*) FROM announcements GROUP BY school_id');
        console.log('\n📊 Counts by School ID:');
        console.table(schoolCounts.rows);

    } catch (err) {
        console.error('Query failed:', err);
    } finally {
        pool.end();
    }
}

inspectAnnouncements();
