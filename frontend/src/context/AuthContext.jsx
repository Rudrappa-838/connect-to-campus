import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Storage helpers - use Capacitor Preferences on mobile, localStorage on web
    const getStorageItem = async (key) => {
        if (Capacitor.isNativePlatform()) {
            const { value } = await Preferences.get({ key });
            return value;
        }
        return localStorage.getItem(key);
    };

    const setStorageItem = async (key, value) => {
        if (Capacitor.isNativePlatform()) {
            await Preferences.set({ key, value });
        } else {
            localStorage.setItem(key, value);
        }
    };

    const removeStorageItem = async (key) => {
        if (Capacitor.isNativePlatform()) {
            await Preferences.remove({ key });
        } else {
            localStorage.removeItem(key);
        }
    };

    // Initial load - Restore session from storage
    useEffect(() => {
        const restoreSession = async () => {
            try {
                const token = await getStorageItem('token');
                const storedUser = await getStorageItem('user');

                if (token && storedUser) {
                    try {
                        const parsedUser = JSON.parse(storedUser);
                        setUser(parsedUser);
                        // DEBUG: Session Restore
                        if (Capacitor.isNativePlatform()) {
                            toast.success(`Debug: Session Restored. Role: ${parsedUser.role}`);
                        }
                    } catch (e) {
                        console.error("Failed to parse stored user", e);
                        await removeStorageItem('token');
                        await removeStorageItem('user');
                    }
                } else {
                    // DEBUG: No Session
                    if (Capacitor.isNativePlatform()) {
                        // toast('Debug: No session found on startup', { icon: 'ℹ️' });
                    }
                }
            } catch (error) {
                console.error("Failed to restore session", error);
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
                        try { window.close(); } catch (e) { }
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

    const login = async (email, password, role) => {
        try {
            const response = await api.post('/auth/login', { email, password, role });
            const { token, user } = response.data;

            // Save to storage (Capacitor Preferences on mobile, localStorage on web)
            await setStorageItem('token', token);
            await setStorageItem('user', JSON.stringify(user));
            setUser(user);

            // DEBUG: Login Success
            if (Capacitor.isNativePlatform()) {
                toast.success(`Debug: Login OK. Token Saved. Role: ${user.role}`);
            }

            // Broadcast (web only)
            if (!Capacitor.isNativePlatform()) {
                try {
                    const channel = new BroadcastChannel('school_auth_channel');
                    channel.postMessage({ type: 'LOGIN_SUCCESS', userId: user.id });
                    channel.close();
                } catch (bcError) {
                    console.warn('BroadcastChannel suppressed:', bcError);
                }
            }

            return { success: true, user };
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
        try {
            // DEBUG: Logout Called
            if (Capacitor.isNativePlatform()) {
                toast.error(`Debug: Logout Called. Auto:${isAutoLogout}, Remote:${isRemote}`);
            }

            if (!isRemote && !isAutoLogout) {
                // Broadcast
                try {
                    const channel = new BroadcastChannel('school_auth_channel');
                    channel.postMessage({ type: 'LOGOUT', userId: user?.id });
                    channel.close();
                } catch (e) { console.warn('BroadcastChannel suppressed inside logout'); }

                await api.post('/auth/logout');
            }
        } catch (error) {
            console.error("Logout API failed", error);
        } finally {
            await removeStorageItem('token');
            await removeStorageItem('user');
            setUser(null);
            if (isAutoLogout) alert("Session timed out due to inactivity.");
        }
    };

    // NO AUTO-LOGOUT - Users stay logged in until they manually logout
    // This is better for mobile apps where users expect to stay logged in

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
