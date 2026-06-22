import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import { Plus, Trash2, Home, LayoutGrid, X, Edit2, BedDouble } from 'lucide-react';
import toast from 'react-hot-toast';

const emptyForm = { room_number: '', capacity: 2 };

const RoomManagement = () => {
    const [hostels, setHostels] = useState([]);
    const [selectedHostel, setSelectedHostel] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editRoom, setEditRoom] = useState(null); // null = add mode, room obj = edit mode
    const [loading, setLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);

    const [formData, setFormData] = useState(emptyForm);

    useEffect(() => { fetchHostels(); }, []);
    useEffect(() => {
        if (selectedHostel) fetchRooms(selectedHostel.id);
    }, [selectedHostel]);

    const fetchHostels = async () => {
        try {
            const res = await api.get('/hostel');
            setHostels(res.data);
            if (res.data.length > 0 && !selectedHostel) setSelectedHostel(res.data[0]);
        } catch { toast.error('Failed to fetch hostels'); }
    };

    const fetchRooms = async (hostelId) => {
        setLoading(true);
        try {
            const res = await api.get(`/hostel/${hostelId}/rooms`);
            setRooms(res.data);
        } catch { toast.error('Failed to fetch rooms'); }
        finally { setLoading(false); }
    };

    const openAddModal = () => {
        setEditRoom(null);
        setFormData(emptyForm);
        setShowModal(true);
    };

    const openEditModal = (room) => {
        setEditRoom(room);
        setFormData({
            room_number: room.room_number,
            capacity: room.capacity
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditRoom(null);
        setFormData(emptyForm);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting || isSubmittingRef.current) return;
        setIsSubmitting(true);
        isSubmittingRef.current = true;

        try {
            if (editRoom) {
                // Edit mode
                await api.put(`/hostel/rooms/${editRoom.id}`, formData);
                toast.success('Room updated successfully');
            } else {
                // Add mode
                await api.post(`/hostel/${selectedHostel.id}/rooms`, formData);
                toast.success('Room added successfully');
            }
            fetchRooms(selectedHostel.id);
            closeModal();
        } catch (error) {
            toast.error(error.response?.data?.error || `Failed to ${editRoom ? 'update' : 'add'} room`);
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const handleDelete = async (id) => {
        if (isSubmitting) return;
        if (!window.confirm('Delete this room? This cannot be undone.')) return;
        setIsSubmitting(true);
        try {
            await api.delete(`/hostel/rooms/${id}`);
            toast.success('Room deleted');
            fetchRooms(selectedHostel.id);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to delete room');
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalBeds = rooms.reduce((s, r) => s + parseInt(r.capacity || 0), 0);
    const occupied = rooms.reduce((s, r) => s + parseInt(r.current_occupancy || 0), 0);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Room Management</h2>
                    <p className="text-slate-500 text-sm">Configure rooms, beds and fees</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <div className="relative">
                        <Home className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <select
                            className="pl-9 pr-8 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30 bg-white text-sm"
                            value={selectedHostel?.id || ''}
                            onChange={(e) => {
                                const hostel = hostels.find(h => h.id === parseInt(e.target.value));
                                setSelectedHostel(hostel);
                            }}
                        >
                            {hostels.map(h => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                        </select>
                    </div>
                    {selectedHostel && (
                        <button
                            onClick={openAddModal}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-sm"
                        >
                            <Plus size={16} /> Add Room
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            {rooms.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                    {[
                        { label: 'Total Rooms', value: rooms.length, color: 'bg-slate-50 border-slate-200 text-slate-700' },
                        { label: 'Total Beds', value: totalBeds, color: 'bg-blue-50 border-blue-100 text-blue-700' },
                        { label: 'Occupied', value: occupied, color: 'bg-red-50 border-red-100 text-red-700' },
                        { label: 'Available', value: totalBeds - occupied, color: 'bg-green-50 border-green-100 text-green-700' },
                    ].map(s => (
                        <div key={s.label} className={`border rounded-xl px-4 py-2.5 ${s.color}`}>
                            <p className="text-xs text-slate-500">{s.label}</p>
                            <p className="text-xl font-bold">{s.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Room Grid */}
            {loading ? (
                <div className="text-center py-10 text-slate-400">Loading rooms...</div>
            ) : rooms.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {rooms.map((room) => {
                        const isFull = parseInt(room.current_occupancy) >= room.capacity;
                        const pct = Math.min(parseInt(room.current_occupancy) / room.capacity, 1) * 100;
                        return (
                            <div key={room.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all">
                                {/* Action buttons — appear on hover */}
                                <div className="absolute top-0 right-0 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <button
                                        onClick={() => openEditModal(room)}
                                        disabled={isSubmitting}
                                        className="text-indigo-500 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
                                        title="Edit room"
                                    >
                                        <Edit2 size={13} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(room.id)}
                                        disabled={isSubmitting}
                                        className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                        title="Delete room"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>

                                <div className="flex flex-col items-center text-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${isFull ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                        <LayoutGrid size={20} />
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-sm">Room {room.room_number}</h3>

                                    {/* Beds */}
                                    <div className="mt-2 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                        <BedDouble size={11} />
                                        {room.current_occupancy}/{room.capacity} beds
                                    </div>


                                </div>

                                {/* Capacity Bar */}
                                <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${isFull ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-green-400'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <LayoutGrid className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <p className="text-slate-500">No rooms configured for this hostel yet.</p>
                </div>
            )}

            {/* Add / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-bold text-slate-800">
                                {editRoom ? `Edit Room ${editRoom.room_number}` : 'Add Room'}
                            </h3>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                                <X size={20} />
                            </button>
                        </div>

                        {editRoom && (
                            <div className="mb-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                                <BedDouble size={14} className="text-indigo-500" />
                                Currently <span className="font-semibold text-slate-700">{editRoom.current_occupancy}</span> of&nbsp;
                                <span className="font-semibold text-slate-700">{editRoom.capacity}</span> beds occupied.
                                {parseInt(editRoom.current_occupancy) > 0 && (
                                    <span className="text-amber-600 ml-1">Capacity cannot go below {editRoom.current_occupancy}.</span>
                                )}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Room Number</label>
                                <input
                                    required
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none text-sm"
                                    value={formData.room_number}
                                    onChange={e => setFormData({ ...formData, room_number: e.target.value })}
                                    placeholder="e.g. 101"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Capacity (Beds)
                                    {editRoom && parseInt(editRoom.current_occupancy) > 0 && (
                                        <span className="ml-2 text-xs text-amber-500 font-normal">min {editRoom.current_occupancy}</span>
                                    )}
                                </label>
                                <input
                                    type="number"
                                    min={editRoom ? parseInt(editRoom.current_occupancy) || 1 : 1}
                                    required
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 outline-none text-sm"
                                    value={formData.capacity}
                                    onChange={e => setFormData({ ...formData, capacity: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                                >
                                    {isSubmitting
                                        ? (editRoom ? 'Saving…' : 'Adding…')
                                        : (editRoom ? 'Save Changes' : 'Add Room')
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomManagement;
