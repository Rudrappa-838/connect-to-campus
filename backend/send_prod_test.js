const { Pool } = require('pg');
require('dotenv').config();
const { sendPushNotification } = require('./src/services/firebaseService');

const prodPool = new Pool({
    connectionString: process.env.PROD_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const id = 'das1346';
    console.log(`🔍 Searching for user ${id} in PRODUCTION...`);
    
    try {
        const res = await prodPool.query(
            "SELECT id, email, fcm_token FROM users WHERE email ILIKE $1 OR email ILIKE $2 OR email ILIKE $3", 
            [id, id + '%', '%' + id + '%']
        );

        if (res.rows.length === 0) {
            console.log('❌ User not found in Production.');
            return;
        }

        const user = res.rows[0];
        console.log(`✅ Found user: ${user.email}`);
        
        if (!user.fcm_token) {
            console.log('❌ User has no FCM token. Please log in to the app first!');
            return;
        }

        console.log('🚀 Sending Test Notification to System Tray...');
        const notify = await sendPushNotification(
            user.fcm_token,
            'System Tray Test ✅',
            'This message is from the AWS Server to your top notification bar!',
            { type: 'TEST' },
            1
        );
        console.log('Result:', notify);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prodPool.end();
    }
}

run();
