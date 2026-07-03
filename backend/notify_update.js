require('dotenv').config({ path: __dirname + '/.env' });
const { broadcastNotification } = require('./src/services/notificationService');

const sendUpdateBroadcast = async () => {
    try {
        console.log("🚀 Broadcasting 'Update App' notification to ALL users...");
        
        const result = await broadcastNotification(
            "🚀 App Update Available!",
            "A new version of the app is now available! Please update your app from the Play Store to get the latest features and bug fixes.",
            { type: 'APP_UPDATE', link: 'market://details?id=com.rudrappa.connect2campus' }
        );
        
        console.log(`✅ Broadcast complete!`);
        console.log(`   Total Users Checked: ${result.total}`);
        console.log(`   Successfully Sent: ${result.success}`);
    } catch (error) {
        console.error("❌ Failed to broadcast update:", error);
    } finally {
        process.exit();
    }
};

sendUpdateBroadcast();
