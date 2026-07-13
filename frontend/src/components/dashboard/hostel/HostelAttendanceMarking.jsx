import React, { useState, useEffect } from 'react';
import { Check, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

const HostelAttendanceMarking = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [hostels, setHostels] = useState([]);
    const [selectedHostel, setSelectedHostel] = useState('');
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState('');
    
    const [students, setStudents] = useState([]);
    const [attendance, setAttendance] = useState({}); // { studentId: 'Present' | 'Absent' | 'Late' }
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => { fetchHostels(); }, []);

    const fetchHostels = async () => {
        try {
            const res = await api.get('/hostel');
            setHostels(res.data);
            if (res.data.length > 0) setSelectedHostel(res.data[0].id);
        } catch { toast.error('Failed to load hostels'); }
    };

    useEffect(() => {
        if (selectedHostel) {
            fetchRooms(selectedHostel);
        } else {
            setRooms([]);
        }
    }, [selectedHostel]);

    const fetchRooms = async (hostelId) => {
        try {
            const res = await api.get(`/hostel/${hostelId}/rooms`);
            setRooms(res.data);
        } catch { toast.error('Failed to load rooms'); }
    };

    useEffect(() => {
        if (selectedHostel && date) {
            fetchAttendanceData();
        }
    }, [selectedHostel, selectedRoom, date]);

    const fetchAttendanceData = async () => {
        setLoading(true);
        try {
            const params = { date, hostel_id: selectedHostel };
            if (selectedRoom) params.room_id = selectedRoom;

            const res = await api.get('/hostel/attendance/daily', { params });
            const data = res.data;

            const statusMap = {};
            data.forEach(s => {
                statusMap[s.student_id] = s.status === 'Unmarked' ? null : s.status;
            });

            setStudents(data);
            setAttendance(statusMap);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleMark = (id, status) => {
        setAttendance(prev => ({ ...prev, [id]: status }));
    };

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const attendanceData = Object.entries(attendance)
                .filter(([, status]) => status !== null)
                .map(([student_id, status]) => ({
                    student_id: parseInt(student_id),
                    status
                }));

            await api.post('/hostel/attendance/daily', { date, hostel_id: selectedHostel, attendanceData });
            toast.success('Attendance saved successfully');
        } catch (error) {
            toast.error('Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    const filteredStudents = React.useMemo(() => {
        if (!search) return students;
        const q = search.toLowerCase();
        return students.filter(s => 
            s.name.toLowerCase().includes(q) || 
            (s.admission_no && s.admission_no.toLowerCase().includes(q)) ||
            (s.room_number && s.room_number.toString().includes(q))
        );
    }, [students, search]);

    return (
        <div className="space-y-6 animate-in fade-in pb-10">
            <div className="flex flex-wrap items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</span>
                    <input
                        type="date"
                        max={new Date().toISOString().split('T')[0]}
                        onChange={e => setDate(e.target.value)}
                        className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-bold max-w-[150px] text-sm focus:outline-none"
                        value={date}
                    />
                </div>

                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hostel</span>
                    <select className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 min-w-[150px] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" 
                        value={selectedHostel} onChange={e => setSelectedHostel(e.target.value)}>
                        <option value="">Select Hostel</option>
                        {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                </div>

                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Room (Optional)</span>
                    <select className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 min-w-[150px] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" 
                        value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)}>
                        <option value="">All Rooms</option>
                        {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {selectedHostel ? (
                    <>
                    <div className="flex flex-col bg-white">
                        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white/95 backdrop-blur-sm z-30 shadow-sm sticky top-0">
                            <div className="relative max-w-sm w-full">
                                <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                                <input type="text" placeholder="Search student or room..."
                                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
                                    value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100"
                                    onClick={() => {
                                        const newAttendance = { ...attendance };
                                        filteredStudents.forEach(s => newAttendance[s.student_id] = 'Present');
                                        setAttendance(newAttendance);
                                    }}
                                >Mark Filtered Present</button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className={`text-xs font-bold text-white px-5 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1 ${saving ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                >
                                    {saving ? 'Saving...' : <><Check size={16} /> Save All</>}
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-20 text-center text-slate-400">Loading students...</div>
                        ) : (
                            <div className="overflow-x-auto max-h-[65vh] overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left text-sm border-collapse table-fixed">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-20">
                                        <tr>
                                            <th className="p-4 w-1/4">Room</th>
                                            <th className="p-4 w-1/3">Student</th>
                                            <th className="p-4 text-center">Mark Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredStudents.map(student => (
                                            <tr key={student.student_id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 font-semibold text-slate-600">Room {student.room_number}</td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-700 truncate">{student.name}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{student.admission_no}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-center gap-2">
                                                        {['Present', 'Absent', 'Late'].map(status => (
                                                            <button
                                                                key={status}
                                                                onClick={() => handleMark(student.student_id, status)}
                                                                className={`min-w-[80px] py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${attendance[student.student_id] === status
                                                                    ? status === 'Present' ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20 ring-2 ring-emerald-500/10'
                                                                        : status === 'Absent' ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/20 ring-2 ring-rose-500/10'
                                                                            : 'bg-amber-500 text-white border-amber-600 shadow-amber-500/20 ring-2 ring-amber-500/10'
                                                                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
                                                                    } active:scale-95`}
                                                            >
                                                                {status}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredStudents.length === 0 && (
                                    <div className="p-12 text-center text-slate-400">
                                        <p>No students found.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    </>
                ) : (
                    <div className="p-20 text-center flex flex-col items-center justify-center text-slate-400">
                        <Check size={32} className="text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-500">Select Hostel</p>
                        <p className="text-sm">Please select a hostel to start marking attendance.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HostelAttendanceMarking;
