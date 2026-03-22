import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

const OfflineBanner = () => {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        // Initial check
        const checkStatus = async () => {
            if (Capacitor.isNativePlatform()) {
                const status = await Network.getStatus();
                setIsOffline(!status.connected);
            } else {
                setIsOffline(!navigator.onLine);
            }
        };

        checkStatus();

        // Listen for changes
        let listener = null;

        if (Capacitor.isNativePlatform()) {
            const setupListener = async () => {
                listener = await Network.addListener('networkStatusChange', status => {
                    setIsOffline(!status.connected);
                });
            };
            setupListener();
        } else {
            const handleOnline = () => setIsOffline(false);
            const handleOffline = () => setIsOffline(true);

            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            return () => {
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            };
        }

        return () => {
            if (listener) {
                listener.remove();
            }
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[100] animate-slide-up">
            <div className="bg-red-600 text-white px-4 py-3 shadow-2xl flex items-center justify-center gap-3">
                <WifiOff size={20} className="animate-pulse" />
                <span className="font-bold text-sm sm:text-base">
                    You are offline. Please connect to internet 📡❌
                </span>
            </div>
        </div>
    );
};

export default OfflineBanner;
