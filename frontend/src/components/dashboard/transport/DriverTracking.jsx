import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { MapPin, Navigation, Bus, Clock, ArrowLeft, RefreshCw, Gauge, Shield, AlertTriangle, PhoneCall, Wifi } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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
    const [showDisclosure, setShowDisclosure] = useState(false);
    const [networkOnline, setNetworkOnline] = useState(navigator.onLine);

    const wakeLockRef = useRef(null);
    const watchIdRef = useRef(null);
    const tripTimerRef = useRef(null);
    const lastSendTimeRef = useRef(0);
    const isTrackingRef = useRef(false);
    const pendingUpdateRef = useRef(null);

    // Keep ref in sync
    useEffect(() => {
        isTrackingRef.current = isTracking;
    }, [isTracking]);

    // Detect platform & restore any ongoing trip
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

        // Restore active trip from storage if driver refreshed or switched apps
        try {
            const savedTrip = localStorage.getItem('active_driver_trip');
            if (savedTrip) {
                const parsed = JSON.parse(savedTrip);
                if (parsed?.selectedVehicle && parsed?.isTracking) {
                    setSelectedVehicle(parsed.selectedVehicle);
                    setSelectedRoute(parsed.selectedRoute || '');
                    setTripSeconds(parsed.tripSeconds || 0);
                    // Automatically restart tracking
                    setTimeout(() => {
                        startTrackingWithParams(parsed.selectedVehicle, parsed.selectedRoute || '');
                    }, 500);
                }
            }
        } catch (e) {}

        // Network status listeners
        const handleOnline = () => {
            setNetworkOnline(true);
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

    // Phone Call & Background Resilience Listener
    useEffect(() => {
        let appListener = null;
        const setupAppListener = async () => {
            if (Capacitor.isNativePlatform()) {
                appListener = await App.addListener('appStateChange', async ({ isActive }) => {
                    if (isActive && isTrackingRef.current) {
                        // Resumed from a phone call or other app
                        requestWakeLock();
                        restartGpsWatchIfNeeded();
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

    // Trip duration timer & persistence
    useEffect(() => {
        if (isTracking) {
            tripTimerRef.current = setInterval(() => {
                setTripSeconds(prev => {
                    const next = prev + 1;
                    // Persist state
                    try {
                        localStorage.setItem('active_driver_trip', JSON.stringify({
                            selectedVehicle,
                            selectedRoute,
                            isTracking: true,
                            tripSeconds: next
                        }));
                    } catch (e) {}
                    return next;
                });
            }, 1000);
        } else {
            if (tripTimerRef.current) clearInterval(tripTimerRef.current);
            localStorage.removeItem('active_driver_trip');
        }
        return () => {
            if (tripTimerRef.current) clearInterval(tripTimerRef.current);
        };
    }, [isTracking, selectedVehicle, selectedRoute]);

    const fetchInitialData = async () => {
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
        } catch (error) {
            console.error('Failed to load transport data', error);
        }
    };

    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            console.warn('Wake Lock request:', err);
        }
    };

    const handleDisclosureAccept = async () => {
        localStorage.setItem('location_disclosure_accepted', 'true');
        setShowDisclosure(false);
        try {
            await Geolocation.requestPermissions();
        } catch (err) {
            console.error('Permission request failed', err);
        }
    };

    // Send location to server with call & network resilience
    const sendLocationUpdate = async (latitude, longitude, speed, heading) => {
        if (!selectedVehicle) return;

        const activeRouteObj = routes.find(r => String(r.id) === String(selectedRoute));

        try {
            await api.put(`/transport/vehicles/${selectedVehicle}/location`, {
                lat: latitude,
                lng: longitude,
                speed: speed || 0,
                heading: heading || 0,
                route_id: activeRouteObj ? activeRouteObj.id : null,
                route_name: activeRouteObj ? activeRouteObj.route_name : null,
                status: 'Active'
            });
            setUpdateCount(prev => prev + 1);
            pendingUpdateRef.current = null;
        } catch (err) {
            // Queue last known position to sync automatically when call ends or data returns
            pendingUpdateRef.current = { lat: latitude, lng: longitude, speed, heading };
        }
    };

    const restartGpsWatchIfNeeded = async () => {
        if (!watchIdRef.current && isTrackingRef.current) {
            startTracking();
        }
    };

    const startTrackingWithParams = async (vId, rId) => {
        setSelectedVehicle(vId);
        setSelectedRoute(rId);
        startTracking();
    };

    const startTracking = async () => {
        if (!selectedVehicle) return toast.error('Please select your Bus Number first');

        try {
            if (isMobileApp) {
                const perm = await Geolocation.checkPermissions();
                if (perm.location !== 'granted') {
                    const accepted = localStorage.getItem('location_disclosure_accepted');
                    if (!accepted) {
                        setShowDisclosure(true);
                        return;
                    }
                    const req = await Geolocation.requestPermissions();
                    if (req.location !== 'granted') {
                        setError('PERMISSION_DENIED');
                        return;
                    }
                }
            }

            if (watchIdRef.current !== null) {
                try {
                    await Geolocation.clearWatch({ id: watchIdRef.current });
                } catch (e) {}
                watchIdRef.current = null;
            }

            toast.loading("Acquiring GPS...", { id: "gps-start" });

            // Initial immediate fix
            try {
                const initPos = await Geolocation.getCurrentPosition({
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
                if (initPos?.coords) {
                    const { latitude, longitude, speed, heading } = initPos.coords;
                    setLastPosition([latitude, longitude]);
                    setCurrentSpeed(speed ? Math.round(speed * 3.6) : 0);
                    setCurrentHeading(heading || 0);
                    setLastUpdated(new Date());
                    await sendLocationUpdate(latitude, longitude, speed, heading);
                }
            } catch (initErr) {
                console.warn("Initial fix warning:", initErr);
            }

            // Continuous high-accuracy background-resilient watch
            const id = await Geolocation.watchPosition(
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                },
                async (position, err) => {
                    if (err) {
                        console.error('GPS Watch error (retrying):', err);
                        return;
                    }

                    if (position?.coords) {
                        const { latitude, longitude, speed, heading } = position.coords;

                        if (latitude === 0 && longitude === 0) return;
                        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;

                        const now = Date.now();
                        // Send update every 1 second
                        if (now - lastSendTimeRef.current >= 1000) {
                            lastSendTimeRef.current = now;
                            setLastPosition([latitude, longitude]);
                            setCurrentSpeed(speed ? Math.round(speed * 3.6) : 0);
                            setCurrentHeading(heading || 0);
                            setLastUpdated(new Date());
                            await sendLocationUpdate(latitude, longitude, speed, heading);
                        }
                    }
                }
            );

            watchIdRef.current = id;
            setIsTracking(true);
            requestWakeLock();
            toast.success("Let's Drive! GPS Live Tracking Active 🚀", { id: "gps-start" });

        } catch (err) {
            console.error('Failed to start tracking:', err);
            toast.error('Could not start GPS. Please check location permissions.', { id: "gps-start" });
        }
    };

    const stopTracking = async () => {
        if (watchIdRef.current !== null) {
            try {
                await Geolocation.clearWatch({ id: watchIdRef.current });
            } catch (err) {}
            watchIdRef.current = null;
        }

        if (wakeLockRef.current) {
            try {
                wakeLockRef.current.release();
            } catch (e) {}
            wakeLockRef.current = null;
        }

        localStorage.removeItem('active_driver_trip');

        if (selectedVehicle) {
            try {
                await api.put(`/transport/vehicles/${selectedVehicle}/location`, {
                    status: 'Idle'
                });
            } catch (e) {}
        }

        setIsTracking(false);
        toast.success("Trip Ended. Status set to Idle.");
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

            {/* Google Play Prominent Location Disclosure Modal */}
            {showDisclosure && (
                <div className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center p-4">
                    <div className="bg-white text-slate-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
                        <div className="bg-indigo-600 p-6 text-white text-center">
                            <MapPin size={40} className="mx-auto mb-2" />
                            <h2 className="text-xl font-black">Location Access Required</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-slate-700 text-sm font-bold">
                                📍 Connect to Campus collects location data to enable live bus tracking for students and parents even when the app is in the background or when receiving phone calls while you are driving.
                            </p>
                            <button
                                onClick={handleDisclosureAccept}
                                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider active:scale-95 transition-all shadow-lg"
                            >
                                ✅ Allow Location & Continue
                            </button>
                            <button
                                onClick={() => setShowDisclosure(false)}
                                className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs"
                            >
                                Not Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                    {vehicles.map(v => (
                                        <option key={v.id} value={v.id}>
                                            🚌 {v.vehicle_number} {v.driver_name ? `(${v.driver_name})` : ''}
                                        </option>
                                    ))}
                                </select>
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
                                    {routes.map(r => (
                                        <option key={r.id} value={r.id}>
                                            📍 {r.route_name} ({r.start_point} → {r.end_point})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* START BUTTON */}
                            <button
                                onClick={startTracking}
                                disabled={!selectedVehicle}
                                className="w-full py-5 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-yellow-400 text-slate-950 rounded-2xl font-black text-xl tracking-wider shadow-2xl active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 uppercase mt-2"
                            >
                                <Navigation size={26} className="fill-slate-950" />
                                🚀 Let's Drive
                            </button>
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
                                    <div className="absolute top-2 right-2 z-[400] bg-slate-900/80 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-400 backdrop-blur-sm border border-slate-700 flex items-center gap-1">
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
