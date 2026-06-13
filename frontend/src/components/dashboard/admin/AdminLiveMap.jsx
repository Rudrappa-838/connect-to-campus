import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../../../api/axios';
import { useAuth } from '../../../context/AuthContext';
import { Bus, Navigation, Wifi, WifiOff, Gauge, Clock, MapPin, AlertTriangle } from 'lucide-react';
import { io } from 'socket.io-client';

// ── Icons ────────────────────────────────────────────
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({ iconUrl, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

const createBusIcon = (speed = 0, isLive = false) => {
    const color = !isLive ? '#94a3b8' : speed > 60 ? '#ef4444' : speed > 2 ? '#10b981' : '#f59e0b';
    return L.divIcon({
        className: 'custom-bus-icon',
        html: `<div style="position:relative;width:48px;height:48px;">
            <div style="background:${color};width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.35);">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/>
                    <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
                    <circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="17" cy="18" r="2"/>
                </svg>
            </div>
            ${isLive && speed > 2 ? `<div style="position:absolute;top:-4px;right:-6px;background:${speed > 60 ? '#ef4444' : '#10b981'};color:white;font-size:8px;font-weight:900;padding:2px 5px;border-radius:8px;border:1.5px solid white;white-space:nowrap;">${Math.round(speed)}</div>` : ''}
            ${isLive ? '<div style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;background:#10b981;border-radius:50%;border:2px solid white;animation:ping 1s infinite"></div>' : ''}
        </div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 48],
        popupAnchor: [0, -52],
    });
};

// ── Map fly-to controller ─────────────────────────────
const MapFlyTo = ({ target }) => {
    const map = useMap();
    useEffect(() => {
        if (target?.lat && target?.lng) {
            map.flyTo([target.lat, target.lng], 16, { animate: true, duration: 1.2 });
        }
    }, [target, map]);
    return null;
};

// ── WebSocket URL ─────────────────────────────────────
const SOCKET_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : (import.meta.env.PROD ? 'https://connect2campus.co.in' : 'http://localhost:5000');

const AdminLiveMap = () => {
    const { user } = useAuth();
    const [vehicleMap, setVehicleMap] = useState({}); // id → vehicle
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [flyTarget, setFlyTarget] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [updateLog, setUpdateLog] = useState({}); // vehicleId → last update time
    const [defaultCenter, setDefaultCenter] = useState(null);
    const [locationLoaded, setLocationLoaded] = useState(false);
    const socketRef = useRef(null);
    const schoolIdRef = useRef(null);

    // Get user's present location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setDefaultCenter([position.coords.latitude, position.coords.longitude]);
                    setLocationLoaded(true);
                },
                (error) => {
                    console.error("Location access denied:", error);
                    setDefaultCenter([12.9716, 77.5946]); // fallback
                    setLocationLoaded(true);
                }
            );
        } else {
            setDefaultCenter([12.9716, 77.5946]); // fallback
            setLocationLoaded(true);
        }
    }, []);

    // ── Initial REST load ─────────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                const [vRes, rRes] = await Promise.all([
                    api.get('/transport/vehicles'),
                    api.get('/transport/routes'),
                ]);

                // Seed vehicle map from REST
                const map = {};
                vRes.data.forEach(v => {
                    map[v.id] = {
                        id: v.id,
                        vehicle_number: v.vehicle_number,
                        driver_name: v.driver_name,
                        driver_phone: v.driver_phone,
                        current_lat: v.current_lat ? parseFloat(v.current_lat) : null,
                        current_lng: v.current_lng ? parseFloat(v.current_lng) : null,
                        speed: parseFloat(v.speed || 0),
                        status: v.status,
                        gps_device_id: v.gps_device_id,
                        _isLive: !!(v.current_lat && v.current_lng && parseFloat(v.current_lat) !== 0),
                    };
                });
                setVehicleMap(map);
                setRoutes(rRes.data);

                // Get school_id from user context (JWT) or from vehicle data
                const schoolId = user?.schoolId || (vRes.data.length > 0 ? vRes.data[0].school_id : null);
                if (schoolId) {
                    schoolIdRef.current = schoolId;
                    connectSocket(schoolId);
                }

            } catch (err) {
                console.error('AdminLiveMap init error:', err);
            } finally {
                setLoading(false);
            }
        };

        init();
        return () => { if (socketRef.current) socketRef.current.disconnect(); };
    }, []);

    // ── WebSocket connection ──────────────────────────
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

        // 🚀 Real-time vehicle location push
        socket.on('vehicle:location', (data) => {
            const now = new Date();
            setVehicleMap(prev => ({
                ...prev,
                [data.vehicleId]: {
                    ...prev[data.vehicleId],
                    id: data.vehicleId,
                    vehicle_number: data.vehicleNumber,
                    driver_name: data.driverName,
                    current_lat: parseFloat(data.lat),
                    current_lng: parseFloat(data.lng),
                    speed: parseFloat(data.speed || 0),
                    status: data.status,
                    _isLive: true,
                    _source: data.source,
                    _lastWS: now,
                },
            }));
            setUpdateLog(prev => ({ ...prev, [data.vehicleId]: now }));
        });
    };

    const vehicles = Object.values(vehicleMap);
    const liveVehicles = vehicles.filter(v => v._isLive && v.current_lat && v.current_lng);
    const offlineVehicles = vehicles.filter(v => !v._isLive);

    const handleVehicleClick = (v) => {
        if (!v._isLive) return;
        setSelectedId(v.id);
        setFlyTarget({ lat: v.current_lat, lng: v.current_lng });
    };

    const getTimeSince = (vehicleId) => {
        const t = updateLog[vehicleId];
        if (!t) return null;
        const sec = Math.round((Date.now() - t.getTime()) / 1000);
        return sec < 60 ? `${sec}s ago` : `${Math.round(sec / 60)}m ago`;
    };

    return (
        <div className="flex flex-col space-y-4 w-full">

            {/* ── Header ──────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Navigation className="text-indigo-600" size={20} />
                    Live Fleet Tracking
                </h2>
                <div className="flex flex-wrap gap-2 items-center">
                    {/* WebSocket status */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${connected ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {connected ? 'WebSocket Live' : 'Reconnecting...'}
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        Live: {liveVehicles.length} buses
                    </div>
                    <div className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200">
                        Total Fleet: {vehicles.length}
                    </div>
                </div>
            </div>

            {/* ── Map ─────────────────────────────────── */}
            <div className="w-full h-[560px] rounded-2xl overflow-hidden border border-slate-200 shadow-xl relative z-0 bg-slate-100">
                {loading || (!locationLoaded && liveVehicles.length === 0) ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2" />
                            <p className="text-slate-400 font-bold text-sm">
                                {loading ? "Connecting to GPS Network..." : "Getting your present location..."}
                            </p>
                        </div>
                    </div>
                ) : (
                    <MapContainer center={liveVehicles.length > 0 ? [liveVehicles[0].current_lat, liveVehicles[0].current_lng] : (defaultCenter || [12.9716, 77.5946])} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            attribution='Tiles &copy; Esri'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        />

                        <MapFlyTo target={flyTarget} />

                        {/* Live bus markers */}
                        {liveVehicles.map(v => (
                            <Marker
                                key={v.id}
                                position={[v.current_lat, v.current_lng]}
                                icon={createBusIcon(v.speed, true)}
                            >
                                <Popup>
                                    <div className="min-w-[160px] py-1">
                                        <div className="font-black text-slate-800 text-base mb-1">{v.vehicle_number}</div>
                                        <div className="text-xs text-slate-500 mb-2">Driver: {v.driver_name}</div>
                                        <div className="grid grid-cols-2 gap-1 text-[11px]">
                                            <div className="bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded text-center">
                                                {Math.round(v.speed)} km/h
                                            </div>
                                            <div className="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded text-center">
                                                {v._source === 'mobile' ? '📱 Mobile' : '📡 GPS'}
                                            </div>
                                        </div>
                                        {getTimeSince(v.id) && (
                                            <div className="text-[10px] text-slate-400 text-center mt-1">
                                                Updated {getTimeSince(v.id)}
                                            </div>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        ))}

                        {/* Route lines + stop markers */}
                        {routes.map(route => {
                            const positions = (route.stops || [])
                                .filter(s => s.lat && s.lng)
                                .map(s => [parseFloat(s.lat), parseFloat(s.lng)]);

                            if (positions.length < 2) return null;

                            return (
                                <React.Fragment key={`route-${route.id}`}>
                                    <Polyline
                                        positions={positions}
                                        pathOptions={{ color: '#4f46e5', weight: 3, opacity: 0.6, dashArray: '8 4' }}
                                    >
                                        <Popup>
                                            <div className="text-sm font-bold text-indigo-700">{route.route_name}</div>
                                            <div className="text-xs text-slate-500">{route.start_point} → {route.end_point}</div>
                                        </Popup>
                                    </Polyline>
                                    {(route.stops || []).filter(s => s.lat && s.lng).map((s, i) => (
                                        <CircleMarker
                                            key={`stop-${route.id}-${i}`}
                                            center={[parseFloat(s.lat), parseFloat(s.lng)]}
                                            pathOptions={{ color: '#4f46e5', fillColor: 'white', fillOpacity: 1, radius: 5, weight: 2 }}
                                        >
                                            <Popup>
                                                <div className="text-xs font-bold text-indigo-700">{s.stop_name}</div>
                                                <div className="text-xs text-slate-400">{s.pickup_time || ''}</div>
                                            </Popup>
                                        </CircleMarker>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </MapContainer>
                )}
            </div>

            {/* ── Vehicle Cards Grid ───────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {vehicles.map(v => {
                    const isSelected = selectedId === v.id;
                    const since = getTimeSince(v.id);
                    return (
                        <button
                            key={v.id}
                            onClick={() => handleVehicleClick(v)}
                            disabled={!v._isLive}
                            className={`p-3 rounded-xl border shadow-sm text-left transition-all ${
                                !v._isLive
                                    ? 'opacity-60 bg-slate-50 cursor-not-allowed'
                                    : isSelected
                                        ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200'
                                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md active:scale-95'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${v._isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                <div className="font-bold text-slate-800 text-sm truncate">{v.vehicle_number}</div>
                            </div>
                            <div className="text-xs text-slate-500 truncate">{v.driver_name || 'No driver'}</div>
                            {v._isLive && (
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${v.speed > 60 ? 'bg-red-100 text-red-700' : v.speed > 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {Math.round(v.speed)} km/h
                                    </span>
                                    {v._source && (
                                        <span className="text-[10px] text-slate-400">
                                            {v._source === 'mobile' ? '📱' : '📡'}
                                        </span>
                                    )}
                                    {since && <span className="text-[10px] text-slate-400 ml-auto">{since}</span>}
                                </div>
                            )}
                            {!v._isLive && (
                                <div className="text-[10px] text-slate-400 mt-1">Offline / No Signal</div>
                            )}
                        </button>
                    );
                })}
                {vehicles.length === 0 && !loading && (
                    <div className="col-span-full text-center text-slate-400 text-sm py-8 italic">
                        No vehicles registered yet. Add vehicles in Transport Management.
                    </div>
                )}
            </div>

            {/* ── GPS Source Legend ────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Tracking Sources</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <span className="text-base">📡</span>
                        <div>
                            <p className="font-bold text-blue-800">Hardware GPS</p>
                            <p className="text-blue-600 mt-0.5">Any GPS device (Jimi, Teltonika, Concox, Meitrack, etc.) sends data to webhook. Format auto-detected.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                        <span className="text-base">📱</span>
                        <div>
                            <p className="font-bold text-emerald-800">Driver Mobile App</p>
                            <p className="text-emerald-600 mt-0.5">Driver opens app → Start Trip. Uses phone GPS. Works without any hardware device.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <span className="text-base">⚡</span>
                        <div>
                            <p className="font-bold text-indigo-800">WebSocket Real-time</p>
                            <p className="text-indigo-600 mt-0.5">Map updates instantly (&lt;1 second) when GPS data arrives. No polling or refresh needed.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLiveMap;
