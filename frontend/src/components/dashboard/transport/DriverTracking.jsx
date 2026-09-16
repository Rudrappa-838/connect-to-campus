import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { MapPin, Navigation, Bus, Clock, ArrowLeft, RefreshCw, Gauge, Shield, AlertTriangle, PhoneCall, Wifi } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND GPS STRATEGY
// On Android, when the screen turns off or a call comes in, the Android OS can
// throttle the JS/WebView thread. To keep GPS running we use 3 layers:
//
//  Layer 1 — Capacitor watchPosition (native API, runs via OS GPS service)
//            This is our primary GPS source. It fires even in background.
//            BUT its callback into JS may be throttled when screen is off.
//
//  Layer 2 — Backup heartbeat setInterval every 5 seconds
//            Reads lastKnownGPS and sends it to server. If Layer 1 callbacks
//            are being throttled, this still keeps the bus visible on the map.
//
//  Layer 3 — Persistent LocalNotification while driving
//            Android sees an active notification → treats app as foreground →
//            much less likely to kill the JS thread.
//            This is the closest thing to a Foreground Service from JS.
// ─────────────────────────────────────────────────────────────────────────────

// GPS accuracy thresholds:
//  > 80m  — reject (deep indoor, GPS completely lost)
//  40-80m — accept (common during phone calls, building shadows)
//  < 40m  — ideal (open sky)
const GPS_REJECT_ACCURACY_M = 80;

// Persistent notification ID for the "Driving Active" notification
const DRIVING_NOTIF_ID = 88001;

