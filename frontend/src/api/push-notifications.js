import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import api from './axios';

export const registerPushNotifications = async (userId) => {
    if (!Capacitor.isNativePlatform()) return;

    try {
        // 1. Request Permission
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            console.warn('User denied push notification permissions');
            return;
        }

        // 2. Register with FCM (Firebase)
        await PushNotifications.register();

        // 3. Create High Importance Channel for Android (Critical for tray visibility)
        if (Capacitor.getPlatform() === 'android') {
            PushNotifications.createChannel({
                id: 'school_notifications',
                name: 'School Notifications',
                description: 'Important announcements and alerts from school',
                importance: 5, // 5 = High (Tray + Popup)
                visibility: 1, // 1 = Public
                vibration: true,
            });
        }

        // 4. Token Registration Listener
        PushNotifications.addListener('registration', async (token) => {
            console.log('Push Registration Success, token:', token.value);
            try {
                await api.post('/notifications/token', { token: token.value, userId });
            } catch (err) {
                console.error('Failed to sync push token with backend:', err);
            }
        });

        // 5. Registration Error Listener
        PushNotifications.addListener('registrationError', (error) => {
            console.error('Error on push registration:', error);
        });

        // 6. Push Notification Received Listener (Foreground)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('Push received:', notification);
            
            // On Android, foreground push notifications are often not shown in the system tray. 
            // We use LocalNotifications to explicitly show them.
            if (Capacitor.getPlatform() === 'android') {
                LocalNotifications.schedule({
                    notifications: [
                        {
                            title: notification.title || "New Notification",
                            body: notification.body || "You have a new message",
                            id: Math.floor(Math.random() * 2147483647), // Must be an int32
                            schedule: { at: new Date(Date.now() + 200) },
                            extra: notification.data || null,
                            channelId: 'school_notifications'
                        }
                    ]
                });
            }
        });

        // 7. Push Notification Action Listener (Clicking the notification)
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('Push action performed:', notification);
            // Logic to navigate can be added here
        });

    } catch (error) {
        console.error('Push notification setup failed:', error);
    }
};
