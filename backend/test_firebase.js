const { sendPushNotification } = require('./src/services/firebaseService');

console.log("🔥 Testing Firebase Init...");

// Just requiring the service triggers the init logic in the file
// We can check if it logged success/failure by running this.
// If it failed, sendPushNotification will log "PUSH NOTIFICATION (LOG ONLY)"

async function test() {
    await sendPushNotification('test-token', 'Test Title', 'Test Body');
}

test();
