import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../../../api/axios';
import { useAuth } from '../../../context/AuthContext';
import { Bus, Navigation, Wifi, WifiOff, Gauge, Clock, Phone, MapPin } from 'lucide-react';
import { io } from 'socket.io-client';

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: null,
    iconUrl: null,
    shadowUrl: null,
});

// Custom Live School Bus Marker with Floating Info Card on top (Compact Size)
const createLiveBusIcon = (vehicle, isSelected = false) => {
    const vehicleNumber = vehicle.vehicle_number || 'School Bus';
    const driverName = vehicle.driver_name || '';
    const routeName = vehicle.current_route_name || vehicle.route_name || '';
    const speed = parseFloat(vehicle.speed || 0);
    const heading = parseFloat(vehicle.heading || 0);
    const isMoving = speed > 2;
    const isLive = vehicle._isLive || vehicle.status === 'Active';

    const html = `
        <div style="width: 140px; display: flex; flex-direction: column; align-items: center; pointer-events: auto; z-index: ${isSelected ? 1000 : 500};">
            <!-- Compact Floating Badge directly above Bus Icon -->
            <div style="background: ${isSelected ? 'rgba(30, 27, 75, 0.96)' : 'rgba(15, 23, 42, 0.92)'}; backdrop-filter: blur(6px); color: white; padding: 3px 8px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: ${isSelected ? '2px solid #818cf8' : '1px solid rgba(255,255,255,0.25)'}; white-space: nowrap; text-align: center; margin-bottom: 3px; max-width: 140px;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 800; font-size: 11px; color: #facc15;">
                    <span>🚌 ${vehicleNumber}</span>
                    <span style="background: ${!isLive ? '#64748b' : speed > 60 ? '#ef4444' : isMoving ? '#10b981' : '#f59e0b'}; color: white; font-size: 8px; font-weight: 800; padding: 0.5px 4px; border-radius: 4px;">
                        ${!isLive ? 'Off' : isMoving ? `${Math.round(speed)}k` : 'Stop'}
                    </span>
                </div>
                ${routeName ? `<div style="font-size: 9px; font-weight: 600; color: #93c5fd; margin-top: 1px; max-width: 130px; overflow: hidden; text-overflow: ellipsis;">📍 ${routeName}</div>` : ''}
                ${driverName ? `<div style="font-size: 8.5px; color: #cbd5e1; margin-top: 0.5px;">👤 ${driverName}</div>` : ''}
            </div>

            <!-- Small Bus Icon with Radar Pulse & Directional Rotation -->
            <div style="position: relative; width: 34px; height: 34px;">
                <div style="background: #fbbf24; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #0f172a; box-shadow: 0 4px 12px rgba(0,0,0,0.4); transform: rotate(${heading}deg); transition: transform 0.3s ease;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path>
                        <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path>
                        <circle cx="7" cy="18" r="2"></circle><path d="M9 18h5"></path><circle cx="17" cy="18" r="2"></circle>
                    </svg>
                </div>
                ${isLive ? '<div style="position: absolute; bottom: -1px; right: -1px; width: 10px; height: 10px; background: #10b981; border-radius: 50%; border: 1.5px solid white; animation: ping 1s infinite;"></div>' : ''}
            </div>
        </div>
    `;

    return L.divIcon({
        className: 'custom-admin-bus-icon-wrapper',
        html: html,
        iconSize: [140, 75],
        iconAnchor: [70, 75],
    });
};

