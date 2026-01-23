const { pool } = require('./src/config/db');

async function fixDb() {
    try {
        console.log('🔧 Starting Urgent DB Fix...');
        const client = await pool.connect();

        // 1. Add current_session_token
        try {
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS current_session_token TEXT;`);
            console.log('✅ Added current_session_token');
        } catch (e) {
            console.log('⚠️ current_session_token error:', e.message);
        }

        // 2. Add must_change_password
        try {
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;`);
            console.log('✅ Added must_change_password');
        } catch (e) {
            console.log('⚠️ must_change_password error:', e.message);
        }

        // 3. Add fcm_token
        try {
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;`);
            console.log('✅ Added fcm_token');
        } catch (e) {
            console.log('⚠️ fcm_token error:', e.message);
        }

        // 4. Verify
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.log('📋 Existing Columns in Users Table:', res.rows.map(r => r.column_name));

        client.release();
        process.exit(0);

    } catch (e) {
        console.error('❌ Critical Error:', e);
        process.exit(1);
    }
}

fixDb();
