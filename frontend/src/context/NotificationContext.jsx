import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const lastNotificationIdRef = useRef(null);

    // Sync badge count with app unread count
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            try {
                PushNotifications.setBadgeCount({ count: unreadCount });
            } catch (err) {
                console.warn('Failed to set badge count:', err);
            }
        }
    }, [unreadCount]);

    const fetchNotifications = async (showToast = false) => {
        if (!user) return;

        try {
            const res = await api.get('/notifications');

            // Handle response safely
            const data = Array.isArray(res.data) ? res.data : [];

            // Only keep UNREAD notifications in the list (No History mode)
            const unreadItems = data.filter(n => !n.is_read);
            const sorted = unreadItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setNotifications(sorted);
            setUnreadCount(sorted.length);

            // Toast for new notification
            if (showToast && sorted.length > 0) {
                const latest = sorted[0];
                if (lastNotificationIdRef.current && latest.id !== lastNotificationIdRef.current && !latest.is_read) {
                    toast(latest.message, {
                        icon: '🔔',
                        duration: 4000
                    });
                }
            }

            if (sorted.length > 0) {
                lastNotificationIdRef.current = sorted[0].id;
            }

        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    const markAsRead = async (id) => {
        try {
            await api.put(`/notifications/${id}/read`);

            // Clean Inbox Mode: Remove from list immediately
            setNotifications(prev => prev.filter(n => n.id !== id));
            setUnreadCount(prev => Math.max(0, prev - 1));

        } catch (error) {
            console.error('Failed to mark read:', error);
        }
    };

    const markAllAsRead = async () => {
        // Optimistic UI: Update local state immediately
        const previousNotifications = notifications;
        const previousCount = unreadCount;
        
        setNotifications([]);
        setUnreadCount(0);

        try {
            await api.put(`/notifications/mark-all-read`);
        } catch (error) {
            console.error('Failed to mark all read:', error);
            // Rollback if API fails
            setNotifications(previousNotifications);
            setUnreadCount(previousCount);
            toast.error('Failed to sync notification status with server');
        }
    };

    // Poll for notifications and listen for live pushes
    useEffect(() => {
        if (user) {
            // 1. Initial Fetch
            const initialFetchTimer = setTimeout(() => {
                fetchNotifications(false);
            }, 200);

            // 2. Regular interval refresh
            const interval = setInterval(() => {
                fetchNotifications(true);
            }, 10000);

            // 3. LISTEN for live pushes to refresh count INSTANTLY
            let pushListener = null;
            if (Capacitor.isNativePlatform()) {
                pushListener = PushNotifications.addListener('pushNotificationReceived', () => {
                    fetchNotifications(true); // Refresh count immediately on new push
                });
            }

            return () => {
                clearTimeout(initialFetchTimer);
                clearInterval(interval);
                if (pushListener) pushListener.remove();
            };
        }
    }, [user]);

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications }}>
            {children}
        </NotificationContext.Provider>
    );
};
