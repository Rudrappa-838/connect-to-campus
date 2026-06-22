import React, { useState, useEffect, useMemo } from 'react';
import api from '../../../api/axios';
import {
    Home, Users, CheckSquare, Square, ChevronDown, ChevronRight,
    LogOut, Edit2, X, Search, BedDouble, AlertCircle, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

/* ─── Helper ────────────────────────────────────────────────── */
const groupByClass = (students) => {
    const map = {};
    students.forEach(s => {
        const key = s.class_name || 'Unassigned';
        if (!map[key]) map[key] = { class_name: key, class_id: s.class_id, students: [] };
        map[key].students.push(s);
    });
    // Sort students alphabetically within each class
    Object.values(map).forEach(g => g.students.sort((a, b) => a.name.localeCompare(b.name)));
    // Sort classes alphabetically
    return Object.values(map).sort((a, b) => a.class_name.localeCompare(b.class_name));
};

/* ─── Edit Modal ────────────────────────────────────────────── */
const EditAllocationModal = ({ allocation, rooms, onClose, onSaved }) => {
    const [selectedRoom, setSelectedRoom] = useState('');
    const [saving, setSaving] = useState(false);

    const availableRooms = rooms.filter(r =>
        parseInt(r.current_occupancy) < r.capacity || r.room_number === allocation.room_number
    );

    const handleSave = async () => {
        if (!selectedRoom) { toast.error('Select a room'); return; }
        setSaving(true);
        try {
            await api.put(`/hostel/allocations/${allocation.id}`, { room_id: selectedRoom });
            toast.success('Room updated successfully');
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-lg font-bold text-slate-800">Edit Allocation</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="mb-4 p-3 bg-indigo-50 rounded-xl">
                    <p className="font-semibold text-indigo-900">{allocation.name}</p>
                    <p className="text-xs text-indigo-600 mt-0.5">Current: Room {allocation.room_number}</p>
                </div>

                <label className="block text-sm font-medium text-slate-700 mb-2">Move to Room</label>
                <select
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-sm"
                    value={selectedRoom}
                    onChange={e => setSelectedRoom(e.target.value)}
                >
                    <option value="">-- Select Room --</option>
                    {availableRooms.map(r => (
                        <option key={r.id} value={r.id}>
                            Room {r.room_number} — {r.capacity - parseInt(r.current_occupancy)} beds free
                        </option>
                    ))}
                </select>

                <div className="flex gap-3 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !selectedRoom}
                        className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── Allocate Modal ────────────────────────────────────────── */
const AllocateModal = ({ hostel, rooms, onClose, onAllocated }) => {
    const [unallocated, setUnallocated] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState('');
    const [checked, setChecked] = useState(new Set());
    const [expandedClasses, setExpandedClasses] = useState({});
    const [search, setSearch] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const selectedRoomObj = rooms.find(r => r.id === parseInt(selectedRoom));
    const bedsAvailable = selectedRoomObj
        ? selectedRoomObj.capacity - parseInt(selectedRoomObj.current_occupancy)
        : 0;

    useEffect(() => {
        fetchUnallocated();
    }, []);

    const fetchUnallocated = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/hostel/unallocated-students?hostelId=${hostel.id}`);
            const sorted = [...res.data].sort((a, b) => a.name.localeCompare(b.name));
            setUnallocated(sorted);
            // Expand all classes by default
            const groups = groupByClass(sorted);
            const expanded = {};
            groups.forEach(g => { expanded[g.class_name] = true; });
            setExpandedClasses(expanded);
        } catch {
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        if (!search.trim()) return unallocated;
        const q = search.toLowerCase();
        return unallocated.filter(s =>
            s.name.toLowerCase().includes(q) ||
            (s.admission_no || '').toLowerCase().includes(q)
        );
    }, [unallocated, search]);

    const grouped = useMemo(() => groupByClass(filtered), [filtered]);

    const toggleStudent = (id) => {
        setChecked(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                if (selectedRoom && next.size >= bedsAvailable) {
                    toast.error(`Only ${bedsAvailable} bed${bedsAvailable !== 1 ? 's' : ''} available in Room ${selectedRoomObj?.room_number}`);
                    return prev;
                }
                next.add(id);
            }
            return next;
        });
    };

    const toggleClass = (classStudents) => {
        const ids = classStudents.map(s => s.id);
        const allChecked = ids.every(id => checked.has(id));
        if (allChecked) {
            setChecked(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
        } else {
            // Add only up to bed limit
            setChecked(prev => {
                const n = new Set(prev);
                for (const id of ids) {
                    if (selectedRoom && n.size >= bedsAvailable) break;
                    n.add(id);
                }
                if (selectedRoom && n.size >= bedsAvailable && !ids.every(id => n.has(id))) {
                    toast.error(`Only ${bedsAvailable} bed${bedsAvailable !== 1 ? 's' : ''} available — selection limited`);
                }
                return n;
            });
        }
    };

    const handleAllocate = async () => {
        if (!selectedRoom) { toast.error('Please select a room first'); return; }
        if (checked.size === 0) { toast.error('Please select at least one student'); return; }
        if (checked.size > bedsAvailable) {
            toast.error(`Only ${bedsAvailable} beds available`); return;
        }
        setSubmitting(true);
        try {
            const res = await api.post(`/hostel/rooms/${selectedRoom}/bulk-allocate`, {
                student_ids: Array.from(checked)
            });
            toast.success(`✅ ${res.data.allocated} student(s) allocated successfully!`);
            onAllocated();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Allocation failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl" style={{ maxHeight: '90vh' }}>
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Allocate Students</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{hostel.name} — {hostel.type} Hostel</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                        <X size={20} />
                    </button>
                </div>

                {/* Room selector + stats */}
                <div className="p-5 border-b border-slate-100 bg-slate-50 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Select Room</label>
                            <select
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-sm"
                                value={selectedRoom}
                                onChange={e => { setSelectedRoom(e.target.value); setChecked(new Set()); }}
                            >
                                <option value="">-- Choose a room --</option>
                                {rooms.filter(r => parseInt(r.current_occupancy) < r.capacity).map(r => (
                                    <option key={r.id} value={r.id}>
                                        Room {r.room_number} — {r.capacity - parseInt(r.current_occupancy)}/{r.capacity} beds free
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end gap-2">
                            {selectedRoomObj && (
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                                    <BedDouble size={16} className="text-indigo-500" />
                                    <span className="text-sm font-semibold text-indigo-700">
                                        {bedsAvailable} beds free
                                    </span>
                                </div>
                            )}
                            {/* Selected count — turns red when over bed limit */}
                            <div className={`px-4 py-2.5 rounded-xl border ${
                                selectedRoom && checked.size > bedsAvailable
                                    ? 'bg-red-50 border-red-300'
                                    : 'bg-green-50 border-green-100'
                            }`}>
                                <span className={`text-sm font-semibold ${
                                    selectedRoom && checked.size > bedsAvailable ? 'text-red-600' : 'text-green-700'
                                }`}>{checked.size} selected</span>
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search student name or admission no…"
                            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Over-limit red error banner */}
                    {selectedRoom && checked.size > bedsAvailable && (
                        <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-300 rounded-xl text-sm text-red-700 font-semibold">
                            <AlertCircle size={16} className="flex-shrink-0 text-red-500" />
                            <span>
                                Only <span className="underline">{bedsAvailable} bed{bedsAvailable !== 1 ? 's' : ''}</span> available.
                                You selected {checked.size} — please deselect at least <span className="underline">{checked.size - bedsAvailable}</span> student{checked.size - bedsAvailable !== 1 ? 's' : ''}.
                            </span>
                        </div>
                    )}

                    {/* At-limit amber banner */}
                    {selectedRoom && bedsAvailable > 0 && checked.size === bedsAvailable && (
                        <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
                            <AlertCircle size={14} />
                            Room full — {bedsAvailable} bed limit reached.
                        </div>
                    )}
                </div>

                {/* Student list */}
                <div className="overflow-y-auto flex-1 p-4 space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-slate-400">
                            <div className="animate-spin w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full mr-2" />
                            Loading students…
                        </div>
                    ) : grouped.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Users size={32} className="mx-auto mb-2 opacity-40" />
                            <p className="text-sm">No unallocated students found</p>
                        </div>
                    ) : (
                        grouped.map(group => {
                            const allInGroupChecked = group.students.every(s => checked.has(s.id));
                            const someChecked = group.students.some(s => checked.has(s.id));
                            const isExpanded = expandedClasses[group.class_name] !== false;
                            return (
                                <div key={group.class_name} className="border border-slate-200 rounded-xl overflow-hidden">
                                    {/* Class header */}
                                    <div
                                        className="flex items-center gap-3 px-4 py-3 bg-slate-50 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                                        onClick={() => setExpandedClasses(p => ({ ...p, [group.class_name]: !isExpanded }))}
                                    >
                                        {/* Class-level checkbox */}
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); toggleClass(group.students); }}
                                            className="text-indigo-600 flex-shrink-0"
                                        >
                                            {allInGroupChecked
                                                ? <CheckSquare size={18} />
                                                : someChecked
                                                    ? <CheckSquare size={18} className="opacity-40" />
                                                    : <Square size={18} className="text-slate-400" />
                                            }
                                        </button>
                                        <span className="font-semibold text-slate-700 flex-1 text-sm">{group.class_name}</span>
                                        <span className="text-xs text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                            {group.students.filter(s => checked.has(s.id)).length}/{group.students.length}
                                        </span>
                                        {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                    </div>

                                    {/* Students in class */}
                                    {isExpanded && (
                                        <div className="divide-y divide-slate-100">
                                            {group.students.map((s, idx) => {
                                                const isChecked = checked.has(s.id);
                                                const isDisabled = !isChecked && selectedRoom && checked.size >= bedsAvailable;
                                                return (
                                                    <div
                                                        key={s.id}
                                                        onClick={() => !isDisabled && toggleStudent(s.id)}
                                                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
                                                            ${isChecked ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}
                                                            ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
                                                        `}
                                                    >
                                                        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                                                            {isChecked
                                                                ? <CheckSquare size={16} className="text-indigo-600" />
                                                                : <Square size={16} className="text-slate-300" />
                                                            }
                                                        </span>
                                                        {/* Roll number badge */}
                                                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-medium flex-shrink-0">
                                                            {idx + 1}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-sm font-medium truncate ${isChecked ? 'text-indigo-900' : 'text-slate-800'}`}>{s.name}</p>
                                                            <p className="text-xs text-slate-400">{s.admission_no}{s.section_name ? ` · ${s.section_name}` : ''}</p>
                                                        </div>
                                                        {isChecked && (
                                                            <CheckCircle size={14} className="text-indigo-500 flex-shrink-0" />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleAllocate}
                        disabled={submitting || checked.size === 0 || !selectedRoom || (selectedRoom && checked.size > bedsAvailable)}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed ${
                            selectedRoom && checked.size > bedsAvailable
                                ? 'bg-red-100 text-red-500 border border-red-200'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                        }`}
                    >
                        {submitting ? (
                            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Allocating…</>
                        ) : selectedRoom && checked.size > bedsAvailable ? (
                            <><AlertCircle size={16} /> Deselect {checked.size - bedsAvailable} student{checked.size - bedsAvailable !== 1 ? 's' : ''}</>
                        ) : (
                            <><CheckCircle size={16} /> Allocate {checked.size} Student{checked.size !== 1 ? 's' : ''}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── Main Component ────────────────────────────────────────── */
const RoomAllocation = () => {
    const [hostels, setHostels] = useState([]);
    const [selectedHostel, setSelectedHostel] = useState(null);
    const [allocations, setAllocations] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [showAllocateModal, setShowAllocateModal] = useState(false);
    const [editAllocation, setEditAllocation] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchAlloc, setSearchAlloc] = useState('');

    useEffect(() => { fetchHostels(); }, []);
    useEffect(() => {
        if (selectedHostel) {
            fetchAllocations(selectedHostel.id);
            fetchRooms(selectedHostel.id);
        }
    }, [selectedHostel]);

    const fetchHostels = async () => {
        try {
            const res = await api.get('/hostel');
            setHostels(res.data);
            if (res.data.length > 0) setSelectedHostel(res.data[0]);
        } catch { toast.error('Failed to load hostels'); }
    };

    const fetchAllocations = async (hostelId) => {
        try {
            const res = await api.get(`/hostel/${hostelId}/allocations`);
            // Sort alphabetically by student name
            const sorted = [...res.data].sort((a, b) => a.name.localeCompare(b.name));
            setAllocations(sorted);
        } catch { toast.error('Failed to load allocations'); }
    };

    const fetchRooms = async (hostelId) => {
        try {
            const res = await api.get(`/hostel/${hostelId}/rooms`);
            setRooms(res.data);
        } catch { toast.error('Failed to load rooms'); }
    };

    const handleVacate = async (allocationId, studentName) => {
        if (!window.confirm(`Vacate room for ${studentName}?`)) return;
        setIsSubmitting(true);
        try {
            await api.post(`/hostel/allocations/${allocationId}/vacate`);
            toast.success('Room vacated');
            fetchAllocations(selectedHostel.id);
            fetchRooms(selectedHostel.id);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Operation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredAllocations = useMemo(() => {
        if (!searchAlloc.trim()) return allocations;
        const q = searchAlloc.toLowerCase();
        return allocations.filter(a =>
            (a.name || '').toLowerCase().includes(q) ||
            (a.room_number || '').toString().includes(q)
        );
    }, [allocations, searchAlloc]);

    const totalBeds = rooms.reduce((s, r) => s + parseInt(r.capacity || 0), 0);
    const occupied = rooms.reduce((s, r) => s + parseInt(r.current_occupancy || 0), 0);
    const freeBeds = totalBeds - occupied;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Room Allocation</h2>
                    <p className="text-slate-500 text-sm">Manage student housing assignments</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {/* Hostel selector */}
                    <div className="relative">
                        <Home className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <select
                            className="pl-9 pr-8 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30 bg-white text-sm"
                            value={selectedHostel?.id || ''}
                            onChange={e => {
                                const h = hostels.find(h => h.id === parseInt(e.target.value));
                                setSelectedHostel(h);
                                setAllocations([]);
                            }}
                        >
                            {hostels.map(h => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                        </select>
                    </div>
                    {selectedHostel && rooms.some(r => parseInt(r.current_occupancy) < r.capacity) && (
                        <button
                            onClick={() => setShowAllocateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <Users size={16} /> Allocate Students
                        </button>
                    )}
                </div>
            </div>

            {/* Stats bar */}
            {selectedHostel && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Total Beds', value: totalBeds, color: 'bg-slate-50 border-slate-200', text: 'text-slate-700' },
                        { label: 'Occupied', value: occupied, color: 'bg-red-50 border-red-100', text: 'text-red-700' },
                        { label: 'Available', value: freeBeds, color: 'bg-green-50 border-green-100', text: 'text-green-700' },
                    ].map(stat => (
                        <div key={stat.label} className={`${stat.color} border rounded-xl px-4 py-3`}>
                            <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
                            <p className={`text-2xl font-bold ${stat.text}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Allocations Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-700">
                        Current Allocations
                        <span className="ml-2 text-xs font-normal text-slate-400">({filteredAllocations.length})</span>
                    </h3>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search name or room…"
                            className="pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30 w-48"
                            value={searchAlloc}
                            onChange={e => setSearchAlloc(e.target.value)}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            <tr>
                                <th className="px-5 py-3">#</th>
                                <th className="px-5 py-3">Student</th>
                                <th className="px-5 py-3">Room</th>
                                <th className="px-5 py-3">Date</th>
                                <th className="px-5 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredAllocations.map((alloc, idx) => (
                                <tr key={alloc.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-5 py-3 text-slate-400 text-xs">{idx + 1}</td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">
                                                {(alloc.name || '?')[0].toUpperCase()}
                                            </div>
                                            <span className="font-medium text-slate-800">{alloc.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold">
                                            <BedDouble size={12} /> Room {alloc.room_number}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-slate-500 text-xs">
                                        {alloc.allocation_date ? new Date(alloc.allocation_date).toLocaleDateString('en-IN') : '—'}
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setEditAllocation(alloc)}
                                                className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                            >
                                                <Edit2 size={12} /> Edit
                                            </button>
                                            <button
                                                onClick={() => handleVacate(alloc.id, alloc.name)}
                                                disabled={isSubmitting}
                                                className="flex items-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                            >
                                                <LogOut size={12} /> Vacate
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredAllocations.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-5 py-14 text-center text-slate-400">
                                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No active allocations{searchAlloc ? ' matching your search' : ' for this hostel'}</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {showAllocateModal && selectedHostel && (
                <AllocateModal
                    hostel={selectedHostel}
                    rooms={rooms}
                    onClose={() => setShowAllocateModal(false)}
                    onAllocated={() => {
                        fetchAllocations(selectedHostel.id);
                        fetchRooms(selectedHostel.id);
                    }}
                />
            )}
            {editAllocation && (
                <EditAllocationModal
                    allocation={editAllocation}
                    rooms={rooms}
                    onClose={() => setEditAllocation(null)}
                    onSaved={() => {
                        fetchAllocations(selectedHostel.id);
                        fetchRooms(selectedHostel.id);
                    }}
                />
            )}
        </div>
    );
};

export default RoomAllocation;
