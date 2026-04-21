const { pool } = require('./src/config/db');
const { sendPushNotification } = require('./src/services/firebaseService');

async function run() {
    const searchId = 'das1346';
    console.log(`🔍 Searching for User ID: ${searchId}...`);
    
    try {
        // Search in users table
        const res = await pool.query(
            "SELECT id, email, fcm_token FROM users WHERE email ILIKE $1 OR email ILIKE $2", 
            [`%${searchId}%`, `%${searchId.toLowerCase()}%`]
        );

        let user = res.rows[0];

        // If not found, look for MOST RECENT token in the system (to help the user)
        if (!user) {
            console.log(`⚠️ User ${searchId} not found. Checking for the most recent login instead...`);
            const recentRes = await pool.query(
                "SELECT id, email, fcm_token FROM users WHERE fcm_token IS NOT NULL ORDER BY id DESC LIMIT 1"
            );
            user = recentRes.rows[0];
        }

        if (!user || !user.fcm_token) {
            console.log('❌ No valid user with an FCM token was found.');
            return;
        }

        console.log(`✅ Targeted User: ${user.email} (ID: ${user.id})`);
        console.log('🚀 Sending System Tray Notification...');

        const result = await sendPushNotification(
            user.fcm_token,
            'System Tray Test ✅',
            'If you see this, your notifications are working perfectly In the top bar!',
            { type: 'TEST' },
            1
        );

        console.log('Result:', result ? 'Success' : 'Failed');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
