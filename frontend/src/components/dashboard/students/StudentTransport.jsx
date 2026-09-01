import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Bus, Phone, Navigation, AlertCircle, Wifi, WifiOff, Gauge, Clock, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import api from '../../../api/axios';
import { io } from 'socket.io-client';
import L from 'leaflet';

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: null,
    iconUrl: null,
    shadowUrl: null,
});

// Custom School Bus Marker with Floating Info Card on top
// Custom School Bus Marker with Floating Info Card on top (Compact Size)
const createLiveBusIcon = (busState) => {
    const vehicleNumber = busState.vehicleNumber || busState.vehicle_number || 'School Bus';
    const driverName = busState.driverName || busState.driver_name || '';
    const routeName = busState.routeName || busState.current_route_name || busState.route_name || '';
    const speed = parseFloat(busState.speed || 0);
    const heading = parseFloat(busState.heading || 0);
    const isMoving = speed > 2;
    const isLive = busState.status === 'Active';

    const html = `
        <div style="position: absolute; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; pointer-events: none;">
            <!-- Compact Floating Badge attached on Top of Bus Icon -->
            <div style="background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(6px); color: white; padding: 3px 7px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.2); white-space: nowrap; text-align: center; margin-bottom: 3px; min-width: 90px; max-width: 150px; pointer-events: auto;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 800; font-size: 11px; color: #facc15;">
                    <span>🚌 ${vehicleNumber}</span>
                    <span style="background: ${!isLive ? '#64748b' : speed > 60 ? '#ef4444' : isMoving ? '#10b981' : '#f59e0b'}; color: white; font-size: 8px; font-weight: 800; padding: 0.5px 4px; border-radius: 4px;">
                        ${!isLive ? 'Off' : isMoving ? `${Math.round(speed)}k` : 'Stop'}
                    </span>
                </div>
                ${routeName ? `<div style="font-size: 9px; font-weight: 600; color: #93c5fd; margin-top: 1px; max-width: 140px; overflow: hidden; text-overflow: ellipsis;">📍 ${routeName}</div>` : ''}
                ${driverName ? `<div style="font-size: 8.5px; color: #cbd5e1; margin-top: 0.5px;">👤 ${driverName}</div>` : ''}
            </div>

            <!-- Small Bus Icon with Radar Pulse -->
            <div style="position: relative; width: 32px; height: 32px;">
                <div style="background: #fbbf24; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #0f172a; box-shadow: 0 3px 10px rgba(0,0,0,0.35); transform: rotate(${heading}deg); transition: transform 0.3s ease;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path>
                        <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path>
                        <circle cx="7" cy="18" r="2"></circle><path d="M9 18h5"></path><circle cx="17" cy="18" r="2"></circle>
                    </svg>
                </div>
                ${isLive ? '<div style="position: absolute; bottom: -1px; right: -1px; width: 9px; height: 9px; background: #10b981; border-radius: 50%; border: 1.5px solid white; animation: ping 1s infinite;"></div>' : ''}
            </div>
        </div>
    `;

    return L.divIcon({
        className: 'custom-student-bus-icon-wrapper',
        html: html,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
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

const SmoothRecenter = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            map.panTo([lat, lng], { animate: true, duration: 0.8 });
        }
    }, [lat, lng, map]);
    return null;
};

const SOCKET_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : (import.meta.env.PROD ? 'https://connect2campus.co.in' : 'http://localhost:5000');

