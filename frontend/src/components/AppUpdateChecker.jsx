import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import axios from 'axios';

// ⚠️ UPDATE THIS to match versionCode in android/app/build.gradle
const CURRENT_VERSION_CODE = 21;


const APP_VERSION_URL = 'https://connect2campus.co.in/api/app-version';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.rudrappa.connect2campus';

const AppUpdateChecker = () => {
    const [showUpdate, setShowUpdate] = useState(false);
    const [updateMessage, setUpdateMessage] = useState('');
    const [isMandatory, setIsMandatory] = useState(false);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const checkVersion = async () => {
            try {
                const currentVersionCode = CURRENT_VERSION_CODE;


                // Check server for minimum required version
                const res = await axios.get(APP_VERSION_URL, { timeout: 5000 });
                const { minimum_version, latest_version, update_message } = res.data;

                if (currentVersionCode < minimum_version) {
                    // MANDATORY update - must update to continue
                    setIsMandatory(true);
                    setUpdateMessage(update_message || 'A critical update is required. Please update the app.');
                    setShowUpdate(true);
                } else if (currentVersionCode < latest_version) {
                    // OPTIONAL update - suggest updating
                    setIsMandatory(false);
                    setUpdateMessage('A new version is available. Update now for the best experience!');
                    setShowUpdate(true);
                }
            } catch (err) {
                // Silently fail - don't block app if version check fails
                console.warn('Version check failed:', err.message);
            }
        };

        // Check after 3 seconds (let the app load first)
        const timer = setTimeout(checkVersion, 3000);
        return () => clearTimeout(timer);
    }, []);

    const openPlayStore = () => {
        window.open(PLAY_STORE_URL, '_system');
    };

    if (!showUpdate) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '28px 24px',
                maxWidth: '340px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
                {/* Icon */}
                <div style={{
                    width: '64px', height: '64px',
                    backgroundColor: '#0ea5e9',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px'
                }}>
                    <span style={{ fontSize: '28px' }}>🔄</span>
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: '20px', fontWeight: '700',
                    color: '#1e293b', margin: '0 0 10px'
                }}>
                    {isMandatory ? 'Update Required' : 'Update Available'}
                </h2>

                {/* Message */}
                <p style={{
                    fontSize: '14px', color: '#64748b',
                    lineHeight: '1.6', margin: '0 0 24px'
                }}>
                    {updateMessage}
                </p>

                {/* Update Button */}
                <button
                    onClick={openPlayStore}
                    style={{
                        width: '100%',
                        padding: '14px',
                        backgroundColor: '#0ea5e9',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        marginBottom: isMandatory ? '0' : '10px'
                    }}
                >
                    Update Now
                </button>

                {/* Skip Button (only for optional updates) */}
                {!isMandatory && (
                    <button
                        onClick={() => setShowUpdate(false)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: 'transparent',
                            color: '#94a3b8',
                            border: 'none',
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    >
                        Maybe Later
                    </button>
                )}
            </div>
        </div>
    );
};

export default AppUpdateChecker;
