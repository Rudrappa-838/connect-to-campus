const { broadcastNotification } = require('./src/services/notificationService');
const { pool } = require('./src/config/db');

async function sendUpdateAlert() {
    try {
        console.log("Sending 'Update App' notification to all users...");
        
        const result = await broadcastNotification(
            "🚀 App Update Available!",
            "A new version of Connect to Campus is available in the Play Store! Please update your app to access the new Gate Pass feature and performance improvements.",
            { type: "APP_UPDATE" }
        );
        
        console.log(`✅ Success! Notification sent to ${result.success} out of ${result.total} devices.`);
    } catch (e) {
        console.error("Failed to send update alert:", e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

sendUpdateAlert();
