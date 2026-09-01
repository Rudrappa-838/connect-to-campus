import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: null,
    iconUrl: null,
    shadowUrl: null,
});

// Custom Live School Bus Marker with Floating Info Card (Compact Size)
const createLiveBusIcon = (vehicle) => {
    const vehicleNumber = vehicle?.vehicle_number || 'School Bus';
    const driverName = vehicle?.driver_name || '';
    const routeName = vehicle?.current_route_name || vehicle?.route_name || '';
    const speed = parseFloat(vehicle?.speed || 0);
    const heading = parseFloat(vehicle?.heading || 0);
    const isMoving = speed > 2;
    const isLive = vehicle?.status === 'Active';

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
        className: 'custom-teacher-bus-icon-wrapper',
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

// Recenter map when position changes
const RecenterMap = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            map.panTo([lat, lng], { animate: true, duration: 0.8 });
        }
    }, [lat, lng, map]);
    return null;
};

const TeacherTransportMap = ({ vehicle }) => {
    const [userLocation, setUserLocation] = useState(null);
    const [flyTarget, setFlyTarget] = useState(null);
    const hasCenteredUser = React.useRef(false);

    const acquireUserLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    setUserLocation([lat, lng]);
                    if (!hasCenteredUser.current) {
                        hasCenteredUser.current = true;
                        setFlyTarget({ lat, lng });
                    }
                },
                (err) => console.warn("Teacher GPS error:", err.message),
                { enableHighAccuracy: true, timeout: 8000 }
            );
        }
    };

    useEffect(() => {
        acquireUserLocation();
    }, []);

    const hasBusCoords = vehicle?.current_lat && vehicle?.current_lng && parseFloat(vehicle.current_lat) !== 0;
    const busLat = parseFloat(vehicle?.current_lat);
    const busLng = parseFloat(vehicle?.current_lng);

    // Prioritize user's actual current location
    const center = userLocation
        ? userLocation
        : (hasBusCoords ? [busLat, busLng] : [20.5937, 78.9629]);

    return (
        <div className="h-80 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative z-0">
            <MapContainer
                center={center}
                zoom={15}
                maxZoom={20}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%' }}
                zoomControl={true}
            >
                <TileLayer
                    attribution='&copy; Google Maps'
                    url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                    maxZoom={20}
                />

                {flyTarget && <RecenterMap lat={flyTarget.lat} lng={flyTarget.lng} />}

                {/* Teacher Location Marker */}
                {userLocation && (
                    <Marker position={userLocation} icon={createUserLocationIcon()}>
                        <Popup>
                            <div className="text-center font-bold text-xs p-1">
                                📍 You Are Here
                            </div>
                        </Popup>
                    </Marker>
                )}

                {hasBusCoords && (
                    <Marker position={[busLat, busLng]} icon={createLiveBusIcon(vehicle)} />
                )}
            </MapContainer>

            {/* My Location Button */}
            <button
                onClick={() => {
                    acquireUserLocation();
                    if (userLocation) {
                        setFlyTarget({ lat: userLocation[0], lng: userLocation[1] });
                    }
                }}
                className="absolute bottom-3 right-3 z-[400] bg-white text-slate-800 hover:bg-slate-50 p-2 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                title="Center on My Location"
            >
                <span>🎯 My Location</span>
            </button>
        </div>
    );
};

export default TeacherTransportMap;
