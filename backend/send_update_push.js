const { pool } = require('./src/config/db');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase directly in this script for accurate error handling
let messaging = null;
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
if (fs.existsSync(serviceAccountPath)) {
    try {
        const serviceAccount = require(serviceAccountPath);
        // Avoid re-initialization if already done
        if (!admin.apps.length) {
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        }
        messaging = admin.messaging();
        console.log('✅ Firebase Admin initialized successfully.');
    } catch (e) {
        console.error('❌ Firebase init failed:', e.message);
        process.exit(1);
    }
} else {
    console.error('❌ serviceAccountKey.json not found!');
    process.exit(1);
}

const sendGlobalUpdateNotification = async () => {
    console.log('🚀 Starting Global Update Notification Script...');
    const client = await pool.connect();

    try {
        const result = await client.query(
            'SELECT id, fcm_token, role FROM users WHERE fcm_token IS NOT NULL AND fcm_token != \'\''
        );
        const users = result.rows;
        console.log(`📡 Found ${users.length} users with FCM tokens in database.`);

        if (users.length === 0) {
            console.log('⚠️  No tokens found. Exiting.');
            return;
        }

        const title = "New Update Available! 🚀";
        const body = "The latest version of Connect to Campus is now on the Play Store. Please update your app to get the latest fixes and improvements.";

        const message = {
            notification: { title, body },
            android: {
                priority: 'high',
                ttl: 86400000,
                notification: {
                    channelId: 'school_notifications',
                    color: '#4f46e5',
                    priority: 'max',
                    tag: 'app_update_2026_05',
                    defaultSound: true,
                }
            },
            data: {
                action: 'OPEN_PLAY_STORE',
                url: 'https://play.google.com/store/apps/details?id=com.rudrappa.connect2campus',
                tag: 'app_update_2026_05'
            }
        };

        let successCount = 0;
        let staleCount = 0;
        let errorCount = 0;
        const staleTokenUserIds = [];

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            try {
                await messaging.send({ ...message, token: user.fcm_token });
                successCount++;
                process.stdout.write(`\r✅ Progress: ${i + 1}/${users.length} | Sent: ${successCount} | Stale: ${staleCount} | Error: ${errorCount}`);
            } catch (err) {
                const code = err.errorInfo?.code || '';
                if (code === 'messaging/registration-token-not-registered' ||
                    code === 'messaging/invalid-registration-token') {
                    // Token is stale - mark for cleanup
                    staleTokenUserIds.push(user.id);
                    staleCount++;
                } else {
                    errorCount++;
                    console.error(`\n⚠️  Error for user ID ${user.id} (${user.role}): ${err.message}`);
                }
                process.stdout.write(`\r✅ Progress: ${i + 1}/${users.length} | Sent: ${successCount} | Stale: ${staleCount} | Error: ${errorCount}`);
            }
        }

        // Auto-cleanup stale tokens from DB
        if (staleTokenUserIds.length > 0) {
            await client.query(
                'UPDATE users SET fcm_token = NULL WHERE id = ANY($1::int[])',
                [staleTokenUserIds]
            );
            console.log(`\n🧹 Cleaned up ${staleTokenUserIds.length} stale/expired tokens from database.`);
        }

        console.log(`\n\n🎉 Notification Sending Complete!`);
        console.log(`✅ Actually Delivered: ${successCount}`);
        console.log(`🗑️  Stale/Expired Tokens Cleaned: ${staleCount}`);
        console.log(`❌ Other Errors: ${errorCount}`);

        if (successCount === 0 && staleCount > 0) {
            console.log('\n⚠️  ALL tokens were stale. This means users have either:');
            console.log('   1. Uninstalled the app, OR');
            console.log('   2. Are using an OLD version that has not yet re-registered a token.');
            console.log('   → Ask users to open and log in to the app again after updating.');
        }

    } catch (error) {
        console.error('🔥 Fatal error:', error);
    } finally {
        client.release();
        process.exit(0);
    }
};

sendGlobalUpdateNotification();
