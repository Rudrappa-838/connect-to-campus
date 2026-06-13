import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Bus, Navigation } from 'lucide-react';
import api from '../../../api/axios';
import { io } from 'socket.io-client';
import { useAuth } from '../../../context/AuthContext';

// Fix for default Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: null,
    iconUrl: null,
    shadowUrl: null,
});

const createBusIcon = () => {
    return L.divIcon({
        className: 'custom-bus-icon',
        html: `<div style="background-color: #fbbf24; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #000; box-shadow: 0 4px 10px rgba(0,0,0,0.3); position: relative;">
                <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #000;"></div>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path><circle cx="7" cy="18" r="2"></circle><path d="M9 18h5"></path><circle cx="17" cy="18" r="2"></circle>
                </svg>
               </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 48], // Tip of the triangle at bottom
        popupAnchor: [0, -48],
    });
};

const RecenterMap = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) {
            map.setView([lat, lng], 14);
            map.invalidateSize(); // Fix for gray tiles issues
        }
    }, [lat, lng, map]);
    return null;
};

const SOCKET_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : (import.meta.env.PROD ? 'https://connect2campus.co.in' : 'http://localhost:5000');

const LiveMap = ({ vehicles, routes }) => {
    const { user } = useAuth();
    const [defaultCenter, setDefaultCenter] = useState(null);
    const [locationLoaded, setLocationLoaded] = useState(false);
    const [liveVehicles, setLiveVehicles] = useState(vehicles || []);

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

    // Seed with props on mount/update
    useEffect(() => {
        if (vehicles && vehicles.length > 0) {
            setLiveVehicles(prev => prev.length === 0 ? vehicles : prev);
        }
    }, [vehicles]);

    // WebSocket real-time updates (replaces polling)
    useEffect(() => {
        const schoolId = user?.schoolId;
        if (!schoolId) return;

        const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
        socket.on('connect', () => socket.emit('join:school', schoolId));
        socket.on('vehicle:location', (data) => {
            setLiveVehicles(prev => prev.map(v =>
                v.id === data.vehicleId
                    ? { ...v, current_lat: data.lat, current_lng: data.lng, speed: data.speed, status: data.status }
                    : v
            ));
        });
        return () => socket.disconnect();
    }, [user?.schoolId]);

    const activeVehicles = liveVehicles.filter(v => {
        const lat = parseFloat(v.current_lat);
        const lng = parseFloat(v.current_lng);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && (v.status === 'Active' || v.status === 'On Route');
    });

    if (!locationLoaded && activeVehicles.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500 rounded-xl">
                <Navigation className="animate-pulse text-indigo-500 mb-2" size={32} />
                <span className="text-sm font-bold">Getting your present location...</span>
            </div>
        );
    }

    const center = activeVehicles.length > 0
        ? [parseFloat(activeVehicles[0].current_lat), parseFloat(activeVehicles[0].current_lng)]
        : (defaultCenter || [12.9716, 77.5946]);

    return (
        <div className="w-full h-full relative">
            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                />

                {activeVehicles.map(vehicle => (
                    <Marker
                        key={vehicle.id}
                        position={[parseFloat(vehicle.current_lat), parseFloat(vehicle.current_lng)]}
                        icon={createBusIcon()}
                    >
                        <Popup>
                            <div className="text-sm min-w-[150px]">
                                <strong className="block text-indigo-700 text-lg mb-1">{vehicle.vehicle_number}</strong>
                                <div className="text-slate-600 mb-2 font-medium">{vehicle.vehicle_model}</div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                                    <div className="font-bold">Driver:</div>
                                    <div>{vehicle.driver_name}</div>
                                </div>
                                <div className="text-xs text-emerald-600 font-bold flex items-center gap-2 bg-emerald-50 p-1.5 rounded border border-emerald-100">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    {simulationEnabled ? 'Simulating...' : 'Tracking Active'}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Render Route Lines */}
                {routes && routes.map(route => {
                    const positions = (route.stops || [])
                        .filter(s => s.lat && s.lng)
                        .map(s => [parseFloat(s.lat), parseFloat(s.lng)]);

                    if (positions.length < 2) return null;

                    return (
                        <Polyline
                            key={`route-${route.id}`}
                            positions={positions}
                            pathOptions={{ color: '#4f46e5', weight: 4, opacity: 0.6 }}
                        >
                            <Popup>
                                <div className="text-xs font-bold text-indigo-700">
                                    Route: {route.route_name}
                                </div>
                            </Popup>
                        </Polyline>
                    );
                })}

                <RecenterMap lat={center[0]} lng={center[1]} />
            </MapContainer>

            {/* Overlay Statistics */}
            <div className="absolute top-4 right-4 z-[400] bg-white p-4 rounded-xl shadow-lg border border-slate-200 w-72">
                <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Navigation size={16} className="text-indigo-600" /> Live Status
                </h4>
                <div className="space-y-4 text-sm">
                    <div>
                        <div className="flex justify-between mb-1">
                            <span className="text-slate-500">Live Buses</span>
                            <span className="font-bold text-emerald-600">{activeVehicles.length}</span>
                        </div>
                        <div className="flex justify-between mb-1">
                            <span className="text-slate-500">Total Fleet</span>
                            <span className="font-bold text-slate-800">{liveVehicles.length}</span>
                        </div>
                    </div>    <div className="flex justify-between">
                        <span className="text-slate-500">Total Routes</span>
                        <span className="font-bold text-slate-800">{routes.length}</span>
                    </div>
                </div>

                {/* WebSocket Real-time info */}
                <div className="pt-3 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
                    <p className="font-bold text-slate-600">⚡ WebSocket Live</p>
                    <p>Updates instantly when GPS data arrives. No refresh needed.</p>
                    <p className="font-bold text-slate-600 mt-2">📡 GPS Hardware Webhook:</p>
                    <code className="block bg-slate-50 p-1 rounded border border-slate-200 select-all break-all">
                        POST /api/transport/gps/webhook
                    </code>
                    <p className="text-slate-400">Any GPS company format auto-detected</p>
                </div>
            </div>
        </div>
    );
};

export default LiveMap;
