import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Bus, Phone, Navigation, AlertCircle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import api from '../../../api/axios';

// Fix for default marker icon issues in React Leaflet
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

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
        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], 14);
            map.invalidateSize();
        }
    }, [lat, lng, map]);
    return null;
};

const StudentTransport = () => {
    const [transportInfo, setTransportInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const fetchRoute = async () => {
            try {
                const res = await api.get('/transport/my-route');
                // Map backend data to UI structure
                const data = res.data;
                const lat = parseFloat(data.current_lat || 12.9716);
                const lng = parseFloat(data.current_lng || 77.5946);

                if (isMounted) {
                    setTransportInfo({
                        busNumber: data.vehicle_number || "N/A",
                        driverName: data.driver_name || "Assigned Driver",
                        driverContact: data.driver_phone || "N/A",
                        route: `${data.route_name} (${data.start_point} - ${data.end_point})`,
                        pickupTime: data.pickup_time || "N/A",
                        dropTime: data.drop_time || "N/A",
                        position: [lat, lng],
                        pickupPoint: data.pickup_point || 'School',
                        isLive: data.vehicle_status === 'Active'
                    });
                    setLoading(false);
                }
            } catch (err) {
                console.error("Failed to fetch transport route", err);
                if (isMounted) {
                    setError(err.response?.data?.message || "Transport details not maintained or not assigned.");
                    setLoading(false);
                }
            }
        };

        fetchRoute();

        // Poll for location updates every 3s (Real-time speed)
        const interval = setInterval(fetchRoute, 3000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Loading transport details...</div>;

    if (error || !transportInfo) return (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center shadow-sm">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bus className="text-slate-400" size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700">No Transport Assigned</h3>
            <p className="text-slate-500 mt-2 text-sm max-w-md mx-auto">{error || "You have not been assigned to any transport route yet. Please contact the school admin."}</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Bus className="text-indigo-600" /> My School Bus
                    </h3>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-1 ${transportInfo.isLive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        <div className={`w-2 h-2 rounded-full ${transportInfo.isLive ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                        {transportInfo.isLive ? 'Live Tracking' : 'Not Active'}
                    </div>
                </div>

                {/* Map Container */}
                <div className="h-80 w-full rounded-xl overflow-hidden border border-slate-300 z-0 relative shadow-inner">
                    <MapContainer
                        center={transportInfo.position}
                        zoom={13}
                        scrollWheelZoom={false}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        />
                        <RecenterMap lat={transportInfo.position[0]} lng={transportInfo.position[1]} />
                        <Marker position={transportInfo.position} icon={createBusIcon()}>
                            <Popup>
                                <div className="text-center p-1">
                                    <p className="font-bold text-indigo-700">{transportInfo.busNumber}</p>
                                    <p className="text-xs text-slate-500">Current Location</p>
                                </div>
                            </Popup>
                        </Marker>
                    </MapContainer>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <div className="p-4 bg-slate-50 rounded-xl flex items-center gap-4 border border-slate-100">
                        <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
                            <Bus size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wide">Bus Number</p>
                            <p className="font-bold text-slate-800 text-lg">{transportInfo.busNumber}</p>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl flex items-center gap-4 border border-slate-100">
                        <div className="bg-emerald-100 p-3 rounded-full text-emerald-600">
                            <Phone size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wide">Driver Info</p>
                            <p className="font-bold text-slate-800">{transportInfo.driverName}</p>
                            <a href={`tel:${transportInfo.driverContact}`} className="text-xs text-indigo-600 font-medium hover:underline">{transportInfo.driverContact}</a>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl flex items-center gap-4 border border-slate-100">
                        <div className="bg-amber-100 p-3 rounded-full text-amber-600">
                            <Navigation size={24} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wide">Pickup Point</p>
                            <p className="font-bold text-slate-800 line-clamp-1" title={transportInfo.pickupPoint}>{transportInfo.pickupPoint}</p>
                            <p className="text-xs text-slate-500">Time: <span className="font-bold text-slate-700">{transportInfo.pickupTime}</span></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentTransport;
