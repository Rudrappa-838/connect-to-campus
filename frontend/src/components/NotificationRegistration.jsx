import React, { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const NotificationRegistration = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user || !Capacitor.isNativePlatform()) return;

        const setupNotifications = async () => {
            try {
                // 1. Request Push Notification permission
                let perm = await PushNotifications.checkPermissions();
                if (perm.receive !== 'granted') {
                    perm = await PushNotifications.requestPermissions();
                }
                if (perm.receive !== 'granted') return;

                // 2. Request Local Notification permission (for foreground tray display)
                await LocalNotifications.requestPermissions();

                // 3. Register with FCM
                await PushNotifications.register();

                // 4. Create High Importance Channel (WhatsApp-style)
                await PushNotifications.createChannel({
                    id: 'school_notifications',
                    name: 'School Notifications',
                    importance: 5,   // IMPORTANCE_HIGH
                    visibility: 1,   // VISIBILITY_PUBLIC
                    vibration: true,
                    sound: 'default',
                });

                // Also create channel for Local Notifications
                await LocalNotifications.createChannel({
                    id: 'school_notifications',
                    name: 'School Notifications',
                    importance: 5,
                    visibility: 1,
                    vibration: true,
                    sound: 'default',
                });

                // 5. Save FCM token to backend
                PushNotifications.addListener('registration', async (token) => {
                    console.log('FCM Token:', token.value);
                    try {
                        await api.post('/auth/register-fcm', { token: token.value });
                    } catch (err) {
                        console.error('Failed to save FCM token:', err);
                    }
                });

                // 6. Handle errors
                PushNotifications.addListener('registrationError', (err) => {
                    console.error('Push Registration Error:', err);
                });

                // 7. App OPEN (Foreground) - Show in SYSTEM NOTIFICATION BAR using Local Notifications
                PushNotifications.addListener('pushNotificationReceived', async (notification) => {
                    console.log('Push received in foreground:', notification);

                    try {
                        // Show as a REAL system notification in the tray
                        await LocalNotifications.schedule({
                            notifications: [
                                {
                                    id: Math.floor(Math.random() * 100000),
                                    title: notification.title || 'School Alert',
                                    body: notification.body || '',
                                    channelId: 'school_notifications',
                                    smallIcon: 'ic_launcher',
                                    iconColor: '#0ea5e9',
                                    sound: 'default',
                                    extra: notification.data || {}
                                }
                            ]
                        });
                    } catch (err) {
                        console.error('Local notification failed:', err);
                    }
                });

                // 8. Handle notification tap (background/closed)
                PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                    console.log('Notification tapped:', action);
                    // Navigate to alerts page if needed
                });

            } catch (error) {
                console.error('Notification Setup Failed:', error);
            }
        };

        setupNotifications();

        return () => {
            PushNotifications.removeAllListeners();
        };
    }, [user]);

    return null;
};

export default NotificationRegistration;
