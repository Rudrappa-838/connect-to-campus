const { broadcastNotification } = require('../src/services/notificationService');
const { pool } = require('../src/config/db');

async function run() {
    try {
        console.log('🚀 Starting Broadcast: App Update Required');
        
        const title = "New Version Available! 🚀";
        const body = "A major update for Connect to Campus is now on the Play Store. Please update your app to the latest version for new features and fixes.";
        
        const result = await broadcastNotification(title, body, { 
            type: 'APP_UPDATE',
            url: 'https://play.google.com/store/apps/details?id=com.school.connecttocampus' // Assuming this is the ID
        });
        
        console.log(`✅ Broadcast complete. Sent to ${result.success} out of ${result.total} devices.`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Broadcast failed:', error);
        process.exit(1);
    }
}

run();