// User Location Marker (Pulsating Blue Dot)
const createUserLocationIcon = () => {
    return L.divIcon({
        className: 'custom-user-location-marker',
        html: `
            <div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: rgba(59, 130, 246, 0.4); animation: ping 1.5s infinite;"></div>
                <div style="width: 14px; height: 14px; border-radius: 50%; background: #2563eb; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); position: relative; z-index: 10;"></div>
            </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    });
};

// Automatically disperse vehicles that share the exact same or overlapping coordinates (e.g. testing from same device or depot)
const getDispersedLiveVehicles = (vehicles) => {
    const CLUSTER_THRESHOLD = 0.00045; // ~45 meters
    const OFFSET_DISTANCE = 0.00042;   // ~45 meters offset so badges don't cover each other

    const clusters = [];

    vehicles.forEach(v => {
        const lat = parseFloat(v.current_lat);
        const lng = parseFloat(v.current_lng);
        if (isNaN(lat) || isNaN(lng)) return;

        let addedToCluster = false;
        for (const cluster of clusters) {
            const center = cluster.center;
            const dist = Math.hypot(lat - center.lat, lng - center.lng);
            if (dist < CLUSTER_THRESHOLD) {
                cluster.vehicles.push(v);
                addedToCluster = true;
                break;
            }
        }

        if (!addedToCluster) {
            clusters.push({
                center: { lat, lng },
                vehicles: [v]
            });
        }
    });

    const result = [];
    clusters.forEach(cluster => {
        const count = cluster.vehicles.length;
        if (count === 1) {
            result.push({
                ...cluster.vehicles[0],
                display_lat: parseFloat(cluster.vehicles[0].current_lat),
                display_lng: parseFloat(cluster.vehicles[0].current_lng)
            });
        } else {
            // Multiple buses at identical coordinates: distribute around center so all badges & icons are visible
            cluster.vehicles.forEach((v, idx) => {
                const angle = (2 * Math.PI * idx) / count + (Math.PI / 4);
                const cosLat = Math.cos((cluster.center.lat * Math.PI) / 180);
                const dLat = Math.sin(angle) * (OFFSET_DISTANCE * 0.75);
                const dLng = Math.cos(angle) * (OFFSET_DISTANCE / (cosLat || 1));
                result.push({
                    ...v,
                    display_lat: cluster.center.lat + dLat,
                    display_lng: cluster.center.lng + dLng,
                    _isDispersed: true
                });
            });
        }
    });

    return result;
};

// Map Controller for single bus focus and multi-bus fleet bounds
const MapViewController = ({ target, bounds, fitTrigger }) => {
    const map = useMap();

    useEffect(() => {
        if (fitTrigger && bounds && bounds.isValid && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true, duration: 1.0 });
        } else if (target?.lat && target?.lng) {
            map.flyTo([target.lat, target.lng], target.zoom || 16, { animate: true, duration: 1.0 });
        }
    }, [target, fitTrigger, map]);

    return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// OLA-STYLE SMOOTH BUS MARKER
// Animates each bus smoothly from its old GPS position to the new one using
// requestAnimationFrame + linear interpolation (lerp). Duration matches the
// GPS update interval (~1s) so the bus appears to glide continuously.
// Also calculates bearing from old→new position if heading is unavailable.
// ─────────────────────────────────────────────────────────────────────────────
const SmoothBusMarker = ({ vehicle, isSelected, onSelect }) => {
    const markerRef = useRef(null);
    const animFrameRef = useRef(null);
    const fromPosRef = useRef(null);    // [lat, lng] animation start
    const toPosRef = useRef(null);      // [lat, lng] animation target
    const animStartRef = useRef(null);  // timestamp when animation began

    const lat = parseFloat(vehicle.display_lat ?? vehicle.current_lat);
    const lng = parseFloat(vehicle.display_lng ?? vehicle.current_lng);

    // Calculate compass bearing from point A to point B (degrees 0-360)
    const calcBearing = (aLat, aLng, bLat, bLng) => {
        const toRad = d => (d * Math.PI) / 180;
        const toDeg = r => (r * 180) / Math.PI;
        const dLng = toRad(bLng - aLng);
        const lat1 = toRad(aLat);
        const lat2 = toRad(bLat);
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    };

    // Linear interpolation
    const lerp = (a, b, t) => a + (b - a) * t;

    const icon = createLiveBusIcon(vehicle, isSelected);

    useEffect(() => {
        if (!markerRef.current || isNaN(lat) || isNaN(lng)) return;
        const marker = markerRef.current;

        const prevPos = fromPosRef.current;
        const targetPos = [lat, lng];

        if (prevPos && (prevPos[0] !== lat || prevPos[1] !== lng)) {
            // Cancel any in-progress animation
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

            // Get current rendered position as animation start (for seamless chaining)
            const currentMarkerPos = marker.getLatLng();
            fromPosRef.current = [currentMarkerPos.lat, currentMarkerPos.lng];
            toPosRef.current = targetPos;
            animStartRef.current = performance.now();

            // Calculate auto-bearing from movement direction if device didn't provide one
            const deviceHeading = parseFloat(vehicle.heading || 0);
            const moveBearing = prevPos
                ? calcBearing(prevPos[0], prevPos[1], lat, lng)
                : deviceHeading;
            const effectiveHeading = deviceHeading > 0 ? deviceHeading : moveBearing;

            const ANIMATION_DURATION = 900; // ms — slightly under 1s GPS interval for overlap

            const animate = (now) => {
                const elapsed = now - animStartRef.current;
                const t = Math.min(elapsed / ANIMATION_DURATION, 1);

                // Ease-out cubic for natural deceleration at destination
                const eased = 1 - Math.pow(1 - t, 3);

                const animLat = lerp(fromPosRef.current[0], toPosRef.current[0], eased);
                const animLng = lerp(fromPosRef.current[1], toPosRef.current[1], eased);

                marker.setLatLng([animLat, animLng]);

                if (t < 1) {
                    animFrameRef.current = requestAnimationFrame(animate);
                } else {
                    // Animation complete — snap to exact target
                    marker.setLatLng(targetPos);
                    animFrameRef.current = null;
                }
            };

            animFrameRef.current = requestAnimationFrame(animate);
        } else if (!prevPos) {
            // First render — place immediately, no animation
            marker.setLatLng(targetPos);
        }

        // Always update the icon (speed/heading label may have changed)
        marker.setIcon(icon);
        fromPosRef.current = targetPos;

        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [lat, lng, vehicle.speed, vehicle.heading, vehicle.status, isSelected]);

    if (isNaN(lat) || isNaN(lng)) return null;
    return (
        <Marker
            ref={markerRef}
            position={[lat, lng]}
            icon={icon}
            zIndexOffset={isSelected ? 2000 : 100}
            eventHandlers={{
                click: () => onSelect && onSelect(vehicle),
            }}
        />
    );
};


const SOCKET_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : (import.meta.env.PROD ? 'https://connect2campus.co.in' : 'http://localhost:5000');

const AdminLiveMap = () => {
    const { user } = useAuth();
    const [vehicleMap, setVehicleMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [flyTarget, setFlyTarget] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const selectedIdRef = useRef(null);
    useEffect(() => {
        selectedIdRef.current = selectedId;
    }, [selectedId]);
    const [fitTrigger, setFitTrigger] = useState(0);
    const [updateLog, setUpdateLog] = useState({});
    const [userLocation, setUserLocation] = useState(null);
    const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
    const hasCenteredUser = useRef(false);
    const socketRef = useRef(null);
    const gpsWatchRef = useRef(null);    // watchPosition ID for user location

    // ─── Continuous user location tracking (watchPosition) ───────────────────
    // Uses watchPosition instead of one-shot getCurrentPosition to:
    //  1. Force fresh GPS (maximumAge: 0) — not IP-based cached location
    //  2. Keep updating as admin moves
    //  3. Actually get DEVICE GPS coordinates, not server/IP location
    const startUserLocationWatch = useCallback(() => {
        if (!navigator.geolocation) {
            setGpsPermissionDenied(true);
            return;
        }

        // Stop any existing watch first
        if (gpsWatchRef.current !== null) {
            navigator.geolocation.clearWatch(gpsWatchRef.current);
            gpsWatchRef.current = null;
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setUserLocation([latitude, longitude]);
                setGpsPermissionDenied(false);
            },
            (err) => {
                console.warn('User GPS error:', err.message);
                setGpsPermissionDenied(true);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,        // Never use cached/IP position — always fresh
                timeout: 10000
            }
        );

        gpsWatchRef.current = watchId;
    }, []);

    // Manual "My Location" button re-centers the map to current user position
    const acquireUserLocation = useCallback(() => {
        if (userLocation) {
            setFlyTarget({ lat: userLocation[0], lng: userLocation[1] });
        } else {
            // If watch hasn't gotten a fix yet, try again
            startUserLocationWatch();
        }
    }, [userLocation, startUserLocationWatch]);

    // Initial Load
    useEffect(() => {
        // Start continuous GPS watch for user location
        startUserLocationWatch();

        const init = async () => {
            try {
                const vRes = await api.get('/transport/vehicles');
                const map = {};
                vRes.data.forEach(v => {
                    const hasCoords = v.current_lat && v.current_lng && parseFloat(v.current_lat) !== 0;
                    const isActive = hasCoords && v.status === 'Active';

                    map[v.id] = {
                        ...v,
                        current_lat: v.current_lat ? parseFloat(v.current_lat) : null,
                        current_lng: v.current_lng ? parseFloat(v.current_lng) : null,
                        speed: parseFloat(v.speed || 0),
                        heading: parseFloat(v.heading || 0),
                        _isLive: isActive,
                    };
                });
                setVehicleMap(map);

                const schoolId = user?.schoolId || (vRes.data.length > 0 ? vRes.data[0].school_id : null);
                if (schoolId) connectSocket(schoolId);

            } catch (err) {
                console.error('AdminLiveMap error:', err);
            } finally {
                setLoading(false);
            }
        };

        init();

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            // Clean up GPS watch on unmount
            if (gpsWatchRef.current !== null) {
                navigator.geolocation.clearWatch(gpsWatchRef.current);
                gpsWatchRef.current = null;
            }
        };
    }, [startUserLocationWatch]);

    // WebSocket connection
    const connectSocket = (schoolId) => {
        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 15,
            reconnectionDelay: 2000,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            socket.emit('join:school', schoolId);
        });

        socket.on('disconnect', () => setConnected(false));

        // Real-time vehicle location push
        socket.on('vehicle:location', (data) => {
            const now = new Date();
            const isActive = data.status === 'Active';
            setVehicleMap(prev => ({
                ...prev,
                [data.vehicleId]: {
                    ...prev[data.vehicleId],
                    id: data.vehicleId,
                    vehicle_number: data.vehicleNumber,
                    driver_name: data.driverName,
                    driver_phone: data.driverPhone || prev[data.vehicleId]?.driver_phone,
                    current_route_name: data.routeName || (isActive ? prev[data.vehicleId]?.current_route_name : null),
                    current_route_id: data.routeId || (isActive ? prev[data.vehicleId]?.current_route_id : null),
                    current_lat: !isNaN(parseFloat(data.lat)) ? parseFloat(data.lat) : prev[data.vehicleId]?.current_lat,
                    current_lng: !isNaN(parseFloat(data.lng)) ? parseFloat(data.lng) : prev[data.vehicleId]?.current_lng,
                    speed: parseFloat(data.speed || 0),
                    heading: parseFloat(data.heading || 0),
                    status: data.status,
                    _isLive: isActive,
                    _lastWS: now,
                },
            }));
            setUpdateLog(prev => ({ ...prev, [data.vehicleId]: now }));

            // ── MULTI-BUS STABILITY ──
            // Only follow camera if user explicitly selected this specific bus!
            // This prevents the camera from bouncing back and forth between multiple buses running simultaneously!
            if (selectedIdRef.current === data.vehicleId && isActive && !isNaN(parseFloat(data.lat)) && !isNaN(parseFloat(data.lng))) {
                setFlyTarget({ lat: parseFloat(data.lat), lng: parseFloat(data.lng), zoom: 16 });
            }
        });
    };

    const vehicles = Object.values(vehicleMap);
    // Only show buses on the map when the driver is actively on trip right now.
    // Must be marked 'Active' AND actively transmitting GPS (within last 3 minutes or received via live WebSocket).
    const liveVehicles = vehicles.filter(v => {
        if (!v.current_lat || !v.current_lng || parseFloat(v.current_lat) === 0) return false;
        if (v.status !== 'Active') return false;

        // If received via live WebSocket in this session, it is actively driving right now
        if (v._lastWS) return true;

        // If loaded from initial API fetch, only show if updated within the last 3 minutes
        if (v.last_updated) {
            const diffMs = Date.now() - new Date(v.last_updated).getTime();
            return diffMs >= 0 && diffMs < 3 * 60 * 1000;
        }

        return false;
    });

    // Disperse any vehicles that share the exact same or overlapping coordinates (e.g. testing from same device or depot)
    const dispersedVehicles = useMemo(() => {
        return getDispersedLiveVehicles(liveVehicles);
    }, [liveVehicles]);

    // Auto-fit all active buses on initial load, or focus single bus
    const hasAutoCenteredOnBus = useRef(false);
    useEffect(() => {
        if (!hasAutoCenteredOnBus.current && dispersedVehicles.length > 0) {
            hasAutoCenteredOnBus.current = true;
            if (dispersedVehicles.length === 1) {
                const firstLive = dispersedVehicles[0];
                const fLat = firstLive?.display_lat ?? firstLive?.current_lat;
                const fLng = firstLive?.display_lng ?? firstLive?.current_lng;
                if (fLat && fLng) {
                    setFlyTarget({ lat: fLat, lng: fLng, zoom: 16 });
                }
            } else {
                // Multiple running buses: fit bounds so admin sees all of them together
                setFitTrigger(prev => prev + 1);
            }
        }
    }, [dispersedVehicles.length]);

    // Bounding box containing all active buses
    const fleetBounds = (dispersedVehicles.length > 0)
        ? L.latLngBounds(dispersedVehicles.map(v => [v.display_lat ?? v.current_lat, v.display_lng ?? v.current_lng]))
        : null;

    const handleFitAllFleet = useCallback(() => {
        setSelectedId(null);
        setFitTrigger(prev => prev + 1);
    }, []);

    const handleVehicleClick = (v) => {
        const targetLat = v.display_lat ?? v.current_lat;
        const targetLng = v.display_lng ?? v.current_lng;
        if (!targetLat || !targetLng) return;
        if (selectedId === v.id) {
            // Toggling off focuses back to whole fleet
            setSelectedId(null);
            setFitTrigger(prev => prev + 1);
        } else {
            setSelectedId(v.id);
            setFlyTarget({ lat: parseFloat(targetLat), lng: parseFloat(targetLng), zoom: 16 });
        }
    };

    const getTimeSince = (vehicleId) => {
        const t = updateLog[vehicleId];
        if (!t) return null;
        const sec = Math.round((Date.now() - t.getTime()) / 1000);
        return sec < 60 ? `${sec}s ago` : `${Math.round(sec / 60)}m ago`;
    };

    // Prioritize active bus coordinates so viewer immediately sees the live bus
    const mapCenter = (liveVehicles.length > 0 && liveVehicles[0]?.current_lat && liveVehicles[0]?.current_lng)
        ? [liveVehicles[0].current_lat, liveVehicles[0].current_lng]
        : (userLocation ? userLocation : [20.5937, 78.9629]);

    const [mapType, setMapType] = useState('streets'); // 'streets' | 'hybrid' | 'osm'

    return (
        <div className="flex flex-col space-y-4 w-full">

            {/* Header Status Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Navigation className="text-indigo-600" size={22} />
                        Live Bus Fleet Tracking
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time driver GPS tracking • Instant WebSocket updates</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${connected ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
                        {connected ? 'WebSocket Live' : 'Connecting...'}
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        Active Buses: {liveVehicles.filter(v => v._isLive).length}
                    </div>
                    <div className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200">
                        Total Fleet: {vehicles.length}
                    </div>
                </div>
            </div>

            {/* Live Map */}
            <div className="w-full h-[580px] rounded-3xl overflow-hidden border border-slate-200 shadow-2xl relative z-0 bg-slate-100">
                {loading ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-2" />
                            <p className="text-slate-500 font-bold text-sm">Connecting to Live GPS Stream...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <MapContainer
                            center={mapCenter}
                            zoom={15}
                            maxZoom={20}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={true}
                        >
                            {mapType === 'streets' && (
                                <TileLayer
                                    attribution='&copy; Google Maps'
                                    url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                    maxZoom={20}
                                />
                            )}
                            {mapType === 'hybrid' && (
                                <TileLayer
                                    attribution='&copy; Google Maps'
                                    url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                                    maxZoom={20}
                                />
                            )}
                            {mapType === 'osm' && (
                                <TileLayer
                                    attribution='&copy; OpenStreetMap contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    maxZoom={19}
                                />
                            )}

                            <MapViewController target={flyTarget} bounds={fleetBounds} fitTrigger={fitTrigger} />

                            {/* User's Exact Current Location Marker */}
                            {userLocation && (
                                <Marker position={userLocation} icon={createUserLocationIcon()}>
                                    <Popup>
                                        <div className="text-center font-bold text-xs p-1">
                                            📍 You Are Here
                                        </div>
                                    </Popup>
                                </Marker>
                            )}

                            {/* Ola-style Smooth Moving Bus Markers */}
                            {dispersedVehicles.map(v => (
                                <SmoothBusMarker
                                    key={v.id}
                                    vehicle={v}
                                    isSelected={selectedId === v.id}
                                    onSelect={handleVehicleClick}
                                />
                            ))}
                        </MapContainer>

                        {/* Top Left Following Bus Focus Indicator */}
                        {selectedId && vehicleMap[selectedId] && (
                            <div className="absolute top-4 left-4 z-[1000] bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-3 text-xs font-bold pointer-events-auto">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                    <span>Focus: <strong className="text-yellow-400">{vehicleMap[selectedId].vehicle_number}</strong></span>
                                </div>
                                <button
                                    onClick={handleFitAllFleet}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-xl text-[11px] font-black transition-all active:scale-95 shadow-sm"
                                >
                                    Show All Fleet ✕
                                </button>
                            </div>
                        )}

                        {/* Map Controls: View All Fleet + Style Selector */}
                        <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl border border-slate-200/80 flex flex-wrap gap-1 text-xs font-bold pointer-events-auto">
                            {liveVehicles.length > 0 && (
                                <button
                                    onClick={handleFitAllFleet}
                                    className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${!selectedId ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}`}
                                    title="Fit all running buses on the screen"
                                >
                                    <span>👁️ All Fleet ({liveVehicles.length})</span>
                                </button>
                            )}
                            <button
                                onClick={() => setMapType('streets')}
                                className={`px-3 py-1.5 rounded-xl transition-all ${mapType === 'streets' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                                title="Detailed streets, shops, buildings, and landmarks"
                            >
                                🏬 Detailed Places
                            </button>
                            <button
                                onClick={() => setMapType('hybrid')}
                                className={`px-3 py-1.5 rounded-xl transition-all ${mapType === 'hybrid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                                title="Satellite view with place labels"
                            >
                                🛰️ Satellite + Labels
                            </button>
                            <button
                                onClick={() => setMapType('osm')}
                                className={`px-3 py-1.5 rounded-xl transition-all ${mapType === 'osm' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                                title="Standard map"
                            >
                                🌐 Standard
                            </button>
                        </div>

                        {/* My Location Floating Action Button */}
                        <button
                            onClick={acquireUserLocation}
                            className="absolute bottom-6 right-4 z-[1000] bg-white text-slate-800 hover:bg-slate-50 active:scale-95 p-3 rounded-2xl shadow-2xl border border-slate-200/80 font-bold text-xs flex items-center gap-2 transition-all pointer-events-auto cursor-pointer"
                            title="Center on My Live Location"
                        >
                            <MapPin size={16} className="text-blue-600" />
                            <span>My Location</span>
                        </button>
                    </>
                )}
            </div>

            {/* GPS Required Alert if location is off */}
            {gpsPermissionDenied && !userLocation && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                            <MapPin size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-amber-900 text-sm">GPS / Location is Turned Off</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                Please turn on location on your phone / browser to center the map on your exact neighborhood.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={startUserLocationWatch}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 whitespace-nowrap"
                    >
                        📍 Turn On GPS
                    </button>
                </div>
            )}

            {/* Fleet Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {vehicles.map(v => {
                    const isSelected = selectedId === v.id;
                    const hasCoords = Boolean(v.current_lat && v.current_lng && parseFloat(v.current_lat) !== 0);
                    const isLive = liveVehicles.some(lv => lv.id === v.id);
                    const since = getTimeSince(v.id);

                    return (
                        <button
                            key={v.id}
                            onClick={() => handleVehicleClick(v)}
                            disabled={!hasCoords}
                            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                                !hasCoords
                                    ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                                    : isSelected
                                        ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-300 shadow-lg'
                                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md active:scale-95'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                    <div className="font-black text-slate-800 text-base">{v.vehicle_number}</div>
                                </div>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {isLive ? 'ON TRIP' : 'STANDBY'}
                                </span>
                            </div>

                            {v.current_route_name && (
                                <div className="text-xs font-bold text-indigo-600 truncate mb-1">
                                    📍 {v.current_route_name}
                                </div>
                            )}

                            <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                                <span>👤 Driver:</span>
                                <strong className="text-slate-700">{v.driver_name || 'Unassigned'}</strong>
                            </div>

                            {hasCoords && (
                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-xs">
                                    <span className={`font-black px-2 py-0.5 rounded-lg ${v.speed > 60 ? 'bg-red-100 text-red-700' : v.speed > 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {Math.round(v.speed)} km/h
                                    </span>
                                    {since && <span className="text-[10px] text-slate-400 font-medium">{since}</span>}
                                </div>
                            )}
                        </button>
                    );
                })}

                {vehicles.length === 0 && !loading && (
                    <div className="col-span-full text-center text-slate-400 text-sm py-8 italic bg-white rounded-2xl border border-slate-200">
                        No vehicles registered yet. Add buses in Transport Management.
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminLiveMap;
