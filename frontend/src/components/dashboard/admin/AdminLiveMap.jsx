import React, { useEffect, useState, useRef } from 'react';
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
        <div style="position: absolute; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; pointer-events: none; z-index: ${isSelected ? 1000 : 500};">
            <!-- Compact Floating Badge directly above Bus Icon -->
            <div style="background: ${isSelected ? 'rgba(30, 27, 75, 0.96)' : 'rgba(15, 23, 42, 0.92)'}; backdrop-filter: blur(6px); color: white; padding: 3px 7px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: ${isSelected ? '1.5px solid #818cf8' : '1px solid rgba(255,255,255,0.2)'}; white-space: nowrap; text-align: center; margin-bottom: 3px; min-width: 90px; max-width: 150px; pointer-events: auto;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 800; font-size: 11px; color: #facc15;">
                    <span>🚌 ${vehicleNumber}</span>
                    <span style="background: ${!isLive ? '#64748b' : speed > 60 ? '#ef4444' : isMoving ? '#10b981' : '#f59e0b'}; color: white; font-size: 8px; font-weight: 800; padding: 0.5px 4px; border-radius: 4px;">
                        ${!isLive ? 'Off' : isMoving ? `${Math.round(speed)}k` : 'Stop'}
                    </span>
                </div>
                ${routeName ? `<div style="font-size: 9px; font-weight: 600; color: #93c5fd; margin-top: 1px; max-width: 140px; overflow: hidden; text-overflow: ellipsis;">📍 ${routeName}</div>` : ''}
                ${driverName ? `<div style="font-size: 8.5px; color: #cbd5e1; margin-top: 0.5px;">👤 ${driverName}</div>` : ''}
            </div>

            <!-- Small Bus Icon with Radar Pulse & Directional Rotation -->
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
        className: 'custom-admin-bus-icon-wrapper',
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

const MapFlyTo = ({ target }) => {
    const map = useMap();
    useEffect(() => {
        if (target?.lat && target?.lng) {
            map.flyTo([target.lat, target.lng], 16, { animate: true, duration: 1.0 });
        }
    }, [target, map]);
    return null;
};

/**
 * SmoothBusMarker — animates each bus marker smoothly to its new GPS position in Admin Live Map.
 */
