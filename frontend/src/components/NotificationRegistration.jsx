import React, { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

const NotificationRegistration = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user || !Capacitor.isNativePlatform()) return;

        const setupNotifications = async () => {
            try {
                // Request permission
                let perm = await PushNotifications.checkPermissions();
                if (perm.receive !== 'granted') {
                    perm = await PushNotifications.requestPermissions();
                }

                if (perm.receive !== 'granted') return;

                // Register with FCM/APNS
                await PushNotifications.register();

                // Create High Importance Channel for "WhatsApp-style" heads-up notifications
                await PushNotifications.createChannel({
                    id: 'school_notifications',
                    name: 'School Notifications',
                    importance: 5, // HIGH
                    visibility: 1, // PUBLIC
                    vibration: true,
                });

                // Listen for successful registration
                PushNotifications.addListener('registration', async (token) => {
                    console.log('Push Registration Success. Token:', token.value);
                    try {
                        await api.post('/auth/register-fcm', { token: token.value });
                    } catch (err) {
                        console.error('Failed to sync FCM token with backend', err);
                    }
                });

                // Listen for errors
                PushNotifications.addListener('registrationError', (err) => {
                    console.error('Push Registration Error:', err);
                });

                // Handle incoming notifications (Foreground)
                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    console.log('Notification Received (Foreground):', notification);
                    // Show Popup
                    toast(
                        (t) => (
                            <div className="flex items-start gap-3" onClick={() => toast.dismiss(t.id)}>
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm text-slate-800">{notification.title}</h4>
                                    <p className="text-xs text-slate-500 mt-1">{notification.body}</p>
                                </div>
                            </div>
                        ),
                        { duration: 5000, position: 'top-center', style: { borderRadius: '16px', background: 'white', color: '#333', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } }
                    );
                });

                // Handle notification clicks
                PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                    console.log('Notification Clicked:', action);
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

    return null; // Invisible component
};

export default NotificationRegistration;
