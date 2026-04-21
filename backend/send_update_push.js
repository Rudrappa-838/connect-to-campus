const { pool } = require('./src/config/db');
const { sendPushNotification } = require('./src/services/firebaseService');

async function broadcastUpdate() {
    console.log('--- STARTING APP UPDATE BROADCAST (v35) ---');
    try {
        // 1. Get all unique tokens from users table
        const result = await pool.query('SELECT DISTINCT fcm_token FROM users WHERE fcm_token IS NOT NULL');
        const tokens = result.rows.map(r => r.fcm_token);

        console.log(`Found ${tokens.length} users with push tokens.`);

        const title = 'New App Update: Version 35';
        const body = 'A critical update (v35) is available with fixed notifications. Please update from Play Store now!';

        let successCount = 0;
        let failCount = 0;

        for (const token of tokens) {
            try {
                const response = await sendPushNotification(token, title, body, {
                    type: 'UPDATE',
                    version: '35',
                    link: 'https://play.google.com/store/apps/details?id=com.connect2campus.school'
                });
                
                if (response === 'LOGGED' || response) {
                    successCount++;
                } else {
                    failCount++;
                }

            } catch (err) {
                // Silently skip common Firebase errors for invalid tokens
                if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
                     // console.log(`Skipping invalid token: ${token.substring(0, 10)}...`);
                } else {
                    console.error(`Error with token ${token.substring(0, 10)}...:`, err.message);
                }
                failCount++;
            }
        }

        console.log('--- BROADCAST COMPLETE ---');
        console.log(`Sent: ${successCount}`);
        console.log(`Failed: ${failCount}`);
        process.exit(0);

    } catch (error) {
        console.error('CRITICAL BROADCAST ERROR:', error);
        process.exit(1);
    }
}

broadcastUpdate();
