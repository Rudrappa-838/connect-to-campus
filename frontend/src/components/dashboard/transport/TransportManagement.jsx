import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bus, MapPin, Navigation, Plus, Edit2, Trash2, Map as MapIcon, RotateCw } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
// LiveMap import removed as it is now handled by AdminLiveMap component in dashboard Sidebar
// import LiveMap from './LiveMap';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationPicker = ({ onLocationSelect }) => {
    useMapEvents({
        click(e) {
            onLocationSelect(e.latlng);
        },
    });
    return null;
};

// Map Controller Component
const MapController = ({ stops, isEditing }) => {
    const map = useMap();

    useEffect(() => {
        // If we have stops with valid coordinates, focus on them
        const validStops = stops.filter(s => s.lat && s.lng);
        if (validStops.length > 0) {
            if (validStops.length === 1) {
                map.setView([validStops[0].lat, validStops[0].lng], 15);
            } else {
                const bounds = L.latLngBounds(validStops.map(s => [s.lat, s.lng]));
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        } else if (!isEditing) {
            // Only try current location if creating new (and no stops added yet)
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        map.setView([latitude, longitude], 15);
                    },
                    (error) => console.error("Location access denied:", error)
                );
            }
        }
    }, [stops, isEditing, map]);

    return null;
};

const TimePicker12H = ({ value, onChange, className = "" }) => {
    const parseTime = (val) => {
        if (!val) return { hour: '12', minute: '00', period: 'AM' };
        let [h, m] = val.split(':');
        h = parseInt(h);
        const period = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return { hour: h, minute: m, period };
    };

    const handleChange = (field, val) => {
        const current = parseTime(value);
        const newState = { ...current, [field]: val };

        let h = parseInt(newState.hour);
        if (newState.period === 'PM' && h !== 12) h += 12;
        if (newState.period === 'AM' && h === 12) h = 0;

        const hStr = h.toString().padStart(2, '0');
        onChange(`${hStr}:${newState.minute}`);
    };

    const tm = parseTime(value);

    return (
        <div className={`flex gap-1 items-center ${className}`}>
            <select
                value={tm.hour}
                onChange={e => handleChange('hour', e.target.value)}
                className="p-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                    <option key={h} value={h}>{h}</option>
                ))}
            </select>
            <span className="text-slate-400">:</span>
            <select
                value={tm.minute}
                onChange={e => handleChange('minute', e.target.value)}
                className="p-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => (
                    <option key={m} value={m}>{m}</option>
                ))}
            </select>
            <select
                value={tm.period}
                onChange={e => handleChange('period', e.target.value)}
                className="p-2 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
            </select>
        </div>
    );
};

