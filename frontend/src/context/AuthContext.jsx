import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import api, { setAuthToken } from '../api/axios';
import toast from 'react-hot-toast';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { registerPushNotifications } from '../api/push-notifications';

const AuthContext = createContext(null);

// Roles that use WEB browser (session-only, auto-logout on inactivity/close)
const ADMIN_ROLES = ['SCHOOL_ADMIN', 'SUPER_ADMIN'];
// Inactivity timeout: 10 minutes for admin roles
const ADMIN_INACTIVITY_MS = 10 * 60 * 1000;

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const inactivityTimer = useRef(null);

    // Storage helpers:
    // - ADMIN roles → sessionStorage (cleared when browser tab/window closes)
    // - Mobile / Staff / Teacher / Student → Capacitor Preferences or localStorage (persistent)
    const isAdminRole = (role) => ADMIN_ROLES.includes(role);

    const getStorageItem = async (key, role) => {
        if (Capacitor.isNativePlatform()) {
            const { value } = await Preferences.get({ key });
            return value;
        }
        if (isAdminRole(role)) {
            return sessionStorage.getItem(key);
        }
        return localStorage.getItem(key);
    };

    const setStorageItem = async (key, value, role) => {
        if (Capacitor.isNativePlatform()) {
            await Preferences.set({ key, value });
        } else if (isAdminRole(role)) {
            sessionStorage.setItem(key, value);
        } else {
            localStorage.setItem(key, value);
        }
    };

    const removeStorageItem = async (key, role) => {
        if (Capacitor.isNativePlatform()) {
            await Preferences.remove({ key });
        } else {
            // Remove from both storages to be safe
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
        }
    };

    // Initial load - Restore session from storage
    useEffect(() => {
        const restoreSession = async () => {
            try {
                // Try sessionStorage first (for admin roles), then localStorage (for persistent roles)
                // On native platform, always use Capacitor Preferences
                let token = null;
                let storedUser = null;

                if (Capacitor.isNativePlatform()) {
                    const { value: t } = await Preferences.get({ key: 'token' });
                    const { value: u } = await Preferences.get({ key: 'user' });
                    token = t; storedUser = u;
                } else {
                    // Check sessionStorage first (admins)
                    token = sessionStorage.getItem('token');
                    storedUser = sessionStorage.getItem('user');
                    // If not in session, check localStorage (staff/teacher/student)
                    if (!token) {
                        token = localStorage.getItem('token');
                        storedUser = localStorage.getItem('user');
                    }
                }

                if (token && storedUser) {
                    try {
                        const parsedUser = JSON.parse(storedUser);
                        setAuthToken(token);
                        setUser(parsedUser);

                        // Start inactivity timer if admin
                        if (isAdminRole(parsedUser.role) && !Capacitor.isNativePlatform()) {
                            resetInactivityTimer(parsedUser);
                        }

                        if (Capacitor.isNativePlatform() && process.env.NODE_ENV === 'development') {
                            console.log(`[Auth] Session restored for ${parsedUser.email}`);
                        }

                        // Register for Push Notifications on Native platform
                        if (Capacitor.isNativePlatform()) {
                            registerPushNotifications(parsedUser.id);
                        }
                    } catch (e) {
                        console.error("Failed to parse stored user", e);
                    }
                }
            } catch (error) {
                console.error("Critical: Failed to restore session", error);
            } finally {
                setLoading(false);
            }
        };
        restoreSession();
    }, []);

    // Broadcast Channel for Multi-tab management (Web only)
    useEffect(() => {
        // Skip BroadcastChannel on mobile app - it causes logout issues
        if (Capacitor.isNativePlatform()) return;

        let channel = null;
        try {
            channel = new BroadcastChannel('school_auth_channel');
            channel.onmessage = (event) => {
                if (event.data.type === 'LOGIN_SUCCESS') {
                    if (user && event.data.userId === user.id) {
                        logout(false, true);
                        // window.close() removed to prevent "Scripts may close only..." error
                    }
                }
                if (event.data.type === 'LOGOUT') {
                    if (user && event.data.userId === user.id) {
                        logout(false, true);
                    }
                }
            };
        } catch (e) {
            console.warn('BroadcastChannel not supported');
        }

        return () => {
            if (channel) channel.close();
        };
    }, [user]);

    // ── Inactivity Timer (Admin only) ─────────────────────────────────────────
    const resetInactivityTimer = useCallback((currentUser) => {
        if (!currentUser || !isAdminRole(currentUser.role)) return;
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(() => {
            console.log('[Auth] Admin inactivity timeout - logging out');
            logout(true);
        }, ADMIN_INACTIVITY_MS);
    }, []);

    // Listen for user activity and reset timer (admin web only)
    useEffect(() => {
        if (!user || !isAdminRole(user.role) || Capacitor.isNativePlatform()) return;

        const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
        const handleActivity = () => resetInactivityTimer(user);

        events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
        resetInactivityTimer(user); // Start timer on mount

        return () => {
            events.forEach(e => window.removeEventListener(e, handleActivity));
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        };
    }, [user, resetInactivityTimer]);

    const login = async (email, password, role) => {
        try {
            const response = await api.post('/auth/login', { email, password, role });
            const { token, user: loggedInUser } = response.data;

            // If user must change password, DO NOT log them in globally yet.
            // Just return the signal so Login.jsx can redirect them.
            // ONLY for Student, Teacher, and Staff roles (per user request)
            if (loggedInUser.mustChangePassword && !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(loggedInUser.role)) {
                return { success: true, user: loggedInUser, requiresPasswordChange: true };
            }

            // CRITICAL: Set token in memory immediately to prevent race condition
            setAuthToken(token);

            // Save to correct storage based on role:
            // Admin → sessionStorage (cleared on browser close)
            // Others → persistent storage (localStorage / Capacitor Preferences)
            await setStorageItem('token', token, loggedInUser.role);
            await setStorageItem('user', JSON.stringify(loggedInUser), loggedInUser.role);

            setUser(loggedInUser);

            // Start inactivity timer for admin roles on web
            if (isAdminRole(loggedInUser.role) && !Capacitor.isNativePlatform()) {
                resetInactivityTimer(loggedInUser);
            }

            // Register for Push Notifications on Native platform
            if (Capacitor.isNativePlatform()) {
                registerPushNotifications(loggedInUser.id);
            }

            // Broadcast login to other tabs (web only) - kills old sessions for admins
            if (!Capacitor.isNativePlatform()) {
                try {
                    const channel = new BroadcastChannel('school_auth_channel');
                    channel.postMessage({ type: 'LOGIN_SUCCESS', userId: loggedInUser.id, role: loggedInUser.role });
                    channel.close();
                } catch (bcError) {
                    console.warn('BroadcastChannel suppressed:', bcError);
                }
            }

            return { success: true, user: loggedInUser };
        } catch (error) {
            console.error("Login failed", error);

            // Detailed error handling
            let errorMessage = 'Login failed';

            if (!error.response) {
                // Network error - no response from server
                if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                    errorMessage = '⏱️ Connection timeout. Please check your internet connection and try again.';
                } else if (error.message.includes('Network Error')) {
                    errorMessage = '🌐 Cannot connect to server. Please check your internet connection.';
                } else {
                    errorMessage = '❌ Network error. Please check your connection and try again.';
                }
            } else if (error.response.status === 401) {
                // Authentication error
                errorMessage = '🔒 Invalid credentials. Please check your ID/Email and password.';
            } else if (error.response.status === 403) {
                // Authorization error
                errorMessage = '⛔ Access denied. Role mismatch or insufficient permissions.';
            } else if (error.response?.data?.message) {
                // Use server's error message if available (CRITICAL FOR DEBUGGING 500 ERRORS)
                errorMessage = error.response.data.message;
            } else if (error.response.status === 500) {
                // Fallback only if no message provided
                errorMessage = '🔧 Server error. Please try again later or contact support.';
            }

            return {
                success: false,
                message: errorMessage
            };
        }
    };

    const logout = async (isAutoLogout = false, isRemote = false) => {
        const currentUser = user; // Capture before clearing
        try {
            if (!isRemote && !isAutoLogout) {
                // Broadcast logout to other tabs
                try {
                    const channel = new BroadcastChannel('school_auth_channel');
                    channel.postMessage({ type: 'LOGOUT', userId: currentUser?.id });
                    channel.close();
                } catch (e) { console.warn('BroadcastChannel suppressed inside logout'); }

                await api.post('/auth/logout');
            }
        } catch (error) {
            console.error("Logout API failed", error);
        } finally {
            // Clear inactivity timer
            if (inactivityTimer.current) {
                clearTimeout(inactivityTimer.current);
                inactivityTimer.current = null;
            }

            // Clear from both storages (safe for all roles)
            await removeStorageItem('token', currentUser?.role);
            await removeStorageItem('user', currentUser?.role);

            setAuthToken(null);
            setUser(null);

            if (isAutoLogout) {
                toast.error('⏰ Session expired due to inactivity. Please login again.');
            }
        }
    };

    // ── Summary of session strategy ───────────────────────────────────────────
    // SCHOOL_ADMIN / SUPER_ADMIN (Web browser):
    //   • sessionStorage → auto-cleared when browser closes
    //   • 10-min inactivity timer → auto-logout
    //   • BroadcastChannel → new login kills old session in other tabs
    // STUDENT / TEACHER / STAFF (Mobile app):
    //   • Capacitor Preferences (persistent) → survives app close
    //   • No auto-logout → manual logout only

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
