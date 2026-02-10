import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Create custom bus icon
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

// Recenter map when position changes
const RecenterMap = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], 14);
            map.invalidateSize();
        }
    }, [lat, lng, map]);
    return null;
};

const TeacherTransportMap = ({ vehicle }) => {
    // Default to School Location
    const defaultLat = 12.9716;
    const defaultLng = 77.5946;

    const lat = parseFloat(vehicle?.current_lat) || defaultLat;
    const lng = parseFloat(vehicle?.current_lng) || defaultLng;
    const hasSignal = vehicle?.current_lat && vehicle?.current_lng;
    const isLive = vehicle?.status === 'Active';

    return (
        <div className="h-80 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner relative z-0">
            <MapContainer center={[lat, lng]} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                />
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                />

                <Marker position={[lat, lng]} icon={createBusIcon()}>
                    <Popup>
                        <div className="text-center min-w-[120px]">
                            <h3 className="font-bold text-slate-800 text-lg">{vehicle?.vehicle_number}</h3>
                            <div className="text-xs text-slate-500 mb-1">{vehicle?.vehicle_model}</div>
                            <div className={`text-xs font-bold inline-block px-2 py-1 rounded-full ${isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {isLive ? 'Live Tracking' : 'Offline'}
                            </div>
                        </div>
                    </Popup>
                </Marker>

                <RecenterMap lat={lat} lng={lng} />
            </MapContainer>

            {/* Status Overlay */}
            <div className={`absolute bottom-3 left-3 right-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg z-[1000] flex items-center justify-between ${isLive ? 'bg-white/90 border-emerald-200' : 'bg-slate-50/90 border-slate-200'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                    <div className="text-xs font-bold text-slate-700">
                        {isLive ? 'LIVE SIGNAL ACTIVE' : 'NO LIVE SIGNAL'}
                    </div>
                </div>
                {!isLive && (
                    <div className="text-[10px] text-slate-500 font-medium bg-slate-200 px-2 py-1 rounded">Last Known Location</div>
                )}
            </div>
        </div>
    );
};

export default TeacherTransportMap;
