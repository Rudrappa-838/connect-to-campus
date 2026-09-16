import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Bus, Navigation, Wifi, WifiOff, MapPin } from 'lucide-react';
import api from '../../../api/axios';
import { io } from 'socket.io-client';
import { useAuth } from '../../../context/AuthContext';

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: null,
    iconUrl: null,
    shadowUrl: null,
});

// Custom School Bus Marker with Floating Info Card on top (Compact Size)
const createLiveBusIcon = (vehicle) => {
    const vehicleNumber = vehicle.vehicle_number || 'School Bus';
    const driverName = vehicle.driver_name || vehicle.driverName || '';
    const routeName = vehicle.current_route_name || vehicle.routeName || vehicle.route_name || '';
    const speed = parseFloat(vehicle.speed || 0);
    const heading = parseFloat(vehicle.heading || 0);
    const isMoving = speed > 2;

    const html = `
        <div style="width: 140px; display: flex; flex-direction: column; align-items: center; pointer-events: auto;">
            <!-- Compact Floating Badge attached on Top of Bus Icon -->
            <div style="background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(6px); color: white; padding: 3px 8px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.25); white-space: nowrap; text-align: center; margin-bottom: 3px; max-width: 140px;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 4px; font-weight: 800; font-size: 11px; color: #facc15;">
                    <span>🚌 ${vehicleNumber}</span>
                    <span style="background: ${speed > 60 ? '#ef4444' : isMoving ? '#10b981' : '#64748b'}; color: white; font-size: 8px; font-weight: 800; padding: 0.5px 4px; border-radius: 4px;">
                        ${isMoving ? `${Math.round(speed)}k` : 'Stop'}
                    </span>
                </div>
                ${routeName ? `<div style="font-size: 9px; font-weight: 600; color: #93c5fd; margin-top: 1px; max-width: 130px; overflow: hidden; text-overflow: ellipsis;">📍 ${routeName}</div>` : ''}
                ${driverName ? `<div style="font-size: 8.5px; color: #cbd5e1; margin-top: 0.5px;">👤 ${driverName}</div>` : ''}
            </div>

            <!-- Small Bus Icon with Radar Pulse -->
            <div style="position: relative; width: 34px; height: 34px;">
                <div style="background: #fbbf24; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #0f172a; box-shadow: 0 4px 12px rgba(0,0,0,0.4); transform: rotate(${heading}deg); transition: transform 0.3s ease;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path>
                        <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path>
                        <circle cx="7" cy="18" r="2"></circle><path d="M9 18h5"></path><circle cx="17" cy="18" r="2"></circle>
                    </svg>
                </div>
                <!-- Radar Ping Dot -->
                <div style="position: absolute; bottom: -1px; right: -1px; width: 10px; height: 10px; background: #10b981; border-radius: 50%; border: 1.5px solid white; animation: ping 1s infinite;"></div>
            </div>
        </div>
    `;

    return L.divIcon({
        className: 'custom-live-bus-icon-wrapper',
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

const SmoothRecenter = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            map.panTo([lat, lng], { animate: true, duration: 0.8 });
        }
    }, [lat, lng, map]);
    return null;
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

/**
 * SmoothBusMarker — animates each bus marker smoothly to its new GPS position.
 * Uses Leaflet's native setLatLng() so the icon glides instead of teleporting.
 */
const SmoothBusMarker = ({ vehicle }) => {
    const markerRef = useRef(null);
    const prevPosRef = useRef(null);

    const lat = parseFloat(vehicle.display_lat ?? vehicle.current_lat);
    const lng = parseFloat(vehicle.display_lng ?? vehicle.current_lng);
    const icon = createLiveBusIcon(vehicle);

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
    }, [lat, lng, vehicle.speed, vehicle.heading, vehicle.status]);

    if (isNaN(lat) || isNaN(lng)) return null;
    return <Marker ref={markerRef} position={[lat, lng]} icon={icon} />;
};

const SOCKET_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : (import.meta.env.PROD ? 'https://connect2campus.co.in' : 'http://localhost:5000');

