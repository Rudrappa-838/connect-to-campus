const { sendPushNotification } = require('./src/services/firebaseService');

const token = 'd7DHxnU2RlamEJEp6iKzqA:APA91bEJ_CjNO-e_AmxhYj2tfuSfuaB1A6-XbsLegvKKqit4acDJYi--ipzM8JDfTz3GuhcK-roqiGbDNKaJeGcKzeFEOLnJcczFpN38qo7c1LAGiVP_NlI';

async function sendTest() {
    console.log('🚀 Sending REAL test notification to device...');
    const result = await sendPushNotification(
        token, 
        'System Tray Test ✅', 
        'If you see this, your notifications are working perfectly in the top bar!',
        { type: 'TEST' },
        1
    );
    console.log('Result:', result);
}

sendTest();