const StudentTransport = () => {
    const [routeInfo, setRouteInfo] = useState(null);
    const [busState, setBusState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [connected, setConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [mapType, setMapType] = useState('streets'); // 'streets' | 'hybrid' | 'osm'
    const [userLocation, setUserLocation] = useState(null);
    const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
    const socketRef = useRef(null);

    // Acquire Student / Parent's Exact Current Location
    const acquireUserLocation = async () => {
        try {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const { latitude, longitude } = pos.coords;
                        setUserLocation([latitude, longitude]);
                        setGpsPermissionDenied(false);
                    },
                    (err) => {
                        console.warn("Student GPS prompt / error:", err.message);
                        setGpsPermissionDenied(true);
                    },
                    { enableHighAccuracy: true, timeout: 8000 }
                );
            }
        } catch (e) {
            setGpsPermissionDenied(true);
        }
    };

    useEffect(() => {
        acquireUserLocation();
        const fetchRoute = async () => {
            try {
                const res = await api.get('/transport/my-route');
                const data = res.data;
                setRouteInfo(data);

                if (data.current_lat && data.current_lng) {
                    setBusState({
                        lat: parseFloat(data.current_lat),
                        lng: parseFloat(data.current_lng),
                        speed: parseFloat(data.speed || 0),
                        heading: parseFloat(data.heading || 0),
                        status: data.vehicle_status || data.status,
                        vehicleNumber: data.vehicle_number,
                        driverName: data.driver_name,
                        driverPhone: data.driver_phone,
                        routeName: data.current_route_name || data.route_name,
                    });
                }

                setLoading(false);

                const schoolId = data.school_id;
                connectSocket(schoolId, data.vehicle_id || data.id);

            } catch (err) {
                // Fallback: If no route specifically assigned, try loading school's first vehicle
                try {
                    const vRes = await api.get('/transport/vehicles');
                    if (vRes.data.length > 0) {
                        const firstV = vRes.data[0];
                        setRouteInfo({
                            vehicle_number: firstV.vehicle_number,
                            driver_name: firstV.driver_name,
                            driver_phone: firstV.driver_phone,
                            route_name: firstV.current_route_name || 'School Bus Route',
                            school_id: firstV.school_id,
                            vehicle_id: firstV.id
                        });
                        if (firstV.current_lat && firstV.current_lng) {
                            setBusState({
                                lat: parseFloat(firstV.current_lat),
                                lng: parseFloat(firstV.current_lng),
                                speed: parseFloat(firstV.speed || 0),
                                heading: parseFloat(firstV.heading || 0),
                                status: firstV.status,
                                vehicleNumber: firstV.vehicle_number,
                                driverName: firstV.driver_name,
                                driverPhone: firstV.driver_phone,
                                routeName: firstV.current_route_name,
                            });
                        }
                        connectSocket(firstV.school_id, firstV.id);
                    } else {
                        setError('No transport route assigned. Contact school admin.');
                    }
                } catch (fallbackErr) {
                    setError('Transport details not found. Contact school admin.');
                }
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

    const connectSocket = (schoolId, targetVehicleId) => {
        if (!schoolId) return;

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

        // Real-time GPS push
        socket.on('vehicle:location', (data) => {
            if (targetVehicleId && data.vehicleId !== targetVehicleId && targetVehicleId !== data.id) {
                // If we don't have a specific bus, accept any active bus
                if (busState && busState.vehicleId && busState.vehicleId !== data.vehicleId) return;
            }

            setBusState({
                lat: parseFloat(data.lat),
                lng: parseFloat(data.lng),
                speed: parseFloat(data.speed || 0),
                heading: parseFloat(data.heading || 0),
                status: data.status,
                vehicleNumber: data.vehicleNumber,
                driverName: data.driverName,
                driverPhone: data.driverPhone,
                routeName: data.routeName || routeInfo?.route_name,
            });
            setLastUpdate(new Date());
        });
    };

    const timeSinceUpdate = lastUpdate
        ? Math.round((Date.now() - lastUpdate.getTime()) / 1000)
        : null;

    if (loading) return (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
            <p className="text-slate-500 font-bold text-sm">Connecting to Live Bus GPS...</p>
        </div>
    );

    if (error && !routeInfo) return (
        <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center shadow-sm">
            <div className="bg-indigo-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 text-indigo-600">
                <Bus size={36} />
            </div>
            <h3 className="text-xl font-black text-slate-800">Transport Status</h3>
            <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto">{error}</p>
        </div>
    );

    const isLive = busState && busState.status === 'Active';
    const mapCenter = (busState?.lat && busState?.lng)
        ? [busState.lat, busState.lng]
        : userLocation || [20.5937, 78.9629];
    const speed = busState?.speed || 0;

    return (
        <div className="space-y-4 animate-in fade-in">

            {/* Top Status Header */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
                            <Bus className="text-indigo-600" size={24} />
                            {routeInfo?.vehicle_number || busState?.vehicleNumber || 'School Bus'}
                        </h3>
                        {routeInfo?.route_name && (
                            <p className="text-xs font-bold text-indigo-600 mt-0.5">
                                📍 {routeInfo.route_name}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${connected ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                            {connected ? 'Live' : 'Connecting...'}
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isLive ? 'bg-emerald-100 text-emerald-700 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {isLive ? 'On Trip' : 'Standby'}
                        </div>
                    </div>
                </div>

                {/* Live Map (No Polylines - Pure Bus Marker with Floating Badge and Detailed Locations) */}
                <div className="h-96 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative z-0">
                    {/* Map Style Selector */}
                    <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200 flex gap-1 text-[11px] font-bold">
                        <button
                            onClick={() => setMapType('streets')}
                            className={`px-2.5 py-1 rounded-lg transition-all ${mapType === 'streets' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                            title="Detailed streets, shops, buildings, and landmarks"
                        >
                            🏬 Places & Streets
                        </button>
                        <button
                            onClick={() => setMapType('hybrid')}
                            className={`px-2.5 py-1 rounded-lg transition-all ${mapType === 'hybrid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                            title="Satellite view with place labels"
                        >
                            🛰️ Satellite
                        </button>
                    </div>

                    <MapContainer
                        center={mapCenter}
                        zoom={16}
                        maxZoom={20}
                        scrollWheelZoom={true}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={true}
                    >
                        {/* Detailed Google Street Map with all shops, businesses, landmarks, and area details */}
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

                        {/* User's Current Location (Your Location) */}
                        {userLocation && (
                            <Marker position={userLocation} icon={createUserLocationIcon()}>
                                <Popup>
                                    <div className="text-center font-bold text-xs p-1">
                                        📍 You Are Here
                                    </div>
                                </Popup>
                            </Marker>
                        )}

                        {/* Live Moving Bus Marker */}
                        {busState && busState.lat && busState.lng && (
                            <>
                                <SmoothRecenter lat={busState.lat} lng={busState.lng} />
                                <Marker
                                    position={[busState.lat, busState.lng]}
                                    icon={createLiveBusIcon(busState)}
                                />
                            </>
                        )}
                    </MapContainer>

                    {/* Center on My Location Button */}
                    {userLocation && (
                        <button
                            onClick={() => acquireUserLocation()}
                            className="absolute bottom-4 right-4 z-[400] bg-white text-slate-800 hover:bg-slate-50 p-2.5 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                            title="Center on My Location"
                        >
                            <MapPin size={14} className="text-blue-600" />
                            <span>My Location</span>
                        </button>
                    )}
                </div>

                {/* GPS Required Alert if location is off */}
                {gpsPermissionDenied && !userLocation && (
                    <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                                <MapPin size={18} />
                            </div>
                            <div>
                                <p className="font-bold text-amber-900 text-xs">GPS is Disabled</p>
                                <p className="text-[11px] text-amber-700">Turn on device location to see your distance from the bus.</p>
                            </div>
                        </div>
                        <button
                            onClick={acquireUserLocation}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow transition-all active:scale-95 whitespace-nowrap"
                        >
                            Turn On GPS
                        </button>
                    </div>
                )}

                {/* Speed & Sync Info Bar */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
                        <div className={`p-2.5 rounded-xl ${speed > 60 ? 'bg-red-100 text-red-600' : speed > 2 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            <Gauge size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Current Speed</p>
                            <p className="font-black text-slate-800 text-base">
                                {Math.round(speed)} <span className="text-xs text-slate-500 font-medium">km/h</span>
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
                        <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Last Sync</p>
                            <p className="font-black text-slate-800 text-sm">
                                {timeSinceUpdate !== null ? `${timeSinceUpdate}s ago` : 'Live'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Driver & Contact Card */}
            {(routeInfo?.driver_name || busState?.driverName) && (
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-lg">
                            👤
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Bus Driver</div>
                            <div className="font-black text-slate-800 text-base">
                                {routeInfo?.driver_name || busState?.driverName}
                            </div>
                            <div className="text-xs text-slate-500">
                                {routeInfo?.driver_phone || busState?.driverPhone || 'Contact School'}
                            </div>
                        </div>
                    </div>

                    {(routeInfo?.driver_phone || busState?.driverPhone) && (
                        <a
                            href={`tel:${routeInfo?.driver_phone || busState?.driverPhone}`}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all"
                        >
                            <Phone size={14} /> Call Driver
                        </a>
                    )}
                </div>
            )}
        </div>
    );
};

export default StudentTransport;
