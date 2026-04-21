const { pool } = require('./backend/src/config/db');
const { sendPushNotification } = require('./backend/src/services/notificationService');

async function testResolution() {
    console.log('--- Testing Notification Resolution ---');
    
    // Test resolving a student
    console.log('Testing Student resolution...');
    await sendPushNotification('1', 'Test', 'Body', 'Student');

    // Test resolving a teacher
    console.log('Testing Teacher resolution...');
    await sendPushNotification('1', 'Test', 'Body', 'Teacher');

    // Test resolving a staff
    console.log('Testing Staff resolution...');
    await sendPushNotification('1', 'Test', 'Body', 'Staff');

    console.log('Done. Check console for [PUSH RESOLVED] logs.');
    process.exit(0);
}

testResolution();