const TransportManagement = ({ initialTab }) => {
    // activeTab logic removed, using initialTab directly

    const [vehicles, setVehicles] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Vehicle Form State
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [vehicleForm, setVehicleForm] = useState({
        vehicle_number: '', vehicle_model: '', driver_name: '', driver_phone: '', capacity: '', gps_device_id: '', driver_id: ''
    });

    // Driver Search State
    const [driverSearch, setDriverSearch] = useState('');
    const [driverResults, setDriverResults] = useState([]);
    const [isSearchingDriver, setIsSearchingDriver] = useState(false);

    const handleDriverSearch = async (e) => {
        const query = e.target.value;
        setDriverSearch(query);
        if (query.length > 1) {
            setIsSearchingDriver(true);
            try {
                const res = await api.get(`/staff?search=${query}`);
                setDriverResults(res.data);
            } catch (error) {
                console.error(error);
            } finally {
                setIsSearchingDriver(false);
            }
        } else {
            setDriverResults([]);
            setIsSearchingDriver(false);
        }
    };

    const selectDriver = (staff) => {
        setVehicleForm({
            ...vehicleForm,
            driver_name: staff.name,
            driver_phone: staff.phone,
            driver_id: staff.id
        });
        setDriverResults([]);
        setDriverSearch('');
    };

    // Route Form State
    const [showRouteModal, setShowRouteModal] = useState(false);
    const [isEditingRoute, setIsEditingRoute] = useState(false);
    const [selectedRouteId, setSelectedRouteId] = useState(null);
    const [routeForm, setRouteForm] = useState({
        route_name: '', start_point: '', end_point: '', start_time: ''
    });
    const [stops, setStops] = useState([{ name: '', time: '', lat: null, lng: null }]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [vRes, rRes] = await Promise.all([
                api.get('/transport/vehicles'),
                api.get('/transport/routes')
            ]);
            setVehicles(vRes.data);
            setRoutes(rRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load transport data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddVehicle = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const payload = { ...vehicleForm };
            const assignRouteId = payload.assign_route_id;
            // Clean payload
            delete payload.assign_route_id;
            if (!payload.gps_device_id) delete payload.gps_device_id;

            const res = await api.post('/transport/vehicles', payload);
            const newVehicleId = res.data.vehicleId || res.data.id; // handle variation in response

            // If Route Selected, Update Route
            if (assignRouteId && newVehicleId) {
                await api.put(`/transport/routes/${assignRouteId}`, {
                    vehicle_id: newVehicleId
                });
            }

            toast.success('Vehicle added successfully');
            setShowVehicleModal(false);
            setVehicleForm({ vehicle_number: '', vehicle_model: '', driver_name: '', driver_phone: '', capacity: '', gps_device_id: '', assign_route_id: '', driver_id: '' });
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Failed to add vehicle');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteVehicle = async (id) => {
        if (isSubmitting) return;
        if (!window.confirm('Are you sure?')) return;
        setIsSubmitting(true);
        try {
            await api.delete(`/transport/vehicles/${id}`);
            toast.success('Vehicle deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete vehicle');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddRoute = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            console.log('Saving Route. Edit Mode:', isEditingRoute, 'ID:', selectedRouteId);

            if (isEditingRoute) {
                if (!selectedRouteId) {
                    toast.error('Error: missing Route ID');
                    return;
                }
                await api.put(`/transport/routes/${selectedRouteId}`, { ...routeForm, stops });
                toast.success('Route updated successfully');
            } else {
                await api.post('/transport/routes', { ...routeForm, stops });
                toast.success('Route created successfully');
            }
            setShowRouteModal(false);
            setIsEditingRoute(false);
            setSelectedRouteId(null);
            fetchData();
        } catch (error) {
            console.error('Route Save Error:', error);
            const serverError = error.response?.data?.error;
            const fallbackMsg = isEditingRoute ? 'Failed to update route' : 'Failed to create route';
            const mainMsg = error.response?.data?.message || fallbackMsg;

            toast.error(serverError ? `${mainMsg}: ${serverError}` : mainMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditRoute = (route) => {
        setRouteForm({
            route_name: route.route_name,
            start_point: route.start_point,
            end_point: route.end_point,
            start_time: route.start_time
        });

        // Map DB stops to Form stops
        setStops((route.stops || []).map(s => ({
            name: s.stop_name || '',
            time: s.pickup_time || '',
            lat: s.lat != null ? parseFloat(s.lat) : null,
            lng: s.lng != null ? parseFloat(s.lng) : null
        })));

        setSelectedRouteId(route.id); // Restored
        setIsEditingRoute(true);
        setShowRouteModal(true);
    };

    const handleDeleteRoute = async (id) => {
        if (isSubmitting) return;
        if (!window.confirm('Are you sure you want to delete this route? This will also remove all its stops.')) return;
        setIsSubmitting(true);
        try {
            await api.delete(`/transport/routes/${id}`);
            toast.success('Route deleted successfully');
            fetchData();
        } catch (error) {
            console.error('Delete Error:', error);
            toast.error('Failed to delete route');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateRoute = () => {
        setRouteForm({ route_name: '', start_point: '', end_point: '', start_time: '' });
        setStops([]); // Start empty to force map selection
        setSelectedRouteId(null);
        setIsEditingRoute(false);
        setShowRouteModal(true);
    };

    const handleStopChange = (index, field, value) => {
        const newStops = [...stops];
        newStops[index][field] = value;
        setStops(newStops);
    };

    const addStopField = () => {
        setStops([...stops, { name: '', time: '', lat: null, lng: null }]);
    };

    const handleMapClick = (latlng) => {
        setStops([...stops, {
            name: `Stop ${stops.length + 1}`,
            time: '',
            lat: latlng.lat,
            lng: latlng.lng
        }]);
        toast.success('Stop added from map!');
    };
    const removeStop = (index) => {
        const newStops = stops.filter((_, i) => i !== index);
        setStops(newStops);
    };

    const formatTime = (time) => {
        if (!time) return '';
        const [h, m] = time.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Transport Management</h2>
                    <p className="text-slate-500">
                        {initialTab === 'vehicles' ? 'Manage fleet and vehicle details' : 'Manage routes and stops'}
                    </p>
                </div>
                {/* Internal tabs removed to fix sidebar sync */}
            </div>

            {
                loading ? (
                    <div className="text-center py-20 text-slate-500">Loading transport data...</div>
                ) : (
                    <>
                        {initialTab === 'vehicles' && (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                                    <h3 className="font-bold text-slate-700">Fleet List</h3>
                                    <button
                                        onClick={() => setShowVehicleModal(true)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
                                    >
                                        <Plus size={16} /> Add Vehicle
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-slate-600">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                            <tr>
                                                <th className="px-6 py-3">Vehicle No</th>
                                                <th className="px-6 py-3">Model</th>
                                                <th className="px-6 py-3">Driver</th>
                                                <th className="px-6 py-3">Capacity</th>
                                                <th className="px-6 py-3">Status</th>
                                                <th className="px-6 py-3">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vehicles.map(vehicle => (
                                                <tr key={vehicle.id} className="bg-white border-b hover:bg-slate-50">
                                                    <td className="px-6 py-4 font-bold text-slate-800">{vehicle.vehicle_number}</td>
                                                    <td className="px-6 py-4">{vehicle.vehicle_model}</td>
                                                    <td className="px-6 py-4">
                                                        <div>{vehicle.driver_name}</div>
                                                        <div className="text-xs text-slate-500">{vehicle.driver_phone}</div>
                                                    </td>
                                                    <td className="px-6 py-4">{vehicle.capacity}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${vehicle.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {vehicle.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 flex gap-2">
                                                        <button onClick={() => handleDeleteVehicle(vehicle.id)} disabled={isSubmitting} className={`text-red-500 hover:bg-red-50 p-1.5 rounded-md ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {vehicles.length === 0 && (
                                                <tr>
                                                    <td colSpan="6" className="px-6 py-8 text-center text-slate-400 italic">
                                                        No vehicles found. Add your first vehicle to get started.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {initialTab === 'routes' && (
                            <div className="space-y-6">
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleCreateRoute}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                                    >
                                        <Plus size={16} /> Create New Route
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {routes.map(route => (
                                        <div key={route.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-bold text-lg text-slate-800">{route.route_name}</h3>
                                                    <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                                                        <Bus size={14} /> {route.vehicle_number || 'No Vehicle Assigned'}
                                                        <span className="mx-2 text-slate-300">|</span>
                                                        <RotateCw size={14} /> {formatTime(route.start_time) || 'N/A'}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">
                                                        {route.stops?.length || 0} Stops
                                                    </span>
                                                    <button
                                                        onClick={() => handleEditRoute(route)}
                                                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Edit Route"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRoute(route.id)}
                                                        disabled={isSubmitting}
                                                        className={`p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        title="Delete Route"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-3 relative">
                                                <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-slate-200"></div>
                                                {route.stops?.map((stop, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 relative z-10">
                                                        <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-500 flex-shrink-0"></div>
                                                        <div className="flex-1 text-sm">
                                                            <div className="font-medium text-slate-700">{stop.stop_name}</div>
                                                            <div className="text-xs text-slate-400">{formatTime(stop.pickup_time)}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {routes.length === 0 && (
                                        <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
                                            <Navigation size={48} className="mx-auto mb-4 opacity-20" />
                                            <p>No routes created yet.</p>
                                            <button onClick={handleCreateRoute} className="mt-4 text-indigo-600 hover:underline font-bold text-sm">Create your first route</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )
            }

            {/* Add Vehicle Modal */}
            {
                showVehicleModal && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="font-bold text-slate-800">Add New Vehicle</h3>
                                <button onClick={() => setShowVehicleModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                            </div>
                            <div className="p-6 space-y-4">
                                <input
                                    className="w-full p-2 border rounded-lg text-sm" placeholder="Vehicle Number (e.g. KA-01-AB-1234)"
                                    autoComplete="off"
                                    value={vehicleForm.vehicle_number} onChange={e => setVehicleForm({ ...vehicleForm, vehicle_number: e.target.value })}
                                />
                                <input
                                    className="w-full p-2 border rounded-lg text-sm" placeholder="Model (e.g. Tata Starbus)"
                                    autoComplete="off"
                                    value={vehicleForm.vehicle_model} onChange={e => setVehicleForm({ ...vehicleForm, vehicle_model: e.target.value })}
                                />

                                {/* Driver Search Section */}
                                <div className="space-y-2">
                                    {vehicleForm.driver_name ? (
                                        <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                                            <div>
                                                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">Assigned Driver</div>
                                                <div className="font-bold text-slate-800">{vehicleForm.driver_name}</div>
                                                <div className="text-xs text-slate-500">{vehicleForm.driver_phone}</div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setVehicleForm({ ...vehicleForm, driver_name: '', driver_phone: '' })}
                                                className="text-xs bg-white border border-indigo-200 text-indigo-600 px-2 py-1 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                                            >
                                                Change
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Search Driver (Staff)</label>
                                            <input
                                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="Search by ID or Name..."
                                                autoComplete="off"
                                                value={driverSearch}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/[^a-zA-Z0-9 ]/g, '');
                                                    handleDriverSearch({ target: { value: val } });
                                                }}
                                            />
                                            {driverResults.length > 0 && (
                                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                                                    {driverResults.map(s => (
                                                        <div
                                                            key={s.id}
                                                            onClick={() => selectDriver(s)}
                                                            className="p-2 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-100 last:border-0"
                                                        >
                                                            <div className="font-bold text-slate-700">{s.name}</div>
                                                            <div className="text-xs text-slate-500">ID: {s.employee_id} | Ph: {s.phone}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">GPS Device ID / IMEI</label>
                                    <input
                                        className="w-full p-2 border rounded-lg text-sm"
                                        placeholder="Enter Device IMEI"
                                        autoComplete="off"
                                        value={vehicleForm.gps_device_id}
                                        onChange={e => setVehicleForm({ ...vehicleForm, gps_device_id: e.target.value })}
                                    />
                                    <div className="text-[10px] text-slate-500 mt-2 bg-slate-50 p-2 rounded border border-slate-100">
                                        <p className="font-bold mb-1">Hardware Setup:</p>
                                        <p>Configure your GPS tracker to send POST requests to:</p>
                                        <code className="block bg-white p-1 mt-1 rounded border select-all">
                                            {window.location.origin}/api/transport/gps-webhook
                                        </code>
                                        <p className="mt-1">Payload: <code className="text-indigo-600">{`{ "imei": "YOUR_IMEI", "lat": 12.34, "lng": 77.12 }`}</code></p>
                                    </div>
                                </div>
                                <input
                                    type="number" className="w-full p-2 border rounded-lg text-sm" placeholder="Capacity"
                                    autoComplete="off"
                                    value={vehicleForm.capacity} onChange={e => setVehicleForm({ ...vehicleForm, capacity: e.target.value })}
                                />

                                <div className="pt-2 border-t border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign Route (Optional)</label>
                                    <select
                                        className="w-full p-2 border rounded-lg text-sm bg-indigo-50/50"
                                        value={vehicleForm.assign_route_id || ''}
                                        onChange={e => setVehicleForm({ ...vehicleForm, assign_route_id: e.target.value })}
                                    >
                                        <option value="">-- No Route Assigned --</option>
                                        {routes.map(r => (
                                            <option key={r.id} value={r.id}>
                                                {r.route_name} {r.vehicle_id ? '(Assigned)' : '(Unassigned)'}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1">* Selecting a route will assign this vehicle to it.</p>
                                </div>
                                <button onClick={handleAddVehicle} disabled={isSubmitting} className={`w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>{isSubmitting ? 'Adding...' : 'Add Vehicle'}</button>
                            </div>
                        </div>
                    </div>
                    , document.body)
            }

            {/* Add Route Modal with Map */}
            {
                showRouteModal && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 h-[85vh] flex flex-col">
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
                                <h3 className="font-bold text-slate-800">{isEditingRoute ? 'Edit Route' : 'Create New Route'}</h3>
                                <button onClick={() => setShowRouteModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                            </div>

                            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
                                {/* Left Column: Form */}
                                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                                    <input
                                        className="w-full p-2 border rounded-lg text-sm" placeholder="Route Name"
                                        autoComplete="off"
                                        value={routeForm.route_name} onChange={e => setRouteForm({ ...routeForm, route_name: e.target.value })}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input
                                            className="w-full p-2 border rounded-lg text-sm" placeholder="Start Point"
                                            autoComplete="off"
                                            value={routeForm.start_point} onChange={e => setRouteForm({ ...routeForm, start_point: e.target.value })}
                                        />
                                        <input
                                            className="w-full p-2 border rounded-lg text-sm" placeholder="End Point"
                                            autoComplete="off"
                                            value={routeForm.end_point} onChange={e => setRouteForm({ ...routeForm, end_point: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-bold text-slate-500 w-24">Start Time:</label>
                                        <TimePicker12H
                                            value={routeForm.start_time}
                                            onChange={val => setRouteForm({ ...routeForm, start_time: val })}
                                        />
                                    </div>

                                    <div className="border-t pt-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-sm text-slate-700">Stops</h4>
                                            <span className="text-xs text-slate-400">Click map to add stops</span>
                                        </div>
                                        <div className="space-y-2">
                                            {stops.map((stop, index) => (
                                                <div key={index} className="flex gap-2 items-start animate-in slide-in-from-left-2">
                                                    <div className="flex-1 space-y-1">
                                                        <input
                                                            className="w-full p-2 border rounded-lg text-sm" placeholder="Stop Name"
                                                            autoComplete="off"
                                                            value={stop.name} onChange={e => handleStopChange(index, 'name', e.target.value)}
                                                        />
                                                        <div className="flex gap-2 items-center">
                                                            <TimePicker12H
                                                                value={stop.time}
                                                                onChange={val => handleStopChange(index, 'time', val)}
                                                            />
                                                            {stop.lat && (
                                                                <div className="text-[10px] text-slate-400 flex items-center bg-slate-50 px-2 rounded">
                                                                    <MapPin size={10} className="mr-1" />
                                                                    {Number(stop.lat).toFixed(4)}, {Number(stop.lng).toFixed(4)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button onClick={() => removeStop(index)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-2 text-xs text-slate-500 italic bg-slate-50 p-2 rounded text-center">
                                            ℹ️ Click on the map to add stops sequentially. A route line will connect them.
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Map */}
                                <div className="h-full bg-slate-100 relative">
                                    <MapContainer center={[12.9716, 77.5946]} zoom={13} style={{ height: '100%', width: '100%' }}>
                                        <TileLayer
                                            attribution='Tiles &copy; Esri'
                                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                        />
                                        <TileLayer
                                            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                                        />
                                        <MapController stops={stops} isEditing={isEditingRoute} />
                                        <LocationPicker onLocationSelect={handleMapClick} />

                                        {stops.map((stop, idx) => (
                                            stop.lat && stop.lng && (
                                                <Marker key={idx} position={[stop.lat, stop.lng]}>
                                                    <Popup>{stop.name || `Stop ${idx + 1}`}</Popup>
                                                </Marker>
                                            )
                                        ))}

                                        <Polyline
                                            positions={stops.filter(s => s.lat != null && s.lng != null).map(s => [s.lat, s.lng])}
                                            pathOptions={{ color: '#4f46e5', weight: 4, opacity: 0.8 }}
                                        />
                                    </MapContainer>
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
                                <button onClick={handleAddRoute} disabled={isSubmitting} className={`w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {isSubmitting ? 'Saving...' : (isEditingRoute ? 'Update Route' : 'Create Route')}
                                </button>
                            </div>
                        </div>
                    </div>
                    , document.body)
            }
        </div >
    );
};

export default TransportManagement;
