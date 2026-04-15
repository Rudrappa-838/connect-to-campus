import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { Capacitor } from '@capacitor/core';

const StudentAttendanceMarking = ({ config }) => {
    // Force date to always be TODAY
    const date = new Date().toISOString().split('T')[0];
    const [filterClass, setFilterClass] = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [students, setStudents] = useState([]);
    const [attendance, setAttendance] = useState({}); // { studentId: 'Present' | 'Absent' | 'Late' }
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isMobileApp, setIsMobileApp] = useState(false);

    useEffect(() => {
        setIsMobileApp(Capacitor.isNativePlatform() || localStorage.getItem('is_mobile_app') === 'true');
    }, []);

    // Sort classes numerically
    const sortedClasses = React.useMemo(() => {
        return [...(config?.classes || [])].sort((a, b) => {
            const numA = parseInt(a.class_name.replace(/\D/g, '') || '0', 10);
            const numB = parseInt(b.class_name.replace(/\D/g, '') || '0', 10);
            return numA === numB ? a.class_name.localeCompare(b.class_name) : numA - numB;
        });
    }, [config.classes]);

    const availableSections = sortedClasses.find(c => c.class_id === parseInt(filterClass))?.sections || [];

    // Auto-select section
    useEffect(() => {
        if (filterClass && availableSections.length > 0) {
            setFilterSection(availableSections[0].id);
        } else {
            setFilterSection('');
        }
    }, [filterClass]);

    // Auto-select Class if only one is available (e.g. Class Teacher)
    useEffect(() => {
        if (sortedClasses && sortedClasses.length === 1) {
            setFilterClass(sortedClasses[0].class_id);
        }
    }, [sortedClasses]);

    useEffect(() => {
        // If class is selected, we fetch data. 
        // We do NOT require section if the class has no sections (direct class assignment).
        if (filterClass && date) {
            fetchAttendanceData();
        }
    }, [filterClass, filterSection, date]);

    const activeClassName = sortedClasses.find(c => c.class_id === parseInt(filterClass))?.class_name || '';
    const activeSectionName = availableSections.find(s => s.id === parseInt(filterSection))?.name || '';

    const fetchAttendanceData = async () => {
        setLoading(true);
        try {
            const params = { date, class_id: filterClass };
            if (filterSection) params.section_id = filterSection;

            // Fetch students with their daily status directly using the daily attendance endpoint
            const res = await api.get('/students/attendance/daily', { params });
            const data = res.data;

            const statusMap = {};
            data.forEach(s => {
                // If status is 'Unmarked' (from COALESCE in backend), default to 'Present' for the UI
                // so the user can easily mark them or save as present.
                statusMap[s.id] = s.status === 'Unmarked' ? 'Present' : s.status;
            });

            setStudents(data);
            setAttendance(statusMap);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to load data');
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
            const attendanceData = Object.entries(attendance).map(([student_id, status]) => ({
                student_id: parseInt(student_id),
                status
            }));

            await api.post('/students/attendance', { date, attendanceData });
            toast.success('Attendance saved successfully');
        } catch (error) {
            toast.error('Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    const isEditable = date === new Date().toISOString().split('T')[0];

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border border-slate-200 shadow-sm animate-pulse">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 font-medium tracking-wide">Fetching student roster...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in pb-10">
            <div className={`flex flex-wrap items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 ${isMobileApp ? 'mx-0 rounded-none border-x-0' : ''}`}>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</span>
                    <input
                        type="date"
                        readOnly
                        className="input max-w-[150px] bg-slate-100/50 border-slate-200 text-slate-500 font-bold cursor-not-allowed opacity-80"
                        value={new Date().toISOString().split('T')[0]}
                    />
                </div>

                {/* CLASS SELECTION */}
                {sortedClasses.length === 1 ? (
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Class</span>
                        <div className="max-w-[200px] px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 font-bold text-sm shadow-sm">
                            {sortedClasses[0].class_name}
                        </div>
                    </div>
                ) : (
                    sortedClasses.length > 1 && (
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Class</span>
                            <select className="input min-w-[140px] bg-slate-50 border-slate-200" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                                <option value="">Select Class</option>
                                {sortedClasses?.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                    )
                )}

                {/* SECTION SELECTION */}
                {availableSections.length === 1 ? (
                    (availableSections[0].name && availableSections[0].name !== 'Class Teacher') ? (
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Section</span>
                            <div className="max-w-[200px] px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-700 font-bold text-sm shadow-sm">
                                {availableSections[0].name}
                            </div>
                        </div>
                    ) : null
                ) : (
                    availableSections.length > 0 && (
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Section</span>
                            <select
                                className="input min-w-[140px] bg-slate-50 border-slate-200"
                                value={filterSection}
                                onChange={e => setFilterSection(e.target.value)}
                            >
                                <option value="">Select Section</option>
                                {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    )
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {filterClass && (filterSection || availableSections.length === 0 || (availableSections.length === 1 && !availableSections[0].id)) ? (
                    <>
                    <div className="flex flex-col bg-white">
                        <div className={`p-4 border-b border-slate-100 flex justify-between items-center bg-white/95 backdrop-blur-sm z-30 shadow-sm ${isMobileApp ? 'sticky top-0' : ''}`}>
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-700 truncate">Student List</h3>
                                <p className="text-[10px] text-slate-500 font-medium truncate">{activeClassName} {availableSections.length > 1 && activeSectionName && activeSectionName !== 'Class Teacher' ? `- ${activeSectionName}` : ''}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {isEditable && (
                                    <>
                                        <button className="hidden sm:block text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                                            onClick={() => {
                                                const newAttendance = {};
                                                students.forEach(s => newAttendance[s.id] = 'Present');
                                                setAttendance(newAttendance);
                                            }}
                                        >Mark All Present</button>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className={`text-sm sm:text-xs font-bold text-white px-5 sm:px-4 py-2 sm:py-1.5 rounded-xl sm:rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-1 ${saving ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20'}`}
                                        >
                                            {saving ? (
                                                <>Saving...</>
                                            ) : (
                                                <>
                                                    <Check size={18} className="sm:w-3.5 sm:h-3.5" /> Save All
                                                </>
                                            )}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className={`overflow-x-auto ${!isMobileApp ? 'max-h-[65vh] overflow-y-auto custom-scrollbar border-t border-slate-100' : 'overflow-y-visible'}`}>
                            {!isMobileApp ? (
                                <table className="w-full text-left text-sm border-collapse table-fixed">
                                    <thead className="bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-20 shadow-sm">
                                        <tr>
                                            <th className="p-4 pl-6 w-24">Roll No</th>
                                            <th className="p-4 w-1/3">Student</th>
                                            <th className="p-4 text-center">Mark Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {students.map(student => (
                                            <tr key={student.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                                                <td className="p-4 pl-6 font-mono text-slate-500 font-medium">{student.roll_number || '-'}</td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-700 line-clamp-1">{student.name}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">{student.admission_no}</div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-center gap-1 md:gap-2">
                                                        {['Present', 'Absent', 'Late'].map(status => (
                                                            <button
                                                                key={status}
                                                                disabled={!isEditable}
                                                                onClick={() => handleMark(student.id, status)}
                                                                className={`flex-1 min-w-[65px] h-10 md:w-24 md:h-auto py-2 rounded-xl md:rounded-lg text-[10px] md:text-xs font-bold transition-all border shadow-sm ${attendance[student.id] === status
                                                                    ? status === 'Present' ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20 ring-2 ring-emerald-500/10'
                                                                        : status === 'Absent' ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/20 ring-2 ring-rose-500/10'
                                                                            : 'bg-amber-500 text-white border-amber-600 shadow-amber-500/20 ring-2 ring-amber-500/10'
                                                                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
                                                                    } ${!isEditable ? 'opacity-70 cursor-not-allowed' : 'active:scale-90 hover:scale-[1.02]'}`}
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
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {students.map(student => (
                                        <div key={student.id} className="p-4 bg-white active:bg-slate-50 transition-colors">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded leading-none border border-slate-200">
                                                            {student.roll_number || '-'}
                                                        </span>
                                                        <h4 className="font-bold text-slate-800 truncate text-sm">{student.name}</h4>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-mono">{student.admission_no}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['Present', 'Absent', 'Late'].map(status => (
                                                    <button
                                                        key={status}
                                                        disabled={!isEditable}
                                                        onClick={() => handleMark(student.id, status)}
                                                        className={`py-2.5 rounded-xl text-[10px] font-bold transition-all border shadow-sm flex flex-col items-center justify-center gap-0.5 ${attendance[student.id] === status
                                                            ? status === 'Present' ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/15 ring-2 ring-emerald-500/10'
                                                                : status === 'Absent' ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/15 ring-2 ring-rose-500/10'
                                                                    : 'bg-amber-500 text-white border-amber-600 shadow-amber-500/15 ring-2 ring-amber-500/10'
                                                            : 'bg-white text-slate-400 border-slate-200 active:bg-slate-100'
                                                            } ${!isEditable ? 'opacity-50' : 'active:scale-95'}`}
                                                    >
                                                        <span>{status}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {students.length === 0 && (
                                <div className="p-12 text-center text-slate-400">
                                    <p>No students found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                    <div className="p-20 text-center flex flex-col items-center justify-center text-slate-400">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <Check size={32} className="text-slate-300" />
                        </div>
                        <p className="text-lg font-medium text-slate-500">Select Class & Section</p>
                        <p className="text-sm">Please select a class and section to start marking attendance.</p>
                    </div>
                )}
            </div>
        </div >
    );
};

export default StudentAttendanceMarking;
