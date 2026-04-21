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

const isAdminRole = (role) => ADMIN_ROLES.includes(role);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const inactivityTimer = useRef(null);
    
    // Stable reference for user to avoid dependency loops in callbacks
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);

    // ── Storage helpers ──────────────────────────────────────────────────────
    const setStorageItem = useCallback(async (key, value, role) => {
        if (Capacitor.isNativePlatform()) {
            await Preferences.set({ key, value });
        } else if (isAdminRole(role)) {
            sessionStorage.setItem(key, value);
        } else {
            localStorage.setItem(key, value);
        }
    }, []);

    const removeStorageItem = useCallback(async (key) => {
        if (Capacitor.isNativePlatform()) {
            await Preferences.remove({ key });
        } else {
            // Remove from both storages to be safe
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
        }
    }, []);

    // ── Core Methods ──────────────────────────────────────────────────────────
    const logout = useCallback(async (isAutoLogout = false, isRemote = false) => {
        const currentUser = userRef.current; // Use stable ref
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
            await removeStorageItem('token');
            await removeStorageItem('user');

            setAuthToken(null);
            setUser(null);

            if (isAutoLogout) {
                toast.error('⏰ Session expired due to inactivity. Please login again.');
            }
        }
    }, [removeStorageItem]);

    const login = async (email, password, role) => {
        try {
            const response = await api.post('/auth/login', { email, password, role });
            const { token, user: loggedInUser } = response.data;

            if (loggedInUser.mustChangePassword && !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(loggedInUser.role)) {
                return { success: true, user: loggedInUser, requiresPasswordChange: true };
            }

            setAuthToken(token);
            await setStorageItem('token', token, loggedInUser.role);
            await setStorageItem('user', JSON.stringify(loggedInUser), loggedInUser.role);

            setUser(loggedInUser);

            if (isAdminRole(loggedInUser.role) && !Capacitor.isNativePlatform()) {
                resetInactivityTimer(loggedInUser);
            }

            if (Capacitor.isNativePlatform()) {
                registerPushNotifications(loggedInUser.id);
            }

            if (!Capacitor.isNativePlatform()) {
                try {
                    const channel = new BroadcastChannel('school_auth_channel');
                    channel.postMessage({ type: 'LOGIN_SUCCESS', userId: loggedInUser.id, role: loggedInUser.role });
                    channel.close();
                } catch (bcError) { /* ignore */ }
            }

            return { success: true, user: loggedInUser };
        } catch (error) {
            console.error("Login failed", error);
            let errorMessage = error.response?.data?.message || 'Login failed';
            return { success: false, message: errorMessage };
        }
    };

    // ── Utility Methods (High Level) ──────────────────────────────────────────
    const resetInactivityTimer = useCallback((currentUser) => {
        if (!currentUser || !isAdminRole(currentUser.role)) return;
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        inactivityTimer.current = setTimeout(() => {
            console.log('[Auth] Admin inactivity timeout - logging out');
            logout(true);
        }, ADMIN_INACTIVITY_MS);
    }, [logout]);

    // ── Final logic / Effects ──────────────────────────────────────────────────
    
    // 1. Session Restoration
    useEffect(() => {
        const restoreSession = async () => {
            try {
                let token = null;
                let storedUser = null;

                if (Capacitor.isNativePlatform()) {
                    const { value: t } = await Preferences.get({ key: 'token' });
                    const { value: u } = await Preferences.get({ key: 'user' });
                    token = t; storedUser = u;
                } else {
                    token = sessionStorage.getItem('token') || localStorage.getItem('token');
                    storedUser = sessionStorage.getItem('user') || localStorage.getItem('user');
                }

                if (token && storedUser) {
                    try {
                        const parsedUser = JSON.parse(storedUser);
                        setAuthToken(token);
                        setUser(parsedUser);
                        if (isAdminRole(parsedUser.role) && !Capacitor.isNativePlatform()) {
                            resetInactivityTimer(parsedUser);
                        }
                        if (Capacitor.isNativePlatform()) {
                            registerPushNotifications(parsedUser.id);
                        }
                    } catch (e) {
                         console.error("Failed to parse stored user", e);
                    }
                }
            } catch (error) {
                console.error("Failed to restore session", error);
            } finally {
                setLoading(false);
            }
        };
        restoreSession();
    }, [resetInactivityTimer]);

    // 2. Broadcast Listener
    useEffect(() => {
        if (Capacitor.isNativePlatform()) return;
        let channel = null;
        try {
            channel = new BroadcastChannel('school_auth_channel');
            channel.onmessage = (e) => {
                if (user && e.data.userId === user.id) logout(false, true);
            };
        } catch (e) { /* ignore */ }
        return () => { if (channel) channel.close(); };
    }, [user, logout]);

    // 3. User Activity Listener
    useEffect(() => {
        if (!user || !isAdminRole(user.role) || Capacitor.isNativePlatform()) return;
        const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
        const handleActivity = () => resetInactivityTimer(user);
        events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
        resetInactivityTimer(user);
        return () => {
            events.forEach(e => window.removeEventListener(e, handleActivity));
            if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        };
    }, [user, resetInactivityTimer]);

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {(!loading || Capacitor.isNativePlatform()) ? children : null}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
