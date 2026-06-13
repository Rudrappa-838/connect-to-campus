import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import { Bus, Phone, Navigation, AlertCircle, Wifi, WifiOff, Gauge, Clock, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import api from '../../../api/axios';
import { io } from 'socket.io-client';
import L from 'leaflet';

// ── Custom Bus Icon ─────────────────────────────────
const createBusIcon = (speed = 0) => {
    const isMoving = speed > 2;
    const color = speed > 60 ? '#ef4444' : isMoving ? '#10b981' : '#f59e0b';
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
            ${isMoving ? `<div style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:white;font-size:8px;font-weight:900;padding:2px 4px;border-radius:8px;border:1px solid white;white-space:nowrap;">${Math.round(speed)} km/h</div>` : ''}
        </div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 48],
        popupAnchor: [0, -52],
    });
};

// ── Smooth Map Recentering ───────────────────────────
const SmoothRecenter = ({ lat, lng }) => {
    const map = useMap();
    const prevPos = useRef(null);
    useEffect(() => {
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
        if (prevPos.current) {
            const dist = map.distance(prevPos.current, [lat, lng]);
            if (dist > 5) { // Move only if bus moved > 5 meters
                map.panTo([lat, lng], { animate: true, duration: 0.8 });
            }
        } else {
            map.setView([lat, lng], 15, { animate: false });
        }
        prevPos.current = [lat, lng];
    }, [lat, lng, map]);
    return null;
};

// ── WebSocket URL ────────────────────────────────────
const SOCKET_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : (import.meta.env.PROD ? 'https://connect2campus.co.in' : 'http://localhost:5000');

