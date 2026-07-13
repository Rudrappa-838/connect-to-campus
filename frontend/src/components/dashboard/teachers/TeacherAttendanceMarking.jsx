import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

const TeacherAttendanceMarking = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [teachers, setTeachers] = useState([]);
    const [attendance, setAttendance] = useState({});

    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchAttendance(); }, [date]);

    const fetchAttendance = async () => {
        try {
            const res = await api.get('/teachers/attendance/daily', { params: { date } });
            setTeachers(res.data);
            const map = {};
            res.data.forEach(t => map[t.id] = t.status === 'Unmarked' ? 'Present' : t.status);
            setAttendance(map);
        } catch (e) { toast.error('Failed to load data'); }
    };

    const handleSave = async () => {
        if (saving) return; // Prevent double click
        setSaving(true);
        try {
            const payload = Object.entries(attendance).map(([id, status]) => ({ teacher_id: parseInt(id), status }));
            await api.post('/teachers/attendance', { date, attendanceData: payload });
            toast.success('Attendance saved');
        } catch (e) { toast.error('Failed to save'); }
        finally { setSaving(false); }
    };

    const isEditable = true;

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-wrap justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-800 hidden md:block">Mark Teacher Attendance</h2>
                    <input
                        type="date"
                        className="input max-w-[150px] bg-slate-50 border-slate-200"
                        value={date}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={e => setDate(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    {isEditable && (
                        <>
                            <button className="flex-1 md:flex-none text-xs font-bold text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-xl hover:bg-emerald-100 transition-colors"
                                onClick={() => {
                                    const newAttendance = {};
                                    teachers.forEach(s => newAttendance[s.id] = 'Present');
                                    setAttendance(newAttendance);
                                }}
                                disabled={saving}
                            >Mark All Present</button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={`flex-1 md:flex-none bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                            >
                                <Check size={18} className={saving ? 'animate-pulse' : ''} />
                                <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save Attendance'}</span>
                                <span className="sm:hidden">{saving ? 'Saving...' : 'Save'}</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider border-b border-slate-100">
                            <tr><th className="p-4 pl-6">Teacher Details</th><th className="p-4">Attendance Status</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {teachers.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 pl-6">
                                        <div className="font-bold text-slate-700">{t.name}</div>
                                        <div className="text-xs text-slate-400 font-medium">{t.phone}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-2">
                                            {['Present', 'Absent', 'Late', 'Leave'].map(s => (
                                                <button key={s}
                                                    disabled={!isEditable}
                                                    onClick={() => setAttendance(p => ({ ...p, [t.id]: s }))}
                                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border shadow-sm ${attendance[t.id] === s
                                                        ? s === 'Present' ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20'
                                                            : s === 'Absent' ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/20'
                                                                : s === 'Late' ? 'bg-amber-500 text-white border-amber-600 shadow-amber-500/20'
                                                                    : 'bg-blue-500 text-white border-blue-600 shadow-blue-500/20'
                                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                                        } ${!isEditable ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {teachers.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="p-12 text-center text-slate-400">
                                        No teachers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TeacherAttendanceMarking;
