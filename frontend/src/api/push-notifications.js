import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import api from './axios';

export const registerPushNotifications = async (userId) => {
    if (!Capacitor.isNativePlatform()) return;

    try {
        // 0. Remove ALL previous listeners first (critical for multi-user on same device)
        //    Without this, every login stacks new listeners → duplicate notifications
        await PushNotifications.removeAllListeners();

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

        // 2. Create High Importance Channel for Android (Critical for tray visibility)
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

        // Helper to sync token to backend and update local caches
        const syncToken = async (fcmToken) => {
            if (!fcmToken || !userId) return;
            try {
                localStorage.setItem('fcm_token', fcmToken);
                try {
                    const { Preferences } = await import('@capacitor/preferences');
                    await Preferences.set({ key: 'fcm_token', value: fcmToken });
                } catch (pe) { /* ignore */ }
                await api.post('/notifications/token', { token: fcmToken, userId });
                console.log(`[PUSH] Device token linked to userId ${userId}`);
            } catch (err) {
                console.error('Failed to sync push token with backend:', err);
            }
        };

        // 3. Token Registration Listener (MUST be registered BEFORE PushNotifications.register())
        PushNotifications.addListener('registration', async (token) => {
            console.log('Push Registration Success, token:', token.value, 'for userId:', userId);
            await syncToken(token.value);
        });

        // 4. Registration Error Listener
        PushNotifications.addListener('registrationError', (error) => {
            console.error('Error on push registration:', error);
        });

        // 5. Push Notification Received Listener (Foreground)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('Push received in foreground:', notification);

            // Safety check: If payload specifies a target userId, ignore if it doesn't match active user
            const payloadUserId = notification.data?.userId || notification.data?.user_id;
            if (payloadUserId && String(payloadUserId) !== String(userId)) {
                console.warn(`[PUSH IGNORED] Notification for user ${payloadUserId} does not match active user ${userId}`);
                return;
            }

            if (Capacitor.getPlatform() === 'android') {
                LocalNotifications.schedule({
                    notifications: [
                        {
                            title: notification.title || 'New Message',
                            body: notification.body || 'View details in the app',
                            id: Date.now() % 2147483647,
                            schedule: { at: new Date(Date.now() + 100) },
                            extra: notification.data || {},
                            channelId: 'school_notifications',
                            autoCancel: false, // Do not auto-dismiss on click
                            actionTypeId: 'OPEN_NOTIFICATIONS'
                        }
                    ]
                });
            }
        });

        // 6. Push Notification Action Listener
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('Push action performed:', notification);
        });

        // 7. Check if device already has a cached token from previous run
        //    (Capacitor's register() does not always re-trigger 'registration' if token hasn't changed)
        let existingToken = localStorage.getItem('fcm_token');
        if (!existingToken) {
            try {
                const { Preferences } = await import('@capacitor/preferences');
                const { value } = await Preferences.get({ key: 'fcm_token' });
                existingToken = value;
            } catch (e) { /* ignore */ }
        }
        if (existingToken) {
            await syncToken(existingToken);
        }

        // 8. Register with FCM (Firebase)
        await PushNotifications.register();

    } catch (error) {
        console.error('Push notification setup failed:', error);
    }
};
