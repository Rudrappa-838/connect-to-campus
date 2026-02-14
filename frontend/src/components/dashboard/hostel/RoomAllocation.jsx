import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import { UserPlus, LogOut, Home, Search, User } from 'lucide-react';
import toast from 'react-hot-toast';

const RoomAllocation = () => {
    const [hostels, setHostels] = useState([]);
    const [selectedHostel, setSelectedHostel] = useState(null);
    const [allocations, setAllocations] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // For allocation modal
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [studentSearch, setStudentSearch] = useState('');
    const [students, setStudents] = useState([]); // List of students to search from
    const [selectedStudent, setSelectedStudent] = useState(null);

    useEffect(() => {
        fetchHostels();
        // Pre-fetch students for search (in real app, use async search)
        fetchStudents();
    }, []);

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
            if (res.data.length > 0 && !selectedHostel) {
                setSelectedHostel(res.data[0]);
            }
        } catch (error) { toast.error('Failed to load hostels'); }
    };

    const fetchAllocations = async (hostelId) => {
        try {
            const res = await api.get(`/hostel/${hostelId}/allocations`);
            setAllocations(res.data);
        } catch (error) { toast.error('Failed to load allocations'); }
    };

    const fetchRooms = async (hostelId) => {
        try {
            const res = await api.get(`/hostel/${hostelId}/rooms`);
            setRooms(res.data);
        } catch (error) { toast.error('Failed to load rooms'); }
    };

    const fetchStudents = async () => {
        try {
            const res = await api.get('/students');
            // Assuming this endpoint returns a list. If paginated, need logic.
            setStudents(res.data);
        } catch (error) { console.error('Failed to load students'); }
    };

    const handleAllocate = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!selectedRoomId || !selectedStudent) {
            toast.error('Please select room and student');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post(`/hostel/rooms/${selectedRoomId}/allocate`, {
                student_id: selectedStudent.id
            });
            toast.success('Room allocated successfully');
            setShowModal(false);
            fetchAllocations(selectedHostel.id);
            // Reset
            setSelectedStudent(null);
            setStudentSearch('');
            setSelectedRoomId('');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Allocation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVacate = async (allocationId) => {
        if (isSubmitting) return;
        if (!window.confirm('Are you sure you want to vacate this room?')) return;

        setIsSubmitting(true);
        try {
            await api.post(`/hostel/allocations/${allocationId}/vacate`);
            toast.success('Room vacated');
            fetchAllocations(selectedHostel.id);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Operation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyStudent = async () => {
        if (!studentSearch.trim()) {
            toast.error('Please enter Student ID');
            return;
        }

        try {
            // Re-using the hostel details endpoint as it verifies student existence and returns basic info
            // Ideally should have a dedicated lightweight verify endpoint or use existing student search
            const encodedSearch = encodeURIComponent(studentSearch.trim());
            const res = await api.get(`/hostel/student/${encodedSearch}/details`);
            if (res.data.is_allocated) {
                toast.error(`Student already allocated to room ${res.data.room_number}`);
                return;
            }
            setSelectedStudent(res.data);
            toast.success('Student verified');
        } catch (error) {
            toast.error('Student not found');
            setSelectedStudent(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Room Allocation</h2>
                    <p className="text-slate-500">Manage student housing assignments</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Home className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                        <select
                            className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
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
                            onClick={() => setShowModal(true)}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                        >
                            <UserPlus size={20} /> New Allocation
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-700">Room</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Student Name</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Allocation Date</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {allocations.map((alloc) => (
                            <tr key={alloc.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                            {alloc.room_number}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-slate-100 p-1.5 rounded-full">
                                            <User size={16} className="text-slate-500" />
                                        </div>
                                        {alloc.name}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-slate-500">
                                    {new Date(alloc.allocation_date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => handleVacate(alloc.id)}
                                        disabled={isSubmitting}
                                        className={`text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <LogOut size={14} /> {isSubmitting ? 'Vacating...' : 'Vacate'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {allocations.length === 0 && (
                            <tr>
                                <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                    No active allocations found for this hostel.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Allocate Room</h3>
                            <button onClick={() => { setShowModal(false); setSelectedStudent(null); setStudentSearch(''); }} className="text-slate-400 hover:text-slate-600">
                                <LogOut size={24} className="rotate-45" /> {/* Close icon */}
                            </button>
                        </div>
                        <form onSubmit={handleAllocate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Select Room</label>
                                <select
                                    required
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    value={selectedRoomId}
                                    onChange={e => setSelectedRoomId(e.target.value)}
                                >
                                    <option value="">-- Select Room --</option>
                                    {rooms.filter(r => parseInt(r.current_occupancy) < r.capacity).map(r => (
                                        <option key={r.id} value={r.id}>
                                            Room {r.room_number} ({r.capacity - parseInt(r.current_occupancy)} spots left)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Student (Student ID)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                        placeholder="Enter Student ID"
                                        value={studentSearch}
                                        onChange={e => setStudentSearch(e.target.value)}
                                        disabled={!!selectedStudent}
                                    />
                                    {!selectedStudent && (
                                        <button
                                            type="button"
                                            onClick={handleVerifyStudent}
                                            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-medium transition-colors"
                                        >
                                            Verify
                                        </button>
                                    )}
                                    {selectedStudent && (
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedStudent(null); setStudentSearch(''); }}
                                            className="px-4 py-2 text-slate-500 hover:text-slate-700 font-medium"
                                        >
                                            Change
                                        </button>
                                    )}
                                </div>
                            </div>

                            {selectedStudent && (
                                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                            {selectedStudent.name[0]}
                                        </div>
                                        <div>
                                            <p className="font-bold text-indigo-900">{selectedStudent.name}</p>
                                            <p className="text-xs text-indigo-600">Class: {selectedStudent.class_name || 'N/A'}{selectedStudent.section_name ? ` - ${selectedStudent.section_name}` : ''}</p>
                                        </div>
                                        <div className="ml-auto">
                                            <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center">
                                                <User size={14} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedRoomId || !selectedStudent}
                                className={`w-full mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isSubmitting ? 'Allocating...' : 'Confirm Allocation'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomAllocation;
