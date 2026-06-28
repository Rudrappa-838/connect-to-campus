import { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import axios from 'axios';

const APP_VERSION_URL = 'https://connect2campus.co.in/api/app-version';
const PLAY_STORE_URL  = 'https://play.google.com/store/apps/details?id=com.rudrappa.connect2campus';

// Key used to track: user tapped "Later" this session so don't re-ask WITHIN the same app open.
// When app is put to background and comes back → ask again.
const SESSION_ASKED_KEY = 'update_asked_this_session';

const AppUpdateChecker = () => {
    const [showUpdate, setShowUpdate]     = useState(false);
    const [updateMessage, setUpdateMessage] = useState('');
    const [isMandatory, setIsMandatory]   = useState(false);
    const [isChecking, setIsChecking]     = useState(false);
    const [latestVersion, setLatestVersion] = useState(null);

    // Track whether user tapped "Later" in this current app-open session
    const laterThisSession = useRef(false);

    const checkVersion = useCallback(async (isResume = false) => {
        if (!Capacitor.isNativePlatform()) return;

        // If user tapped "Later" this session and this is a resume check, show again
        // This is exactly the behavior: ask again when they return to the app
        if (isResume && laterThisSession.current) {
            // Reset so we show the dialog again when they come back
            laterThisSession.current = false;
        } else if (!isResume && laterThisSession.current) {
            // Within the same open session after "Later" — don't re-ask
            return;
        }

        setIsChecking(true);
        try {
            // Get native versionCode from the app
            let currentVersionCode = 44;
            try {
                const info = await App.getInfo();
                currentVersionCode = parseInt(info.build, 10) || 44;
            } catch (e) {
                console.warn('Could not get native app info', e);
            }

            const res = await axios.get(`${APP_VERSION_URL}?t=${Date.now()}`, { timeout: 8000 });
            const { minimum_version, latest_version, update_message } = res.data;
            setLatestVersion(latest_version);

            if (currentVersionCode >= latest_version) {
                // Already on latest — show nothing
                setShowUpdate(false);
            } else if (currentVersionCode < minimum_version) {
                // MANDATORY: below minimum — must update, no "Later" option
                setIsMandatory(true);
                setUpdateMessage(update_message || 'A critical update is required to continue.');
                setShowUpdate(true);
            } else {
                // OPTIONAL: newer version available — show "Update Now" or "Later"
                setIsMandatory(false);
                setUpdateMessage(update_message || `Version ${latest_version} is available with new features & improvements. Update now for the best experience!`);
                setShowUpdate(true);
            }
        } catch (err) {
            console.warn('Version check failed (offline?):', err.message);
        } finally {
            setIsChecking(false);
        }
    }, []);

    useEffect(() => {
        // Check 2s after first open
        const timer = setTimeout(() => checkVersion(false), 2000);

        // When user comes BACK to the app (from background or Play Store):
        // → if they previously tapped "Later", show the dialog again
        const listenerPromise = App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                console.log('[UpdateChecker] App resumed — re-checking version...');
                checkVersion(true); // isResume = true → will re-show if user tapped "Later"
            }
        });

        return () => {
            clearTimeout(timer);
            listenerPromise.then(l => l.remove());
        };
    }, [checkVersion]);

    const openPlayStore = () => {
        window.open(PLAY_STORE_URL, '_system');
    };

    // "Later" — hide for now, but set flag so it shows again when app is resumed
    const handleLater = () => {
        laterThisSession.current = true; // Mark that user said Later this session
        setShowUpdate(false);
        console.log('[UpdateChecker] User tapped "Later" — will re-ask on next app resume.');
    };

    if (!showUpdate) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
            backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '28px',
                padding: '36px 24px 28px',
                maxWidth: '340px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
            }}>
                {/* Icon */}
                <div style={{
                    width: '76px', height: '76px',
                    background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)',
                    borderRadius: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                    boxShadow: '0 12px 24px rgba(79, 70, 229, 0.35)'
                }}>
                    <span style={{ fontSize: '36px' }}>🚀</span>
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: '22px', fontWeight: '800',
                    color: '#0f172a', margin: '0 0 10px',
                    letterSpacing: '-0.5px'
                }}>
                    {isMandatory ? '⚠️ Update Required' : '✨ New Version Available'}
                </h2>

                {/* Version badge */}
                {latestVersion && (
                    <div style={{
                        display: 'inline-block',
                        background: '#f0fdf4',
                        color: '#16a34a',
                        borderRadius: '999px',
                        padding: '4px 14px',
                        fontSize: '12px',
                        fontWeight: '700',
                        marginBottom: '14px',
                        border: '1px solid #bbf7d0'
                    }}>
                        Version {latestVersion}
                    </div>
                )}

                {/* Message */}
                <p style={{
                    fontSize: '14px', color: '#64748b',
                    lineHeight: '1.65', margin: '0 0 28px'
                }}>
                    {updateMessage}
                </p>

                {/* Update Now button */}
                <button
                    onClick={openPlayStore}
                    style={{
                        width: '100%',
                        padding: '16px',
                        background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '16px',
                        fontSize: '16px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        marginBottom: isMandatory ? '0' : '12px',
                        boxShadow: '0 6px 20px rgba(79,70,229,0.35)'
                    }}
                >
                    🔄 Update Now
                </button>

                {/* "Later" — only for optional updates */}
                {!isMandatory && (
                    <button
                        onClick={handleLater}
                        style={{
                            width: '100%',
                            padding: '13px',
                            backgroundColor: 'transparent',
                            color: '#94a3b8',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: '14px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        Maybe Later
                    </button>
                )}

                {isMandatory && (
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '14px', lineHeight: 1.5 }}>
                        You must update to continue using the app.
                    </p>
                )}
            </div>
        </div>
    );
};

export default AppUpdateChecker;