const SmoothBusMarker = ({ vehicle, isSelected }) => {
    const markerRef = useRef(null);
    const prevPosRef = useRef(null);

    const lat = parseFloat(vehicle.current_lat);
    const lng = parseFloat(vehicle.current_lng);
    const icon = createLiveBusIcon(vehicle, isSelected);

    useEffect(() => {
        if (!markerRef.current) return;
        const marker = markerRef.current;
        if (isNaN(lat) || isNaN(lng)) return;

        const prev = prevPosRef.current;
        if (prev && (prev[0] !== lat || prev[1] !== lng)) {
            marker.setLatLng([lat, lng]);
        }
        marker.setIcon(icon);
        prevPosRef.current = [lat, lng];
    }, [vehicle.current_lat, vehicle.current_lng, vehicle.speed, vehicle.heading, vehicle.status, isSelected]);

    if (isNaN(lat) || isNaN(lng)) return null;
    return <Marker ref={markerRef} position={[lat, lng]} icon={icon} />;
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
    const [updateLog, setUpdateLog] = useState({});
    const [userLocation, setUserLocation] = useState(null);
    const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
    const hasCenteredUser = useRef(false);
    const socketRef = useRef(null);

    // Acquire User's Exact Live Location
    const acquireUserLocation = async () => {
        try {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const { latitude, longitude } = pos.coords;
                        setUserLocation([latitude, longitude]);
                        setGpsPermissionDenied(false);
                        if (!hasCenteredUser.current) {
                            hasCenteredUser.current = true;
                            setFlyTarget({ lat: latitude, lng: longitude });
                        }
                    },
                    (err) => {
                        console.warn("User GPS prompt / error:", err.message);
                        setGpsPermissionDenied(true);
                    },
                    { enableHighAccuracy: true, timeout: 8000 }
                );
            }
        } catch (e) {
            setGpsPermissionDenied(true);
        }
    };

    // Initial Load
    useEffect(() => {
        acquireUserLocation();

        const init = async () => {
            try {
                const vRes = await api.get('/transport/vehicles');
                const map = {};
                vRes.data.forEach(v => {
                    const hasCoords = v.current_lat && v.current_lng && parseFloat(v.current_lat) !== 0;
                    map[v.id] = {
                        ...v,
                        current_lat: v.current_lat ? parseFloat(v.current_lat) : null,
                        current_lng: v.current_lng ? parseFloat(v.current_lng) : null,
                        speed: parseFloat(v.speed || 0),
                        heading: parseFloat(v.heading || 0),
                        _isLive: hasCoords && (v.status === 'Active'),
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
        return () => { if (socketRef.current) socketRef.current.disconnect(); };
    }, []);

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
            setVehicleMap(prev => ({
                ...prev,
                [data.vehicleId]: {
                    ...prev[data.vehicleId],
                    id: data.vehicleId,
                    vehicle_number: data.vehicleNumber,
                    driver_name: data.driverName,
                    driver_phone: data.driverPhone || prev[data.vehicleId]?.driver_phone,
                    current_route_name: data.routeName || prev[data.vehicleId]?.current_route_name,
                    current_route_id: data.routeId || prev[data.vehicleId]?.current_route_id,
                    current_lat: parseFloat(data.lat),
                    current_lng: parseFloat(data.lng),
                    speed: parseFloat(data.speed || 0),
                    heading: parseFloat(data.heading || 0),
                    status: data.status,
                    _isLive: true,
                    _lastWS: now,
                },
            }));
            setUpdateLog(prev => ({ ...prev, [data.vehicleId]: now }));
        });
    };

    const vehicles = Object.values(vehicleMap);
    const liveVehicles = vehicles.filter(v => v.current_lat && v.current_lng && parseFloat(v.current_lat) !== 0);

    const handleVehicleClick = (v) => {
        if (!v.current_lat || !v.current_lng) return;
        setSelectedId(v.id);
        setFlyTarget({ lat: v.current_lat, lng: v.current_lng });
    };

    const getTimeSince = (vehicleId) => {
        const t = updateLog[vehicleId];
        if (!t) return null;
        const sec = Math.round((Date.now() - t.getTime()) / 1000);
        return sec < 60 ? `${sec}s ago` : `${Math.round(sec / 60)}m ago`;
    };

    // Prioritize user's actual current location as initial center
    const mapCenter = userLocation
        ? userLocation
        : (liveVehicles.length > 0 ? [liveVehicles[0].current_lat, liveVehicles[0].current_lng] : [20.5937, 78.9629]);

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

            {/* Live Map (No Polylines - Pure Live Bus Icons with Complete Street & Location Details) */}
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
                        {/* Map Style Selector: Detailed Streets / Hybrid / Standard */}
                        <div className="absolute top-4 right-4 z-[400] bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-xl border border-slate-200/80 flex gap-1 text-xs font-bold">
                            <button
                                onClick={() => setMapType('streets')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${mapType === 'streets' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                                title="Detailed streets, shops, buildings, and landmarks"
                            >
                                🏬 Detailed Places
                            </button>
                            <button
                                onClick={() => setMapType('hybrid')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${mapType === 'hybrid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                                title="Satellite view with place labels"
                            >
                                🛰️ Satellite + Labels
                            </button>
                            <button
                                onClick={() => setMapType('osm')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${mapType === 'osm' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                                title="Standard map"
                            >
                                🌐 Standard
                            </button>
                        </div>

                        <MapContainer
                            center={mapCenter}
                            zoom={15}
                            maxZoom={20}
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

                            <MapFlyTo target={flyTarget} />

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

                            {/* Live Moving Bus Markers with Floating Badges */}
                            {liveVehicles.map(v => (
                                <SmoothBusMarker
                                    key={v.id}
                                    vehicle={v}
                                    isSelected={selectedId === v.id}
                                />
                            ))}
                        </MapContainer>

                        {/* My Location Floating Action Button */}
                        <button
                            onClick={() => {
                                acquireUserLocation();
                                if (userLocation) {
                                    setFlyTarget({ lat: userLocation[0], lng: userLocation[1] });
                                }
                            }}
                            className="absolute bottom-6 right-4 z-[400] bg-white text-slate-800 hover:bg-slate-50 active:scale-95 p-3 rounded-2xl shadow-2xl border border-slate-200/80 font-bold text-xs flex items-center gap-2 transition-all"
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
                        onClick={acquireUserLocation}
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
                    const hasCoords = v.current_lat && v.current_lng && parseFloat(v.current_lat) !== 0;
                    const isLive = v._isLive || (hasCoords && v.status === 'Active');
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
