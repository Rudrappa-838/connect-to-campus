import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import axios from 'axios';

// Using dynamic version checking via @capacitor/app


const APP_VERSION_URL = 'https://connect2campus.co.in/api/app-version';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.rudrappa.connect2campus';

const AppUpdateChecker = () => {
    const [showUpdate, setShowUpdate] = useState(false);
    const [updateMessage, setUpdateMessage] = useState('');
    const [isMandatory, setIsMandatory] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [latestVersion, setLatestVersion] = useState(null);

    const checkVersion = useCallback(async () => {
        if (!Capacitor.isNativePlatform()) return;
        
        setIsChecking(true);
        try {
            // Get native version dynamically, fall back to robust default
            let currentVersionCode = 32;
            try {
                const info = await App.getInfo();
                currentVersionCode = parseInt(info.build, 10) || 32;
            } catch (e) {
                console.warn('Could not get native app info', e);
            }

            // Check server for minimum required version
            const res = await axios.get(`${APP_VERSION_URL}?t=${Date.now()}`, { timeout: 8000 });
            const { minimum_version, latest_version, update_message } = res.data;
            setLatestVersion(latest_version);

            // Check if this version was already dismissed
            const { value: dismissedVersion } = await Preferences.get({ key: 'dismissed_version' });

            if (currentVersionCode >= latest_version) {
                // Already updated! Hide everything
                setShowUpdate(false);
            } else if (currentVersionCode < minimum_version) {
                // MANDATORY update - must update to continue
                setIsMandatory(true);
                setUpdateMessage(update_message || 'A critical update is required. Please update the app.');
                setShowUpdate(true);
            } else if (currentVersionCode < latest_version) {
                // OPTIONAL update - suggest updating
                // Only show if this version hasn't been dismissed
                if (dismissedVersion !== latest_version.toString()) {
                    setIsMandatory(false);
                    setUpdateMessage('A new version is available. Update now for the best experience!');
                    setShowUpdate(true);
                }
            }
        } catch (err) {
            console.warn('Version check failed:', err.message);
        } finally {
            setIsChecking(false);
        }
    }, []);

    useEffect(() => {
        // Initial check
        const timer = setTimeout(checkVersion, 2000);

        // Listener: Re-check when user returns to app (e.g. from Play Store)
        const appStateListener = App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                console.log('App resumed, re-checking version...');
                checkVersion();
            }
        });

        return () => {
            clearTimeout(timer);
            appStateListener.then(l => l.remove());
        };
    }, [checkVersion]);

    const openPlayStore = () => {
        window.open(PLAY_STORE_URL, '_system');
    };

    const skipUpdate = async () => {
        if (latestVersion) {
            await Preferences.set({
                key: 'dismissed_version',
                value: latestVersion.toString()
            });
        }
        setShowUpdate(false);
    };

    if (!showUpdate) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
            backdropFilter: 'blur(4px)'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                padding: '32px 24px',
                maxWidth: '340px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}>
                {/* Icon */}
                <div style={{
                    width: '72px', height: '72px',
                    backgroundColor: '#0ea5e9',
                    borderRadius: '22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                    transform: 'rotate(-5deg)',
                    boxShadow: '0 10px 15px -3px rgba(14, 165, 233, 0.3)'
                }}>
                    <span style={{ fontSize: '32px' }}>{isChecking ? '⏳' : '🚀'}</span>
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: '22px', fontWeight: '800',
                    color: '#0f172a', margin: '0 0 12px'
                }}>
                    {isMandatory ? 'Update Required' : 'New Version Ready'}
                </h2>

                {/* Message */}
                <p style={{
                    fontSize: '15px', color: '#64748b',
                    lineHeight: '1.6', margin: '0 0 28px'
                }}>
                    {isChecking ? 'Checking for updates...' : updateMessage}
                </p>

                {/* Update Button */}
                <button
                    onClick={openPlayStore}
                    disabled={isChecking}
                    style={{
                        width: '100%',
                        padding: '16px',
                        backgroundColor: '#0ea5e9',
                        color: 'white',
                        border: 'none',
                        borderRadius: '14px',
                        fontSize: '16px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        marginBottom: isMandatory ? '0' : '12px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        opacity: isChecking ? 0.7 : 1
                    }}
                >
                    {isChecking ? 'Verifying...' : 'Update from Play Store'}
                </button>

                {/* Skip Button (only for optional updates) */}
                {!isMandatory && !isChecking && (
                    <button
                        onClick={skipUpdate}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: 'transparent',
                            color: '#94a3b8',
                            border: 'none',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        Maybe Later
                    </button>
                )}
                
                {isMandatory && !isChecking && (
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '15px' }}>
                        App will auto-refresh after update
                    </p>
                )}
            </div>
        </div>
    );
};

export default AppUpdateChecker;