const StudentTransport = () => {
    const [routeInfo, setRouteInfo] = useState(null);
    const [busState, setBusState] = useState(null); // Live GPS data
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [connected, setConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);
    const socketRef = useRef(null);

    // ── Step 1: Fetch route info (REST — one time) ──
    useEffect(() => {
        const fetchRoute = async () => {
            try {
                const res = await api.get('/transport/my-route');
                const data = res.data;
                setRouteInfo(data);

                // Seed initial bus position from REST
                if (data.current_lat && data.current_lng) {
                    setBusState({
                        lat: parseFloat(data.current_lat),
                        lng: parseFloat(data.current_lng),
                        speed: parseFloat(data.speed || 0),
                        status: data.vehicle_status,
                        vehicleNumber: data.vehicle_number,
                        driverName: data.driver_name,
                    });
                }

                setLoading(false);

                // ── Step 2: Connect WebSocket for real-time updates ──
                const schoolId = data.school_id;
                connectSocket(schoolId, data.vehicle_id || data.id);

            } catch (err) {
                setError(err.response?.data?.message || 'Transport not assigned. Contact school admin.');
                setLoading(false);
            }
        };

        fetchRoute();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    const connectSocket = (schoolId, vehicleId) => {
        if (!schoolId) return;

        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            socket.emit('join:school', schoolId);
        });

        socket.on('disconnect', () => setConnected(false));

        // 🚀 Real-time GPS push — instant, no polling lag
        socket.on('vehicle:location', (data) => {
            // Only update if it's MY bus
            if (vehicleId && data.vehicleId !== vehicleId) return;

            setBusState({
                lat: parseFloat(data.lat),
                lng: parseFloat(data.lng),
                speed: parseFloat(data.speed || 0),
                status: data.status,
                vehicleNumber: data.vehicleNumber,
                driverName: data.driverName,
                source: data.source,
            });
            setLastUpdate(new Date());
        });
    };

    const timeSinceUpdate = lastUpdate
        ? Math.round((Date.now() - lastUpdate.getTime()) / 1000)
        : null;

    if (loading) return (
        <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Loading transport details...</p>
        </div>
    );

    if (error || !routeInfo) return (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-sm">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bus className="text-slate-400" size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700">No Transport Assigned</h3>
            <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto">{error}</p>
        </div>
    );

    const isLive = busState && busState.status === 'Active';
    const mapCenter = busState ? [busState.lat, busState.lng] : [12.9716, 77.5946];
    const speed = busState?.speed || 0;

    return (
        <div className="space-y-5 animate-in fade-in">

            {/* ── Header Card ─────────────────────────────── */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Bus className="text-indigo-600" size={22} />
                        My School Bus
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* WebSocket Connection Badge */}
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${connected ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                            {connected ? <Wifi size={11} /> : <WifiOff size={11} />}
                            {connected ? 'Live' : 'Connecting...'}
                        </div>
                        {/* Bus Status Badge */}
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold animate-pulse ${isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {isLive ? 'Bus Active' : 'Offline'}
                        </div>
                    </div>
                </div>

                {/* ── Live Map ─────────────────────────────── */}
                <div className="h-72 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner relative">
                    {!isLive && (
                        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm rounded-xl">
                            <div className="bg-white rounded-xl p-4 text-center shadow-xl">
                                <Bus size={32} className="text-slate-400 mx-auto mb-2" />
                                <p className="text-sm font-bold text-slate-700">Bus Not Active Yet</p>
                                <p className="text-xs text-slate-500 mt-1">Tracking will appear when bus starts</p>
                            </div>
                        </div>
                    )}
                    <MapContainer
                        center={mapCenter}
                        zoom={14}
                        scrollWheelZoom={false}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={true}
                    >
                        <TileLayer
                            attribution='Tiles &copy; Esri'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        />

                        {busState && (
                            <>
                                <SmoothRecenter lat={busState.lat} lng={busState.lng} />
                                <Marker position={[busState.lat, busState.lng]} icon={createBusIcon(speed)}>
                                    <Popup>
                                        <div className="text-center p-1 min-w-[130px]">
                                            <p className="font-bold text-indigo-700 text-base">{busState.vehicleNumber}</p>
                                            <p className="text-xs text-slate-500 mt-1">Driver: {busState.driverName}</p>
                                            <div className="mt-2 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-1 rounded-lg">
                                                {speed > 0 ? `${Math.round(speed)} km/h` : 'Stationary'}
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            </>
                        )}

                        {/* Route stops */}
                        {routeInfo?.stops?.filter(s => s.lat && s.lng).map((stop, i) => (
                            <CircleMarker
                                key={i}
                                center={[parseFloat(stop.lat), parseFloat(stop.lng)]}
                                pathOptions={{ color: '#4f46e5', fillColor: 'white', fillOpacity: 1, radius: 6 }}
                            >
                                <Popup>
                                    <div className="text-xs font-bold text-indigo-700">{stop.stop_name}</div>
                                    <div className="text-xs text-slate-500">{stop.pickup_time || ''}</div>
                                </Popup>
                            </CircleMarker>
                        ))}
                    </MapContainer>
                </div>

                {/* ── Live Speed + Update Bar ───────────────── */}
                {isLive && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 border border-slate-100">
                            <div className={`p-2 rounded-lg ${speed > 60 ? 'bg-red-100' : speed > 2 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                                <Gauge size={18} className={speed > 60 ? 'text-red-600' : speed > 2 ? 'text-emerald-600' : 'text-amber-600'} />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Speed</p>
                                <p className="font-bold text-slate-800 text-base">{Math.round(speed)} <span className="text-xs text-slate-500">km/h</span></p>
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 border border-slate-100">
                            <div className="bg-blue-100 p-2 rounded-lg">
                                <Clock size={18} className="text-blue-600" />
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Updated</p>
                                <p className="font-bold text-slate-800 text-sm">
                                    {timeSinceUpdate !== null ? `${timeSinceUpdate}s ago` : 'Just now'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Info Grid ────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-xl flex items-center gap-4 border border-slate-200 shadow-sm">
                    <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
                        <Bus size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Bus Number</p>
                        <p className="font-bold text-slate-800 text-lg">{routeInfo.vehicle_number || 'N/A'}</p>
                    </div>
                </div>

                <div className="p-4 bg-white rounded-xl flex items-center gap-4 border border-slate-200 shadow-sm">
                    <div className="bg-emerald-100 p-3 rounded-full text-emerald-600">
                        <Phone size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Driver</p>
                        <p className="font-bold text-slate-800">{routeInfo.driver_name || 'Assigned'}</p>
                        <a href={`tel:${routeInfo.driver_phone}`} className="text-xs text-indigo-600 font-medium hover:underline">
                            {routeInfo.driver_phone || 'N/A'}
                        </a>
                    </div>
                </div>

                <div className="p-4 bg-white rounded-xl flex items-center gap-4 border border-slate-200 shadow-sm">
                    <div className="bg-amber-100 p-3 rounded-full text-amber-600">
                        <MapPin size={22} />
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Pickup Point</p>
                        <p className="font-bold text-slate-800 line-clamp-1">{routeInfo.pickup_point || 'School'}</p>
                        <p className="text-xs text-slate-500">Time: <span className="font-bold text-slate-700">{routeInfo.pickup_time || 'N/A'}</span></p>
                    </div>
                </div>
            </div>

            {/* ── Route Path Info ──────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2">
                    <Navigation size={14} className="text-indigo-600" />
                    Route: {routeInfo.route_name}
                </h4>
                <div className="space-y-2">
                    {(routeInfo.stops || []).map((stop, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                            <div className="flex-1 text-sm text-slate-700">{stop.stop_name}</div>
                            <div className="text-xs text-slate-400">{stop.pickup_time || ''}</div>
                        </div>
                    ))}
                    {(!routeInfo.stops || routeInfo.stops.length === 0) && (
                        <p className="text-xs text-slate-400 italic">No stops configured</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudentTransport;
