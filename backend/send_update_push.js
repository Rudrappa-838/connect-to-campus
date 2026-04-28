const { pool } = require('./src/config/db');
const { sendPushNotification } = require('./src/services/firebaseService');

const sendGlobalUpdateNotification = async () => {
    console.log('🚀 Starting Global Update Notification Script...');
    const client = await pool.connect();

    try {
        // Fetch all unique FCM tokens from the users table
        const result = await client.query('SELECT id, fcm_token FROM users WHERE fcm_token IS NOT NULL');
        const users = result.rows;

        console.log(`📡 Found ${users.length} users with active FCM tokens.`);

        if (users.length === 0) {
            console.log('⚠️ No tokens found. Exiting.');
            return;
        }

        let successCount = 0;
        let failCount = 0;

        const title = "🚨 App Update Required";
        const message = "A new version (v40) of Connect to Campus is available. Please update from the Play Store to continue using the Biometric Scanner and get all the latest bug fixes!";
        
        // We add a custom data payload to handle the click action if needed
        const customData = {
            action: 'OPEN_PLAY_STORE',
            url: 'https://play.google.com/store/apps/details?id=com.rudrappa.connect2campus'
        };

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            try {
                // Send push notification directly via Firebase Service
                await sendPushNotification(user.fcm_token, title, message, customData, 1);
                successCount++;
                process.stdout.write(`\r✅ Progress: ${i + 1}/${users.length} sent...`);
            } catch (err) {
                failCount++;
            }
        }

        console.log(`\n\n🎉 Notification Sending Complete!`);
        console.log(`✅ Successful: ${successCount}`);
        console.log(`❌ Failed (Invalid/Old Tokens): ${failCount}`);

    } catch (error) {
        console.error('🔥 Error running script:', error);
    } finally {
        client.release();
        process.exit(0);
    }
};

sendGlobalUpdateNotification();