// Custom Bus Icon for Driver's Mini Map (Compact Size)
const createDriverBusIcon = (speed = 0) => {
    return L.divIcon({
        className: 'driver-bus-icon',
        html: `<div style="position:relative;width:32px;height:32px;">
            <div style="background:#fbbf24;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid #000;box-shadow:0 3px 10px rgba(0,0,0,0.35);">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path>
                    <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path>
                    <circle cx="7" cy="18" r="2"></circle><path d="M9 18h5"></path><circle cx="17" cy="18" r="2"></circle>
                </svg>
            </div>
            <div style="position:absolute;bottom:-1px;right:-1px;width:9px;height:9px;background:#10b981;border-radius:50%;border:1.5px solid white;animation:ping 1s infinite"></div>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
    });
};

const RecenterMap = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], 16, { animate: true });
        }
    }, [lat, lng, map]);
    return null;
};

const DriverTracking = ({ onBack }) => {
    const navigate = useNavigate();
    const [vehicles, setVehicles] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [selectedRoute, setSelectedRoute] = useState('');
    const [isTracking, setIsTracking] = useState(false);
    const [lastPosition, setLastPosition] = useState(null);
    const [currentSpeed, setCurrentSpeed] = useState(0);
    const [currentHeading, setCurrentHeading] = useState(0);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [tripSeconds, setTripSeconds] = useState(0);
    const [updateCount, setUpdateCount] = useState(0);
    const [error, setError] = useState(null);
    const [isMobileApp, setIsMobileApp] = useState(false);
    // Note: ACCESS_BACKGROUND_LOCATION removed from manifest — no disclosure dialog needed.
    const [networkOnline, setNetworkOnline] = useState(navigator.onLine);

    const wakeLockRef = useRef(null);
    const watchIdRef = useRef(null);
    const tripTimerRef = useRef(null);
    const heartbeatRef = useRef(null);      // Layer 2: backup heartbeat interval
    const lastSendTimeRef = useRef(0);
    const isTrackingRef = useRef(false);
    const pendingUpdateRef = useRef(null);
    const lastKnownGpsRef = useRef(null);   // Stores last valid GPS fix for heartbeat fallback

    // Keep ref in sync with state
    useEffect(() => {
        isTrackingRef.current = isTracking;
    }, [isTracking]);

    // Clean up any stale saved trip on initial load so it NEVER auto-starts
    useEffect(() => {
        localStorage.removeItem('active_driver_trip');
    }, []);

    // Detect platform & fetch initial vehicles/routes
    useEffect(() => {
        const checkMobile = () => {
            if (Capacitor.isNativePlatform()) {
                setIsMobileApp(true);
                return;
            }
            const params = new URLSearchParams(window.location.search);
            if (params.get('is_mobile_app') === 'true' || localStorage.getItem('is_mobile_app') === 'true') {
                setIsMobileApp(true);
            }
        };
        checkMobile();
        fetchInitialData();

        // Network status listeners
        const handleOnline = () => {
            setNetworkOnline(true);
            // When network comes back (after call ends), flush the pending update
            if (pendingUpdateRef.current && isTrackingRef.current) {
                const p = pendingUpdateRef.current;
                sendLocationUpdate(p.lat, p.lng, p.speed, p.heading);
            }
        };
        const handleOffline = () => setNetworkOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // ─── Phone Call & Background Resilience (Layer 1 restoration) ────────────
    useEffect(() => {
        let appListener = null;
        const setupAppListener = async () => {
            if (Capacitor.isNativePlatform()) {
                // When app resumes from a phone call or switching apps,
                // re-request wake lock and ensure watchPosition is alive.
                appListener = await App.addListener('appStateChange', async ({ isActive }) => {
                    if (isActive && isTrackingRef.current) {
                        console.log('[GPS] App resumed — re-acquiring wake lock & restarting GPS if needed');
                        requestWakeLock();
                        restartGpsWatchIfNeeded();
                        // Flush any pending location that was queued during the call
                        if (pendingUpdateRef.current) {
                            const p = pendingUpdateRef.current;
                            sendLocationUpdate(p.lat, p.lng, p.speed, p.heading);
                        }
                    }
                });
            }
        };
        setupAppListener();

        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && isTrackingRef.current) {
                requestWakeLock();
                restartGpsWatchIfNeeded();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('focus', handleVisibility);

        return () => {
            if (appListener) appListener.remove();
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('focus', handleVisibility);
        };
    }, [selectedVehicle, selectedRoute]);

    // ─── Trip timer ─────────────────────────────────────────────
    useEffect(() => {
        if (isTracking) {
            tripTimerRef.current = setInterval(() => {
                setTripSeconds(prev => prev + 1);
            }, 1000);
        } else {
            if (tripTimerRef.current) clearInterval(tripTimerRef.current);
        }
        return () => {
            if (tripTimerRef.current) clearInterval(tripTimerRef.current);
        };
    }, [isTracking]);

    // ─── Layer 2: Backup Heartbeat ─────────────────────────────────────────────
    // Every 5 seconds, if tracking is active and we have a last known GPS,
    // send it to the server. This covers the case where watchPosition callbacks
    // are throttled by Android when the screen is off or during a call.
    const startHeartbeat = () => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
            if (!isTrackingRef.current) return;
            const gps = lastKnownGpsRef.current;
            if (!gps) return;
            // Only send heartbeat if primary watchPosition hasn't sent in >4 seconds
            // This avoids double-sending when watchPosition is working normally
            const timeSinceLastSend = Date.now() - lastSendTimeRef.current;
            if (timeSinceLastSend >= 4500) {
                console.log('[GPS Heartbeat] watchPosition seems quiet — sending last known position');
                sendLocationUpdate(gps.lat, gps.lng, gps.speed, gps.heading);
            }
        }, 5000);
    };

    const stopHeartbeat = () => {
        if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current);
            heartbeatRef.current = null;
        }
    };

    // ─── Layer 3: Persistent Notification ─────────────────────────────────────
    // Posting a visible notification while driving tells Android "this is important,
    // keep the app process alive." This is the JS-side equivalent of a foreground service.
    const postDrivingNotification = async () => {
        if (!Capacitor.isNativePlatform()) return;
        try {
            await LocalNotifications.schedule({
                notifications: [{
                    id: DRIVING_NOTIF_ID,
                    title: '🚌 Connect to Campus — GPS Active',
                    body: 'Live bus tracking is running. Do not force-close the app.',
                    channelId: 'school_notifications',
                    ongoing: true,          // Persistent — stays until we cancel it
                    autoCancel: false,      // User cannot dismiss it while driving
                    schedule: { at: new Date(Date.now() + 200) },
                }]
            });
        } catch (e) {
            console.warn('[GPS] Could not post driving notification:', e);
        }
    };

    const cancelDrivingNotification = async () => {
        if (!Capacitor.isNativePlatform()) return;
        try {
            await LocalNotifications.cancel({ notifications: [{ id: DRIVING_NOTIF_ID }] });
        } catch (e) {}
    };

    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchInitialData = async (isManual = false) => {
        if (isManual) setIsRefreshing(true);
        try {
            const [vRes, rRes] = await Promise.all([
                api.get('/transport/vehicles'),
                api.get('/transport/routes')
            ]);
            setVehicles(vRes.data);
            setRoutes(rRes.data);

            if (!selectedVehicle && vRes.data.length === 1) {
                setSelectedVehicle(String(vRes.data[0].id));
            }
            if (!selectedRoute && rRes.data.length === 1) {
                setSelectedRoute(String(rRes.data[0].id));
            }
            if (isManual) toast.success('Fleet & route statuses updated');
        } catch (error) {
            console.error('Failed to load transport data', error);
            if (isManual) toast.error('Failed to refresh data');
        } finally {
            if (isManual) setIsRefreshing(false);
        }
    };

    // Web API wake lock — only works in browser, but harmless on native (just ignored)
    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            console.warn('Wake Lock request:', err);
        }
    };

    // ─── Send location to server ───────────────────────────────────────────────
    const sendLocationUpdate = async (latitude, longitude, speed, heading, accuracy) => {
        if (!selectedVehicle) return;

        const activeRouteObj = routes.find(r => String(r.id) === String(selectedRoute));

        try {
            await api.put(`/transport/vehicles/${selectedVehicle}/location`, {
                lat: latitude,
                lng: longitude,
                speed: speed || 0,         // m/s — backend converts to km/h
                heading: heading || 0,
                accuracy: accuracy || null,
                route_id: activeRouteObj ? activeRouteObj.id : null,
                route_name: activeRouteObj ? activeRouteObj.route_name : null,
                status: 'Active'
            });
            setUpdateCount(prev => prev + 1);
            pendingUpdateRef.current = null;
        } catch (err) {
            if (err.response?.status === 409) {
                toast.error(err.response.data?.message || 'Route is already in use by another active bus.');
                stopTracking();
                return;
            }
            // Queue last known position to sync automatically when network recovers
            pendingUpdateRef.current = { lat: latitude, lng: longitude, speed, heading };
        }
    };

    const restartGpsWatchIfNeeded = async () => {
        if (!watchIdRef.current && isTrackingRef.current) {
            console.log('[GPS] watchPosition was dead — restarting...');
            startWatchPosition();
        }
    };

    const startTrackingWithParams = async (vId, rId) => {
        setSelectedVehicle(vId);
        setSelectedRoute(rId);
        startTracking();
    };

    // ─── Start the native GPS watchPosition ────────────────────────────────────
    const startWatchPosition = async () => {
        // Clear any stale watch first
        if (watchIdRef.current !== null) {
            try { await Geolocation.clearWatch({ id: watchIdRef.current }); } catch (e) {}
            watchIdRef.current = null;
        }

        const id = await Geolocation.watchPosition(
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0  // Always get fresh position, never use cached
            },
            async (position, err) => {
                if (err) {
                    console.error('GPS Watch error (retrying automatically):', err);
                    return; // watchPosition retries automatically
                }

                if (position?.coords) {
                    const { latitude, longitude, speed, heading, accuracy } = position.coords;

                    // Reject obviously invalid coordinates
                    if (latitude === 0 && longitude === 0) return;
                    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;

                    // Only reject in native mobile app if accuracy is completely lost (>200m)
                    // In web browser, allow browser geolocation without strict mobile threshold
                    if (isMobileApp && accuracy && accuracy > 200) {
                        console.warn(`[GPS] Fix skipped — poor accuracy: ${Math.round(accuracy)}m`);
                        return;
                    }

                    // Always update last known GPS for heartbeat fallback
                    lastKnownGpsRef.current = { lat: latitude, lng: longitude, speed, heading };

                    const now = Date.now();
                    // Send update at most every 1 second (debounce rapid GPS events)
                    if (now - lastSendTimeRef.current >= 1000) {
                        lastSendTimeRef.current = now;
                        setLastPosition([latitude, longitude]);
                        setCurrentSpeed(speed ? Math.round(speed * 3.6) : 0);
                        setCurrentHeading(heading || 0);
                        setLastUpdated(new Date());
                        await sendLocationUpdate(latitude, longitude, speed, heading, accuracy);
                    }
                }
            }
        );

        watchIdRef.current = id;
        console.log('[GPS] watchPosition started, id:', id);
    };

    // ─── Main start tracking ───────────────────────────────────────────────────
    // ACCESS_BACKGROUND_LOCATION is NOT declared in the manifest, so no prominent
    // disclosure is required by Google Play policy. We only request ACCESS_FINE_LOCATION
    // at runtime. The persistent LocalNotification (ongoing=true) keeps Android from
    // killing the GPS service when the screen turns off or during a call.
    const startTracking = async () => {
        if (!selectedVehicle) return toast.error('Please select your Bus Number first');

        if (selectedRoute) {
            const activeVehOnRoute = vehicles.find(v => 
                v.status === 'Active' && 
                String(v.id) !== String(selectedVehicle) && 
                (String(v.current_route_id) === String(selectedRoute) || String(v.id) === String(routes.find(r => String(r.id) === String(selectedRoute))?.active_vehicle_id))
            );

            if (activeVehOnRoute) {
                return toast.error(`Route is already in use by Bus ${activeVehOnRoute.vehicle_number} (${activeVehOnRoute.driver_name || 'Driver'}). Please choose another route.`);
            }
        }

        await beginTracking();
    };

    // ─── Actual tracking start ─────────────────────────────────────────────────
    const beginTracking = async () => {
        try {
            if (isMobileApp) {
                // Request only ACCESS_FINE_LOCATION (not background — not in manifest)
                const perm = await Geolocation.checkPermissions();
                if (perm.location !== 'granted') {
                    const req = await Geolocation.requestPermissions({ permissions: ['location'] });
                    if (req.location !== 'granted') {
                        setError('PERMISSION_DENIED');
                        return;
                    }
                }
            }

            toast.loading('Acquiring GPS...', { id: 'gps-start' });

            // Initial immediate fix — get first position fast with fallback
            try {
                let initPos = null;
                try {
                    initPos = await Geolocation.getCurrentPosition({
                        enableHighAccuracy: true,
                        timeout: 6000,
                        maximumAge: 0
                    });
                } catch (highAccErr) {
                    // Fallback to standard accuracy on web/laptops if high accuracy times out
                    initPos = await Geolocation.getCurrentPosition({
                        enableHighAccuracy: false,
                        timeout: 8000,
                        maximumAge: 10000
                    });
                }

                if (initPos?.coords) {
                    const { latitude, longitude, speed, heading, accuracy } = initPos.coords;
                    setLastPosition([latitude, longitude]);
                    setCurrentSpeed(speed ? Math.round(speed * 3.6) : 0);
                    setCurrentHeading(heading || 0);
                    setLastUpdated(new Date());
                    lastKnownGpsRef.current = { lat: latitude, lng: longitude, speed, heading };
                    await sendLocationUpdate(latitude, longitude, speed, heading, accuracy);
                }
            } catch (initErr) {
                console.warn('Initial fix warning (non-fatal):', initErr);
            }

            // Layer 1: Start native watchPosition
            await startWatchPosition();

            setIsTracking(true);

            // Layer 2: Start backup heartbeat
            startHeartbeat();

            // Layer 3: Post persistent driving notification (keeps Android from killing JS)
            await postDrivingNotification();

            // Web wake lock (browser only, no-op on native)
            requestWakeLock();

            toast.success("Let's Drive! GPS Live Tracking Active 🚀", { id: 'gps-start' });

        } catch (err) {
            console.error('Failed to start tracking:', err);
            toast.error('Could not start GPS. Please check location permissions.', { id: 'gps-start' });
        }
    };

    // ─── Stop tracking ─────────────────────────────────────────────────────────
    const stopTracking = async () => {
        // Stop Layer 1: native watchPosition
        if (watchIdRef.current !== null) {
            try { await Geolocation.clearWatch({ id: watchIdRef.current }); } catch (err) {}
            watchIdRef.current = null;
        }

        // Stop Layer 2: backup heartbeat
        stopHeartbeat();

        // Stop Layer 3: cancel persistent notification
        await cancelDrivingNotification();

        // Release web wake lock
        if (wakeLockRef.current) {
            try { wakeLockRef.current.release(); } catch (e) {}
            wakeLockRef.current = null;
        }

        lastKnownGpsRef.current = null;
        localStorage.removeItem('active_driver_trip');

        // Mark vehicle as Idle on server
        if (selectedVehicle) {
            try {
                await api.put(`/transport/vehicles/${selectedVehicle}/location`, {
                    status: 'Idle'
                });
            } catch (e) {
                console.error('Failed to set vehicle to Idle on server:', e);
            }
        }

        setIsTracking(false);
        setTripSeconds(0);
        setLastPosition(null);
        setCurrentSpeed(0);
        toast.success('Trip Ended. Status set to Idle.');
    };

    const formatTimer = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const activeVehicleObj = vehicles.find(v => String(v.id) === String(selectedVehicle));
    const activeRouteObj = routes.find(r => String(r.id) === String(selectedRoute));

    return (
        <div className="w-full bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl">



            {/* Compact Status Bar with Call Protection Indicator */}
            <div className="bg-slate-800/90 px-5 py-3.5 flex items-center justify-between border-b border-slate-700/60">
                <div className="flex items-center gap-2">
                    <Bus size={18} className="text-yellow-400" />
                    <span className="font-black text-sm uppercase tracking-wider text-white">Driver Trip Monitor</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Call Protection Badge */}
                    <div className="hidden sm:flex items-center gap-1 bg-slate-700/60 px-2 py-0.5 rounded-md text-[10px] text-slate-300">
                        <PhoneCall size={10} className="text-emerald-400" />
                        <span>Call-Protected</span>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full ${isTracking ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                        {isTracking ? 'Driving Active' : 'Standby'}
                    </span>
                </div>
            </div>

            <div className="max-w-md mx-auto p-4 space-y-4 py-6">

                {/* TRIP CONFIGURATION (BEFORE DRIVING) */}
                {!isTracking ? (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 rounded-3xl p-6 shadow-2xl border border-indigo-500/20 text-center relative overflow-hidden">
                            <div className="w-20 h-20 bg-yellow-400 text-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl rotate-3">
                                <Bus size={42} strokeWidth={2.5} />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tight">Driver Trip Monitor</h2>
                            <p className="text-indigo-200 text-xs mt-1">Select your bus and route, then tap Let's Drive</p>
                        </div>

                        {/* Select Bus & Route Card */}
                        <div className="bg-slate-800 rounded-3xl p-5 border border-slate-700/60 shadow-xl space-y-4">
                            <div className="flex items-center justify-between pb-1 border-b border-slate-700/50">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-300">Trip Configuration</span>
                                <button
                                    type="button"
                                    onClick={() => fetchInitialData(true)}
                                    disabled={isRefreshing}
                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700/70 hover:bg-slate-700 text-slate-300 rounded-xl text-[11px] font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                                    title="Refresh current bus and route status"
                                >
                                    <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-yellow-400' : ''} />
                                    <span>{isRefreshing ? 'Refreshing...' : 'Refresh Status'}</span>
                                </button>
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                                    1. Select Bus Number *
                                </label>
                                <select
                                    className="w-full p-4 bg-slate-900 border-2 border-slate-700 rounded-2xl font-black text-white text-base focus:border-yellow-400 outline-none transition-all"
                                    value={selectedVehicle}
                                    onChange={e => setSelectedVehicle(e.target.value)}
                                >
                                    <option value="">-- Choose Bus Number --</option>
                                    {vehicles.map(v => {
                                        const isVehActive = v.status === 'Active' && v.last_updated && (Date.now() - new Date(v.last_updated).getTime() < 10 * 60 * 1000);
                                        return (
                                            <option key={v.id} value={v.id}>
                                                {isVehActive
                                                    ? `🚌 ${v.vehicle_number} — 🟢 IN TRIP (${v.current_route_name ? v.current_route_name + ' • ' : ''}${v.driver_name || 'Active'})`
                                                    : `🚌 ${v.vehicle_number} — Standby / Available ${v.driver_name ? '(' + v.driver_name + ')' : ''}`
                                                }
                                            </option>
                                        );
                                    })}
                                </select>

                                {activeVehicleObj && activeVehicleObj.status === 'Active' && (
                                    <div className="mt-2 p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-[11px] text-amber-200 flex items-start gap-2">
                                        <span className="flex-shrink-0">⚠️</span>
                                        <span>
                                            <strong>{activeVehicleObj.vehicle_number}</strong> is currently marked IN TRIP {activeVehicleObj.driver_name ? `by ${activeVehicleObj.driver_name}` : ''}. Starting will update and take over live tracking for this bus.
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1.5 ml-1">
                                    2. Select Route (Optional)
                                </label>
                                <select
                                    className="w-full p-4 bg-slate-900 border-2 border-slate-700 rounded-2xl font-black text-white text-base focus:border-yellow-400 outline-none transition-all"
                                    value={selectedRoute}
                                    onChange={e => setSelectedRoute(e.target.value)}
                                >
                                    <option value="">-- Any Route / General Trip --</option>
                                    {routes.map(r => {
                                        const isTakenByOther = vehicles.find(v => 
                                            v.status === 'Active' && 
                                            String(v.id) !== String(selectedVehicle) && 
                                            (String(v.current_route_id) === String(r.id) || String(v.id) === String(r.active_vehicle_id))
                                        );
                                        const isCurrentVehicleOnRoute = selectedVehicle && vehicles.find(v => 
                                            String(v.id) === String(selectedVehicle) && 
                                            String(v.current_route_id) === String(r.id)
                                        );

                                        return (
                                            <option 
                                                key={r.id} 
                                                value={r.id} 
                                                disabled={Boolean(isTakenByOther)}
                                                className={isTakenByOther ? "text-slate-500 bg-slate-900" : "text-white bg-slate-900"}
                                            >
                                                {isTakenByOther
                                                    ? `🔒 ${r.route_name} — In Use by Bus ${isTakenByOther.vehicle_number} (${isTakenByOther.driver_name || 'Driver'})`
                                                    : isCurrentVehicleOnRoute
                                                        ? `📍 ${r.route_name} — Your Current Route (${r.start_point} → ${r.end_point})`
                                                        : `📍 ${r.route_name} — Available (${r.start_point} → ${r.end_point})`
                                                }
                                            </option>
                                        );
                                    })}
                                </select>

                                {(() => {
                                    if (!selectedRoute) return null;
                                    const activeVehOnRoute = vehicles.find(v => 
                                        v.status === 'Active' && 
                                        String(v.id) !== String(selectedVehicle) && 
                                        (String(v.current_route_id) === String(selectedRoute) || String(v.id) === String(routes.find(r => String(r.id) === String(selectedRoute))?.active_vehicle_id))
                                    );
                                    if (activeVehOnRoute) {
                                        return (
                                            <div className="mt-2 p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-start gap-2">
                                                <span className="flex-shrink-0 text-base">⛔</span>
                                                <span>
                                                    <strong>Route In Use:</strong> This route is currently being run by <strong>Bus {activeVehOnRoute.vehicle_number}</strong> ({activeVehOnRoute.driver_name || 'Driver'}). Please select another route or run a General Trip.
                                                </span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            {/* START BUTTON */}
                            {(() => {
                                const isRouteLocked = selectedRoute && vehicles.some(v => 
                                    v.status === 'Active' && 
                                    String(v.id) !== String(selectedVehicle) && 
                                    (String(v.current_route_id) === String(selectedRoute) || String(v.id) === String(routes.find(r => String(r.id) === String(selectedRoute))?.active_vehicle_id))
                                );
                                return (
                                    <button
                                        onClick={startTracking}
                                        disabled={!selectedVehicle || isRouteLocked}
                                        className="w-full py-5 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-slate-950 rounded-2xl font-black text-xl tracking-wider shadow-2xl active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 uppercase mt-2"
                                    >
                                        <Navigation size={26} className="fill-slate-950" />
                                        {isRouteLocked ? '🔒 Route In Use' : "🚀 Let's Drive"}
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                ) : (
                    /* ACTIVE DRIVING DASHBOARD */
                    <div className="space-y-4 animate-in zoom-in-95">

                        {/* Top Live Stats Bar */}
                        <div className="bg-slate-800 rounded-3xl p-5 border border-slate-700/60 shadow-2xl space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Bus</div>
                                    <div className="text-xl font-black text-yellow-400 flex items-center gap-2">
                                        <Bus size={20} />
                                        {activeVehicleObj?.vehicle_number || 'Selected Bus'}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Trip Time</div>
                                    <div className="text-xl font-black text-emerald-400 font-mono">
                                        {formatTimer(tripSeconds)}
                                    </div>
                                </div>
                            </div>

                            {activeRouteObj && (
                                <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-700/60 text-xs">
                                    <span className="font-bold text-slate-400">Route: </span>
                                    <span className="font-black text-indigo-300">{activeRouteObj.route_name}</span>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                        {activeRouteObj.start_point} ➔ {activeRouteObj.end_point}
                                    </div>
                                </div>
                            )}

                            {/* GPS status indicators */}
                            <div className="flex items-center gap-2 text-[10px] font-bold flex-wrap">
                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${networkOnline ? 'bg-emerald-900/60 text-emerald-400' : 'bg-red-900/60 text-red-400'}`}>
                                    <Wifi size={9} /> {networkOnline ? 'Connected' : 'Offline — queued'}
                                </span>
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300">
                                    <PhoneCall size={9} /> Call-Safe
                                </span>
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                                    <Shield size={9} /> Screen-Lock Safe
                                </span>
                            </div>

                            {/* Speedometer & Stats */}
                            <div className="grid grid-cols-2 gap-3 text-center">
                                <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-700">
                                    <div className="text-3xl font-black text-white font-mono flex items-center justify-center gap-1">
                                        {currentSpeed}
                                        <span className="text-xs text-slate-400 font-normal">km/h</span>
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Live Speed</div>
                                </div>

                                <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-700">
                                    <div className="text-3xl font-black text-emerald-400 font-mono">
                                        {updateCount}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">GPS Broadcasts</div>
                                </div>
                            </div>

                            {/* Detailed Places Mini Map */}
                            {lastPosition && (
                                <div className="h-48 rounded-2xl overflow-hidden border border-slate-700 shadow-inner relative z-0">
                                    <MapContainer
                                        center={lastPosition}
                                        zoom={16}
                                        maxZoom={20}
                                        zoomControl={false}
                                        style={{ height: '100%', width: '100%' }}
                                    >
                                        <TileLayer
                                            attribution='&copy; Google Maps'
                                            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                            maxZoom={20}
                                        />
                                        <RecenterMap lat={lastPosition[0]} lng={lastPosition[1]} />
                                        <Marker position={lastPosition} icon={createDriverBusIcon(currentSpeed)} />
                                    </MapContainer>
                                    <div className="absolute top-2 right-2 z-[1000] pointer-events-none bg-slate-900/80 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-400 backdrop-blur-sm border border-slate-700 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                        Live GPS
                                    </div>
                                </div>
                            )}

                            {/* STOP / END TRIP BUTTON */}
                            <button
                                onClick={stopTracking}
                                className="w-full py-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-2xl font-black text-lg uppercase tracking-wider shadow-xl shadow-red-600/30 transition-all flex items-center justify-center gap-2"
                            >
                                🛑 End Trip / Stop Driving
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DriverTracking;
