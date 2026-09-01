import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bus, MapPin, Navigation, Plus, Edit2, Trash2, RotateCw, Phone, User, Users, Clock } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

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
                className="p-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                    <option key={h} value={h}>{h}</option>
                ))}
            </select>
            <span className="text-slate-400 font-bold">:</span>
            <select
                value={tm.minute}
                onChange={e => handleChange('minute', e.target.value)}
                className="p-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => (
                    <option key={m} value={m}>{m}</option>
                ))}
            </select>
            <select
                value={tm.period}
                onChange={e => handleChange('period', e.target.value)}
                className="p-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
            </select>
        </div>
    );
};

const TransportManagement = ({ initialTab }) => {
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

    const handleDriverSearch = async (e) => {
        const query = e.target.value;
        setDriverSearch(query);
        if (query.length > 1) {
            try {
                const res = await api.get(`/staff?search=${query}`);
                setDriverResults(res.data);
            } catch (error) {
                console.error(error);
            }
        } else {
            setDriverResults([]);
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
        route_name: '', start_point: '', end_point: '', start_time: '', vehicle_id: ''
    });

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
        if (!vehicleForm.vehicle_number) {
            return toast.error('Please enter vehicle / bus number');
        }
        setIsSubmitting(true);
        try {
            const payload = { ...vehicleForm };
            if (!payload.gps_device_id) delete payload.gps_device_id;

            await api.post('/transport/vehicles', payload);

            toast.success('Vehicle added successfully');
            setShowVehicleModal(false);
            setVehicleForm({ vehicle_number: '', vehicle_model: '', driver_name: '', driver_phone: '', capacity: '', gps_device_id: '', driver_id: '' });
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
        if (!window.confirm('Are you sure you want to delete this vehicle?')) return;
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
        if (!routeForm.route_name) {
            return toast.error('Please enter Route Name');
        }
        if (!routeForm.start_point || !routeForm.end_point) {
            return toast.error('Please enter Starting Point and Ending Point');
        }
        setIsSubmitting(true);
        try {
            if (isEditingRoute) {
                if (!selectedRouteId) return toast.error('Error: missing Route ID');
                await api.put(`/transport/routes/${selectedRouteId}`, routeForm);
                toast.success('Route updated successfully');
            } else {
                await api.post('/transport/routes', routeForm);
                toast.success('Route created successfully');
            }
            setShowRouteModal(false);
            setIsEditingRoute(false);
            setSelectedRouteId(null);
            fetchData();
        } catch (error) {
            console.error('Route Save Error:', error);
            toast.error(error.response?.data?.message || 'Failed to save route');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditRoute = (route) => {
        setRouteForm({
            route_name: route.route_name,
            start_point: route.start_point,
            end_point: route.end_point,
            start_time: route.start_time || '',
            vehicle_id: route.vehicle_id || ''
        });
        setSelectedRouteId(route.id);
        setIsEditingRoute(true);
        setShowRouteModal(true);
    };

    const handleDeleteRoute = async (id) => {
        if (isSubmitting) return;
        if (!window.confirm('Are you sure you want to delete this route?')) return;
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
        setRouteForm({ route_name: '', start_point: '', end_point: '', start_time: '', vehicle_id: '' });
        setSelectedRouteId(null);
        setIsEditingRoute(false);
        setShowRouteModal(true);
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
        <div className="space-y-6">
            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <>
                    {/* VEHICLES TAB */}
                    {initialTab === 'vehicles' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                        <Bus className="text-indigo-600" size={20} />
                                        Fleet & Buses
                                    </h3>
                                    <p className="text-xs text-slate-500">Manage school transport vehicles and assigned drivers</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setVehicleForm({ vehicle_number: '', vehicle_model: '', driver_name: '', driver_phone: '', capacity: '', gps_device_id: '', driver_id: '' });
                                        setShowVehicleModal(true);
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                                >
                                    <Plus size={16} /> Add Bus / Vehicle
                                </button>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                            <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                <th className="p-4">Bus / Vehicle No</th>
                                                <th className="p-4">Model</th>
                                                <th className="p-4">Assigned Driver</th>
                                                <th className="p-4">Driver Phone</th>
                                                <th className="p-4">Capacity</th>
                                                <th className="p-4">Status</th>
                                                <th className="p-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {vehicles.map(vehicle => (
                                                <tr key={vehicle.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-4 font-black text-slate-800 flex items-center gap-2">
                                                        <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                                            <Bus size={18} />
                                                        </span>
                                                        {vehicle.vehicle_number}
                                                    </td>
                                                    <td className="p-4 text-slate-600 font-medium">{vehicle.vehicle_model || 'School Bus'}</td>
                                                    <td className="p-4 font-bold text-slate-700">{vehicle.driver_name || <span className="text-slate-400 font-normal italic">Unassigned</span>}</td>
                                                    <td className="p-4 text-slate-600">
                                                        {vehicle.driver_phone ? (
                                                            <a href={`tel:${vehicle.driver_phone}`} className="text-indigo-600 hover:underline flex items-center gap-1 font-medium">
                                                                <Phone size={12} /> {vehicle.driver_phone}
                                                            </a>
                                                        ) : '--'}
                                                    </td>
                                                    <td className="p-4 text-slate-600 font-medium">{vehicle.capacity ? `${vehicle.capacity} Seats` : '--'}</td>
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                            vehicle.status === 'Active' 
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                                : 'bg-slate-100 text-slate-500'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${vehicle.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                                            {vehicle.status === 'Active' ? 'Active / On Trip' : 'Idle'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => handleDeleteVehicle(vehicle.id)}
                                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete Vehicle"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {vehicles.length === 0 && (
                                                <tr>
                                                    <td colSpan="7" className="p-8 text-center text-slate-400 italic">
                                                        No vehicles added yet. Click "Add Bus / Vehicle" above to register your first bus.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ROUTES TAB */}
                    {initialTab === 'routes' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                        <Navigation className="text-indigo-600" size={20} />
                                        Transport Routes
                                    </h3>
                                    <p className="text-xs text-slate-500">Configure route names, starting points, and ending destinations</p>
                                </div>
                                <button
                                    onClick={handleCreateRoute}
                                    className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                                >
                                    <Plus size={16} /> Create New Route
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {routes.map(route => (
                                    <div key={route.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                                    <Navigation size={22} />
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleEditRoute(route)}
                                                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        title="Edit Route"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRoute(route.id)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete Route"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            <h3 className="font-black text-lg text-slate-800 mb-2">{route.route_name}</h3>

                                            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                                    <span className="font-bold text-slate-500">From:</span>
                                                    <span className="font-bold text-slate-800 truncate">{route.start_point || 'Not specified'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0"></span>
                                                    <span className="font-bold text-slate-500">To:</span>
                                                    <span className="font-bold text-slate-800 truncate">{route.end_point || 'Not specified'}</span>
                                                </div>
                                                {route.start_time && (
                                                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200/50">
                                                        <Clock size={12} className="text-slate-400" />
                                                        <span className="font-bold text-slate-500">Departure:</span>
                                                        <span className="font-bold text-slate-700">{formatTime(route.start_time)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100">
                                            <span>Assigned Bus: <strong className="text-slate-700">{route.vehicle_number || 'Any Available'}</strong></span>
                                        </div>
                                    </div>
                                ))}

                                {routes.length === 0 && (
                                    <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                                        <Navigation size={40} className="mx-auto mb-3 opacity-30 text-indigo-600" />
                                        <p className="font-bold text-slate-600">No routes created yet.</p>
                                        <p className="text-xs text-slate-400 mt-1">Create simple routes with a starting point and destination.</p>
                                        <button onClick={handleCreateRoute} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-indigo-700 transition-all">
                                            + Create First Route
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ADD / EDIT VEHICLE MODAL */}
            {showVehicleModal && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                <Bus className="text-indigo-600" size={20} />
                                Add New Bus / Vehicle
                            </h3>
                            <button onClick={() => setShowVehicleModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vehicle / Bus Number *</label>
                                <input
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-500 outline-none"
                                    placeholder="e.g. Bus 01 or KA-01-AB-1234"
                                    autoComplete="off"
                                    value={vehicleForm.vehicle_number}
                                    onChange={e => setVehicleForm({ ...vehicleForm, vehicle_number: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vehicle Model / Type</label>
                                <input
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none"
                                    placeholder="e.g. Tata Starbus / 32-Seater"
                                    autoComplete="off"
                                    value={vehicleForm.vehicle_model}
                                    onChange={e => setVehicleForm({ ...vehicleForm, vehicle_model: e.target.value })}
                                />
                            </div>

                            {/* Driver Search Section */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assigned Driver</label>
                                {vehicleForm.driver_name ? (
                                    <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                                        <div>
                                            <div className="font-bold text-slate-800">{vehicleForm.driver_name}</div>
                                            <div className="text-xs text-slate-500">{vehicleForm.driver_phone || 'No phone'}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setVehicleForm({ ...vehicleForm, driver_name: '', driver_phone: '', driver_id: '' })}
                                            className="text-xs bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                                        >
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input
                                            className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm focus:border-indigo-500 outline-none font-medium"
                                            placeholder="Search staff by name or ID..."
                                            autoComplete="off"
                                            value={driverSearch}
                                            onChange={handleDriverSearch}
                                        />
                                        {driverResults.length > 0 && (
                                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-44 overflow-y-auto">
                                                {driverResults.map(s => (
                                                    <div
                                                        key={s.id}
                                                        onClick={() => selectDriver(s)}
                                                        className="p-3 hover:bg-indigo-50 cursor-pointer text-sm border-b border-slate-100 last:border-0"
                                                    >
                                                        <div className="font-bold text-slate-800">{s.name}</div>
                                                        <div className="text-xs text-slate-500">ID: {s.employee_id} • Ph: {s.phone || 'N/A'}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Seating Capacity</label>
                                <input
                                    type="number"
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none"
                                    placeholder="e.g. 35"
                                    autoComplete="off"
                                    value={vehicleForm.capacity}
                                    onChange={e => setVehicleForm({ ...vehicleForm, capacity: e.target.value })}
                                />
                            </div>

                            <button
                                onClick={handleAddVehicle}
                                disabled={isSubmitting}
                                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Saving...' : 'Add Vehicle'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ADD / EDIT ROUTE MODAL (Simplified: No Map, No Stops) */}
            {showRouteModal && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                <Navigation className="text-indigo-600" size={20} />
                                {isEditingRoute ? 'Edit Route' : 'Create New Route'}
                            </h3>
                            <button onClick={() => setShowRouteModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Route Name *</label>
                                <input
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-bold focus:border-indigo-500 outline-none"
                                    placeholder="e.g. Route 1 - City Center to School"
                                    autoComplete="off"
                                    value={routeForm.route_name}
                                    onChange={e => setRouteForm({ ...routeForm, route_name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Starting Point *</label>
                                    <input
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none"
                                        placeholder="e.g. City Bus Stand"
                                        autoComplete="off"
                                        value={routeForm.start_point}
                                        onChange={e => setRouteForm({ ...routeForm, start_point: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ending Point *</label>
                                    <input
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none"
                                        placeholder="e.g. School Campus"
                                        autoComplete="off"
                                        value={routeForm.end_point}
                                        onChange={e => setRouteForm({ ...routeForm, end_point: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estimated Start Time</label>
                                <TimePicker12H
                                    value={routeForm.start_time}
                                    onChange={val => setRouteForm({ ...routeForm, start_time: val })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Default Bus (Optional)</label>
                                <select
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-sm bg-slate-50 font-bold text-slate-700 outline-none focus:border-indigo-500"
                                    value={routeForm.vehicle_id || ''}
                                    onChange={e => setRouteForm({ ...routeForm, vehicle_id: e.target.value })}
                                >
                                    <option value="">-- Any Available Bus --</option>
                                    {vehicles.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.vehicle_number} ({v.driver_name || 'No driver'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleAddRoute}
                                disabled={isSubmitting}
                                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Saving...' : (isEditingRoute ? 'Update Route' : 'Create Route')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default TransportManagement;
