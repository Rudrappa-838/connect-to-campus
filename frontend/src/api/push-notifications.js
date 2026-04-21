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

        // Also request LocalNotifications permission (Critical for Android 13+)
        let localPerm = await LocalNotifications.checkPermissions();
        if (localPerm.display === 'prompt') {
            localPerm = await LocalNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            console.warn('User denied push notification permissions');
            return;
        }

        // 2. Register with FCM (Firebase)
        await PushNotifications.register();

        // 3. Create High Importance Channel for Android (Critical for tray visibility)
        if (Capacitor.getPlatform() === 'android') {
            await PushNotifications.createChannel({
                id: 'school_notifications',
                name: 'School Notifications',
                description: 'Important announcements and alerts from school',
                importance: 5, // 5 = High (Tray + Popup)
                visibility: 1, // 1 = Public
                vibration: true,
                sound: 'default'
            });
        }

        // 4. Token Registration Listener
        PushNotifications.addListener('registration', async (token) => {
            console.log('Push Registration Success, token:', token.value);
            try {
                // Store token in localStorage for backup
                localStorage.setItem('fcm_token', token.value);
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
            console.log('Push received in foreground:', notification);
            
            // On Android, foreground push notifications are often not shown in the system tray automatically.
            // We force it using LocalNotifications.
            if (Capacitor.getPlatform() === 'android') {
                LocalNotifications.schedule({
                    notifications: [
                        {
                            title: notification.title || "New Message",
                            body: notification.body || "View details in the app",
                            id: Date.now() % 2147483647,
                            schedule: { at: new Date(Date.now() + 100) },
                            extra: notification.data || {},
                            channelId: 'school_notifications',
                            smallIcon: 'ic_stat_notification', // Common standard icon name
                            actionTypeId: 'OPEN_NOTIFICATIONS'
                        }
                    ]
                });
            }
        });

        // 7. Push Notification Action Listener
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('Push action performed:', notification);
            // Close the notification from tray
            PushNotifications.removeAllDeliveredNotifications();
        });

    } catch (error) {
        console.error('Push notification setup failed:', error);
    }
};