const LiveMap = ({ vehicles = [] }) => {
    const { user } = useAuth();
    const [liveVehicles, setLiveVehicles] = useState(vehicles || []);
    const [connected, setConnected] = useState(false);
    const [userLocation, setUserLocation] = useState(null);
    const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
    const [flyTarget, setFlyTarget] = useState(null);
    const hasCenteredUser = React.useRef(false);

    // Acquire User Live Location
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
                        console.warn("GPS error:", err.message);
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
    }, []);

    // Seed vehicles on prop load
    useEffect(() => {
        if (vehicles && vehicles.length > 0) {
            setLiveVehicles(vehicles);
        }
    }, [vehicles]);

    // WebSocket real-time live GPS push
    useEffect(() => {
        const schoolId = user?.schoolId;
        if (!schoolId) return;

        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 15,
            reconnectionDelay: 2000,
        });

        socket.on('connect', () => {
            setConnected(true);
            socket.emit('join:school', schoolId);
        });

        socket.on('disconnect', () => setConnected(false));

        socket.on('vehicle:location', (data) => {
            const now = new Date();
            setLiveVehicles(prev => {
                const exists = prev.some(v => v.id === data.vehicleId);
                if (exists) {
                    return prev.map(v => v.id === data.vehicleId ? {
                        ...v,
                        current_lat: data.lat,
                        current_lng: data.lng,
                        speed: data.speed,
                        heading: data.heading,
                        current_route_name: data.routeName || v.current_route_name,
                        current_route_id: data.routeId || v.current_route_id,
                        status: data.status,
                        last_updated: data.lastUpdated,
                        _lastWS: now,
                    } : v);
                } else {
                    return [...prev, {
                        id: data.vehicleId,
                        vehicle_number: data.vehicleNumber,
                        driver_name: data.driverName,
                        driver_phone: data.driverPhone,
                        current_lat: data.lat,
                        current_lng: data.lng,
                        speed: data.speed,
                        heading: data.heading,
                        current_route_name: data.routeName,
                        current_route_id: data.routeId,
                        status: data.status,
                        last_updated: data.lastUpdated,
                        _lastWS: now,
                    }];
                }
            });
        });

        return () => socket.disconnect();
    }, [user?.schoolId]);

    const activeVehicles = liveVehicles.filter(v => {
        const lat = parseFloat(v.current_lat);
        const lng = parseFloat(v.current_lng);
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return false;
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

    const dispersedVehicles = useMemo(() => {
        return getDispersedLiveVehicles(activeVehicles);
    }, [activeVehicles]);

    // Auto-center directly on active bus
    const hasAutoCentered = useRef(false);
    useEffect(() => {
        if (!hasAutoCentered.current && dispersedVehicles.length > 0) {
            const first = dispersedVehicles[0];
            hasAutoCentered.current = true;
            const fLat = first.display_lat ?? first.current_lat;
            const fLng = first.display_lng ?? first.current_lng;
            setFlyTarget({ lat: parseFloat(fLat), lng: parseFloat(fLng) });
        }
    }, [dispersedVehicles]);

    // Prioritize active bus as map center
    const mapCenter = (activeVehicles.length > 0 && activeVehicles[0]?.current_lat && activeVehicles[0]?.current_lng)
        ? [parseFloat(activeVehicles[0].current_lat), parseFloat(activeVehicles[0].current_lng)]
        : (userLocation ? userLocation : [20.5937, 78.9629]);

    const [mapType, setMapType] = useState('streets'); // 'streets' | 'hybrid' | 'osm'

    return (
        <div className="w-full h-full relative rounded-2xl overflow-hidden shadow-xl border border-slate-200">
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

                {/* Smooth recenter on flyTarget (e.g. user GPS or clicked bus) */}
                {flyTarget && (
                    <SmoothRecenter
                        lat={flyTarget.lat}
                        lng={flyTarget.lng}
                    />
                )}

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

                {/* Smooth Animated Bus Markers */}
                {dispersedVehicles.map(vehicle => (
                    <SmoothBusMarker key={vehicle.id} vehicle={vehicle} />
                ))}
            </MapContainer>

            {/* Map Style Selector - Layered above Leaflet tiles and panes */}
            <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl border border-slate-200/80 flex gap-1 text-xs font-bold pointer-events-auto">
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
                onClick={() => {
                    acquireUserLocation();
                    if (userLocation) {
                        setFlyTarget({ lat: userLocation[0], lng: userLocation[1] });
                    }
                }}
                className="absolute bottom-6 right-4 z-[1000] bg-white text-slate-800 hover:bg-slate-50 p-2.5 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer pointer-events-auto"
                title="Center on My Location"
            >
                <MapPin size={14} className="text-blue-600" />
                <span>My Location</span>
            </button>

            {/* Live Indicator Overlay */}
            <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl text-white text-xs shadow-lg border border-slate-700/60 pointer-events-auto">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
                <span className="font-black tracking-wide">
                    {connected ? `LIVE TRACKING (${activeVehicles.length} BUSES)` : 'CONNECTING GPS...'}
                </span>
            </div>
        </div>
    );
};

export default LiveMap;
