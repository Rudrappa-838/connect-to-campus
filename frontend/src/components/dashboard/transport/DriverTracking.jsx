import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { MapPin, Navigation, Bus, Clock, TriangleAlert, Battery, ArrowLeft, RefreshCw } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const RecenterMap = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
            // Only recenter if distance is significant or first load to avoid jitter
            const currentCenter = map.getCenter();
            const distance = map.distance(currentCenter, [lat, lng]);
            if (distance > 10) { // Only move if change is > 10 meters
                map.setView([lat, lng], 16, { animate: true }); // Use 16 zoom for closer view
            }
        }
    }, [lat, lng, map]);
    return null;
};

const DriverTracking = () => {
    const navigate = useNavigate();
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [isTracking, setIsTracking] = useState(false);
    const [lastPosition, setLastPosition] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [watchId, setWatchId] = useState(null);
    const [error, setError] = useState(null);
    const wakeLockRef = useRef(null);
    const [isMobileApp, setIsMobileApp] = useState(false);
    const [showDisclosure, setShowDisclosure] = useState(false); // Google Play: Prominent Disclosure
    const [disclosureAccepted, setDisclosureAccepted] = useState(false);

    // Detect if running in native app
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
        fetchVehicles();
        return () => stopTracking();
    }, []);

    useEffect(() => {
        if (isMobileApp) {
            checkPermissions();
        }
    }, [isMobileApp]);

    const checkPermissions = async () => {
        try {
            const perm = await Geolocation.checkPermissions();
            if (perm.location !== 'granted') {
                // Show Prominent Disclosure BEFORE requesting permission (Google Play requirement)
                const accepted = localStorage.getItem('location_disclosure_accepted');
                if (!accepted) {
                    setShowDisclosure(true);
                    return; // Wait for user to accept disclosure
                }
                await Geolocation.requestPermissions();
            }
        } catch (err) {
            console.error('Permission check failed', err);
        }
    };

    const handleDisclosureAccept = async () => {
        localStorage.setItem('location_disclosure_accepted', 'true');
        setDisclosureAccepted(true);
        setShowDisclosure(false);
        try {
            await Geolocation.requestPermissions();
        } catch (err) {
            console.error('Permission request failed', err);
        }
    };

    const fetchVehicles = async () => {
        try {
            const res = await api.get('/transport/vehicles');
            setVehicles(res.data);
        } catch (error) {
            toast.error('Failed to load vehicles');
        }
    };

    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
            }
        } catch (err) {
            console.error('Wake Lock failed:', err);
        }
    };

    const [initGPS, setInitGPS] = useState(false);
    const watchIdRef = useRef(null); // Use Ref to track watchId across renders/closures
    const lastUpdatedRef = useRef(null); // Track last update time for closures

    const startTracking = async (accuracyArg = true) => {
        // Handle Event object if called from onClick
        const useHighAccuracy = typeof accuracyArg === 'boolean' ? accuracyArg : true;

        if (!selectedVehicle) return toast.error('Please select a vehicle first');

        if (initGPS) return;
        setInitGPS(true);

        try {
            if (isMobileApp) {
                const perm = await Geolocation.checkPermissions();
                if (perm.location !== 'granted') {
                    const req = await Geolocation.requestPermissions();
                    if (req.location !== 'granted') {
                        setError('PERMISSION_DENIED');
                        setInitGPS(false);
                        return;
                    }
                }
            }

            // Clear existing watch if any using Ref
            if (watchIdRef.current !== null) {
                await Geolocation.clearWatch({ id: watchIdRef.current });
                watchIdRef.current = null;
            }

            const id = await Geolocation.watchPosition(
                {
                    enableHighAccuracy: useHighAccuracy,
                    timeout: 30000, // Give GPS 30s to warm up (increased from 15s)
                    maximumAge: useHighAccuracy ? 0 : Infinity // High Accuracy = Fresh, Low Accuracy = Any (Instant)
                },
                async (position, err) => {
                    if (err) {
                        console.error('GPS Error', err);

                        // If TIMEOUT (code 3) and we are using High Accuracy, fallback to Low Accuracy
                        if (err.code === 3 && useHighAccuracy === true) {
                            toast("Optimizing Signal...", { icon: '📡' }); // Neutral message
                            startTracking(false);
                            return;
                        }

                        handleGpsError(err);
                        return;
                    }

                    if (position) {
                        const { latitude, longitude, accuracy, speed } = position.coords;

                        // Sanity Check: Ignore invalid 0,0 which some GPS chips return on cold start
                        if (latitude === 0 && longitude === 0) return;
                        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;

                        // Allow first point regardless of accuracy to initialize map
                        // Then filter updates for jumps
                        // BUT if we are in fallback mode (Low Accuracy), we accept up to 500m
                        const maxAccuracy = useHighAccuracy ? 100 : 500;
                        const isFirstPoint = !lastUpdatedRef.current; // Need a ref for this to be reliable inside closure

                        // Log for debugging
                        console.log('GPS Update:', latitude, longitude, accuracy, isFirstPoint);

                        if (!isFirstPoint && accuracy > maxAccuracy) {
                            console.warn(`GPS Accuracy low (${accuracy}m). Ignoring.`);
                            return;
                        }

                        setLastPosition([latitude, longitude]);
                        const now = new Date();
                        setLastUpdated(now);
                        lastUpdatedRef.current = now; // Update ref

                        setError(null);
                        requestWakeLock();

                        try {
                            // Also update status to Active to ensure visibility
                            await api.put(`/transport/vehicles/${selectedVehicle}/location`, {
                                lat: latitude,
                                lng: longitude,
                                speed: speed,
                                status: 'Active'
                            });
                        } catch (err) {
                            console.error('Failed to sync location', err);
                        }
                    }
                }
            );

            watchIdRef.current = id; // Store in ref
            setWatchId(id); // Keep state for UI rendering if needed
            setIsTracking(true); // Switch UI immediately to 'Establishing...'
        } catch (err) {
            console.error('Start tracking failed', err);
            handleGpsError(err);
        } finally {
            setInitGPS(false);
        }
    };

    const handleGpsError = (err) => {
        if (err.code === 1) setError('PERMISSION_DENIED');
        else if (err.code === 2) toast.error('GPS Signal Lost. Move to open area.');
        else if (err.code === 3) toast.error('GPS Timeout. Low Network/Signal.');
        else toast.error('GPS Error: ' + (err.message || 'Unknown'));
    };

    const stopTracking = async () => {
        if (watchIdRef.current !== null) {
            try {
                await Geolocation.clearWatch({ id: watchIdRef.current });
            } catch (err) {
                console.error('Clear watch failed', err);
            }
            watchIdRef.current = null;
            setWatchId(null);
        }
        if (wakeLockRef.current) {
            wakeLockRef.current.release();
            wakeLockRef.current = null;
        }
        setIsTracking(false);
        setLastPosition(null); // Clear last position on stop
        lastUpdatedRef.current = null;
        toast.dismiss();
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col relative">

            {/* ===== PROMINENT LOCATION DISCLOSURE DIALOG (Google Play Required) ===== */}
            {showDisclosure && (
                <div className="fixed inset-0 bg-black/70 z-[99999] flex items-center justify-center p-5">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
                        <div className="bg-indigo-600 p-5 text-white text-center">
                            <MapPin size={36} className="mx-auto mb-2" />
                            <h2 className="text-xl font-black">Location Permission Required</h2>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-700 font-bold mb-3 text-sm">📍 Why we need your location:</p>
                            <ul className="text-slate-600 text-sm space-y-2 mb-5">
                                <li className="flex gap-2"><span>🚌</span><span>To broadcast your <strong>live bus location</strong> to parents and school admins</span></li>
                                <li className="flex gap-2"><span>🔒</span><span>Location is used <strong>only for school transport tracking</strong> — never shared with advertisers</span></li>
                                <li className="flex gap-2"><span>📱</span><span>Background location is used so tracking continues <strong>even when app is minimized</strong></span></li>
                                <li className="flex gap-2"><span>❌</span><span>You can <strong>stop tracking</strong> anytime using the Stop button</span></li>
                            </ul>
                            <a href="https://connect2campus.co.in/privacy-policy"
                                className="text-indigo-500 text-xs underline block mb-4 text-center"
                                target="_blank" rel="noopener noreferrer">
                                Read our full Privacy Policy
                            </a>
                            <button
                                onClick={handleDisclosureAccept}
                                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm mb-2 active:scale-95 transition-all"
                            >
                                ✅ Allow Location & Continue
                            </button>
                            <button
                                onClick={() => setShowDisclosure(false)}
                                className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm active:scale-95 transition-all"
                            >
                                Not Now
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* 1. BULLETPROOF FIXED HEADER - RED BACK BUTTON */}
            <header className="fixed top-0 left-0 right-0 bg-indigo-700 text-white z-[9999] shadow-2xl safe-area-top">
                <div className="px-5 h-20 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 p-4 px-6 bg-red-600 hover:bg-red-700 rounded-2xl active:scale-95 border-2 border-white/50 shadow-2xl font-black text-sm text-white transition-all"
                    >
                        <ArrowLeft size={24} strokeWidth={4} />
                        BACK TO DASHBOARD
                    </button>
                    <div className="text-right flex flex-col items-end">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Driver Mode</span>
                            <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`}></div>
                        </div>
                    </div>
                </div>
            </header>

            {/* SPACER */}
            <div className="h-24 safe-area-top"></div>

            <main className="p-4 flex-1">
                <div className="max-w-md mx-auto space-y-6">

                    {/* ALERT IF TRACKING */}
                    {isTracking && (
                        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between px-6 animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                                <span className="font-black text-sm">LIVE TRACKING ACTIVE</span>
                            </div>
                            <button onClick={stopTracking} className="bg-white text-emerald-700 px-3 py-1 rounded-lg font-bold text-xs">STOP</button>
                        </div>
                    )}

                    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="bg-slate-900 p-10 text-white text-center relative overflow-hidden">
                            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 rotate-3 shadow-2xl border-4 border-white/5 relative z-10">
                                <Bus size={40} className="text-white" />
                            </div>
                            <h2 className="text-3xl font-black italic tracking-tighter relative z-10 uppercase">Trip Monitor</h2>
                        </div>

                        <div className="p-8 space-y-6">
                            {!isTracking && (
                                <>
                                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                        <p className="text-xs text-indigo-700 font-bold uppercase tracking-wider text-center">Select your vehicle to begin</p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Vehicle</label>
                                        <select
                                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-800 outline-none focus:border-indigo-500"
                                            value={selectedVehicle}
                                            onChange={e => setSelectedVehicle(e.target.value)}
                                        >
                                            <option value="">-- Select Bus --</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>{v.vehicle_number} ({v.driver_name})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        onClick={() => startTracking(true)}
                                        disabled={!selectedVehicle || initGPS}
                                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl font-black text-xl shadow-xl shadow-indigo-500/30 transition-all disabled:opacity-30 disabled:shadow-none uppercase tracking-widest flex items-center justify-center gap-3"
                                    >
                                        {initGPS ? (
                                            <RefreshCw className="animate-spin" />
                                        ) : 'Start My Trip'}
                                    </button>
                                </>
                            )}

                            {isTracking && (
                                <div className="space-y-6">
                                    <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-center">
                                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mb-1">Current Sync</p>
                                        <p className="text-xl font-black text-indigo-600">
                                            {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Establishing...'}
                                        </p>
                                        {!lastUpdated && (
                                            <button
                                                onClick={async () => {
                                                    const updateLoc = async (pos) => {
                                                        const { latitude, longitude, speed, accuracy } = pos.coords;
                                                        setLastPosition([latitude, longitude]);
                                                        const now = new Date();
                                                        setLastUpdated(now);
                                                        lastUpdatedRef.current = now;
                                                        await api.put(`/transport/vehicles/${selectedVehicle}/location`, {
                                                            lat: latitude, lng: longitude, speed: speed, status: 'Active'
                                                        });
                                                        toast.success("Location Signal Acquired! Accuracy: " + Math.round(accuracy) + "m");
                                                    };

                                                    try {
                                                        toast.loading("Scanning High Accuracy GPS...");
                                                        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
                                                        toast.dismiss();
                                                        if (pos && pos.coords) await updateLoc(pos);
                                                    } catch (e) {
                                                        // Fallback
                                                        toast.dismiss();
                                                        toast.loading("GPS Weak. Trying Network Location...");
                                                        try {
                                                            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000, maximumAge: 0 });
                                                            toast.dismiss();
                                                            if (pos && pos.coords) await updateLoc(pos);
                                                        } catch (e2) {
                                                            toast.dismiss();
                                                            toast.error("Could not determine location. Check Device GPS.");
                                                        }
                                                    }
                                                }}
                                                className="mt-3 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold animate-pulse"
                                            >
                                                Force GPS Signal Update
                                            </button>
                                        )}
                                    </div>

                                    {lastPosition && (
                                        <div className="h-64 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-xl">
                                            <MapContainer
                                                center={lastPosition}
                                                zoom={15}
                                                style={{ height: '100%', width: '100%' }}
                                                scrollWheelZoom={true}
                                                zoomControl={true}
                                                dragging={true}
                                                touchZoom={true} // Add pinch-zoom support
                                            >
                                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                <RecenterMap lat={lastPosition[0]} lng={lastPosition[1]} />
                                                <Marker position={lastPosition} />
                                            </MapContainer>
                                        </div>
                                    )}

                                    <button
                                        onClick={stopTracking}
                                        className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all uppercase"
                                    >
                                        Stop Signal
                                    </button>
                                </div>
                            )}

                            {error === 'PERMISSION_DENIED' && (
                                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-red-700">
                                    <h4 className="font-black uppercase tracking-tight mb-2">GPS Restricted</h4>
                                    <p className="text-xs font-bold leading-relaxed">
                                        Please enable Location permissions in your phone settings for the School App.
                                    </p>
                                </div>
                            )}

                            {/* DEBUG INFO FOR LOCATION ISSUES */}
                            {lastPosition && (
                                <div className="text-[10px] text-slate-400 font-mono text-center p-2 bg-slate-100 rounded-lg">
                                    DEBUG: {lastPosition[0].toFixed(5)}, {lastPosition[1].toFixed(5)}
                                    <br />
                                    Accuracy: {lastUpdatedRef.current ? 'GPS' : 'N/A'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DriverTracking;
