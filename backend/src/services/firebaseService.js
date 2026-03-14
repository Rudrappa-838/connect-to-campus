const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let messaging = null;

const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
    try {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        messaging = admin.messaging();
        console.log('Firebase Admin initialized from File');
    } catch (error) {
        console.error('Failed to initialize Firebase Admin from File:', error);
    }
} else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                // Handle private key newlines for ENV
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
        });
        messaging = admin.messaging();
        console.log('Firebase Admin initialized from Environment Variables');
    } catch (error) {
        console.error('Failed to initialize Firebase Admin from Env:', error);
    }
} else {
    console.log('Firebase Credentials not found (File or Env). Push notifications disabled.');
}

/**
 * Send push notification to a specific token
 */
const sendPushNotification = async (token, title, body, data = {}, badge = null) => {
    if (!token) return;

    const message = {
        notification: {
            title,
            body
        },
        android: {
            priority: 'high',
            ttl: 86400000, // 24 hours in milliseconds
            notification: {
                channelId: 'school_notifications', // Matches the channel created in frontend
                color: '#0ea5e9',
                sticky: false,
                visibility: 'public',
                notificationCount: badge ? parseInt(badge) : undefined,
                defaultSound: true,
                defaultVibrateTimings: true,
                priority: 'max' // Use 'max' for Android-specific priority
            }
        },
        apns: {
            payload: {
                aps: {
                    badge: badge ? parseInt(badge) : undefined,
                    sound: 'default',
                    'content-available': 1 // For background delivery
                }
            }
        },
        data: {
            ...data,
            click_action: 'OPEN_NOTIFICATIONS'
        },
        token
    };

    if (messaging) {
        try {
            const response = await messaging.send(message);
            console.log('Successfully sent push notification:', response);
            return response;
        } catch (error) {
            console.error('Error sending push notification:', error);
            return null;
        }
    } else {
        console.log('--- PUSH NOTIFICATION (LOG ONLY) ---');
        console.log(`To: ${token}`);
        console.log(`Title: ${title}`);
        console.log(`Body: ${body}`);
        console.log('------------------------------------');
        return 'LOGGED';
    }
};

module.exports = {
    sendPushNotification
};
