import React, { useState, useEffect } from 'react';
import { Check, X, Printer, Camera, Edit2 } from 'lucide-react';
import api from '../../../api/axios';

const DailyAttendanceStatus = ({ config }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterClass, setFilterClass] = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [attendanceData, setAttendanceData] = useState([]);
    const [loading, setLoading] = useState(false);

    const availableSections = config?.classes?.find(c => c.class_id === parseInt(filterClass))?.sections || [];

    // Auto-select first section when class changes
    useEffect(() => {
        if (filterClass && availableSections.length > 0) {
            setFilterSection(availableSections[0].id);
        } else {
            setFilterSection('');
        }
    }, [filterClass]);

    useEffect(() => {
        const hasSections = availableSections.length > 0;
        if (date && filterClass && (filterSection || !hasSections)) {
            fetchDailyAttendance();
        } else {
            setAttendanceData([]);
        }
    }, [date, filterClass, filterSection]);

    const fetchDailyAttendance = async () => {
        setLoading(true);
        try {
            const params = { date, class_id: filterClass };
            if (filterSection) params.section_id = filterSection;

            const res = await api.get('/students/attendance/daily', { params });
            setAttendanceData(res.data);
        } catch (error) {
            console.error('Failed to load daily attendance');
        } finally {
            setLoading(false);
        }
    };

    // Calculate Counts
    const stats = {
        total: attendanceData.length,
        present: attendanceData.filter(s => s.status === 'Present').length,
        absent: attendanceData.filter(s => s.status === 'Absent').length,
        late: attendanceData.filter(s => s.status === 'Late').length,
        unmarked: attendanceData.filter(s => s.status === 'Unmarked').length
    };

    const presentStudents = attendanceData.filter(s => s.status === 'Present');
    const absentStudents = attendanceData.filter(s => s.status === 'Absent');
    const otherStudents = attendanceData.filter(s => s.status === 'Late' || s.status === 'Unmarked');

    const handlePrint = () => {
        const className = config?.classes?.find(c => c.class_id === parseInt(filterClass))?.class_name || 'All Classes';
        const sectionName = availableSections?.find(s => s.id === parseInt(filterSection))?.name || 'All Sections';

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Daily Attendance Report - ${date}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .header { text-align: center; margin-bottom: 20px; }
                    h1 { margin: 0; color: #333; }
                    .meta { color: #666; font-size: 14px; margin-top: 5px; }
                    .stats { display: flex; justify-content: space-between; margin-bottom: 20px; border: 1px solid #ddd; padding: 10px; border-radius: 5px; }
                    .stat-item { text-align: center; }
                    .stat-label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: bold; }
                    .stat-val { font-size: 18px; font-weight: bold; color: #333; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                    th { background-color: #f3f4f6; }
                    .status-present { color: green; font-weight: bold; }
                    .status-absent { color: red; font-weight: bold; }
                    .status-late { color: orange; font-weight: bold; }
                    @media print {
                        body { padding: 0; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Daily Attendance Status</h1>
                    <div class="meta">
                        Date: ${new Date(date).toLocaleDateString('en-GB')} | Class: ${className} - ${sectionName}
                    </div>
                </div>

                <div class="stats">
                    <div class="stat-item">
                        <div class="stat-title">Total</div>
                        <div class="stat-val">${stats.total}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-title" style="color: green;">Present</div>
                        <div class="stat-val" style="color: green;">${stats.present}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-title" style="color: red;">Absent</div>
                        <div class="stat-val" style="color: red;">${stats.absent}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-title" style="color: orange;">Other</div>
                        <div class="stat-val" style="color: orange;">${stats.late + stats.unmarked}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">Roll</th>
                            <th>Student Name</th>
                            <th>Status</th>
                            <th>Parent Contact</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${attendanceData.sort((a, b) => parseInt(a.roll_number || 0) - parseInt(b.roll_number || 0)).map(student => `
                            <tr>
                                <td>${student.roll_number || '-'}</td>
                                <td>${student.name}</td>
                                <td class="status-${student.status?.toLowerCase()}">${student.status}</td>
                                <td>${student.status === 'Absent' ? (student.contact_number || '-') : ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(printContent);
        win.document.close();
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-wrap items-center gap-4">
                    <input type="date" className="input max-w-[150px] bg-slate-50 border-slate-200" value={date} onChange={e => setDate(e.target.value)} />
                    <select className="input max-w-[200px] bg-slate-50 border-slate-200" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                        <option value="">Select Class</option>
                        {config?.classes
                            ?.slice()
                            .sort((a, b) => a.class_name.localeCompare(b.class_name, undefined, { numeric: true }))
                            .map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                    </select>
                    {availableSections.length > 0 && (
                        <select
                            className="input max-w-[200px] disabled:bg-slate-100 disabled:text-slate-400 bg-slate-50 border-slate-200"
                            value={filterSection}
                            onChange={e => setFilterSection(e.target.value)}
                            disabled={availableSections.length === 0}
                        >
                            <option value="">Select Section</option>
                            {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                </div>
                <button
                    onClick={handlePrint}
                    disabled={!filterClass || !filterSection}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Printer size={18} />
                    <span>Print Report</span>
                </button>
            </div>

            {filterClass && (filterSection || availableSections.length === 0) ? (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between group hover:shadow-md transition-all">
                            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Total Students</div>
                            <div className="text-3xl font-black text-slate-700">{stats.total}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute right-0 top-0 p-3 opacity-10">
                                <Check size={48} className="text-emerald-600" />
                            </div>
                            <div className="text-emerald-600 text-[10px] font-bold uppercase tracking-widest mb-2">Present</div>
                            <div className="text-3xl font-black text-emerald-600">{stats.present}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute right-0 top-0 p-3 opacity-10">
                                <X size={48} className="text-rose-600" />
                            </div>
                            <div className="text-rose-600 text-[10px] font-bold uppercase tracking-widest mb-2">Absent</div>
                            <div className="text-3xl font-black text-rose-600">{stats.absent}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="text-amber-600 text-[10px] font-bold uppercase tracking-widest mb-2">Late / Unmarked</div>
                            <div className="text-3xl font-black text-amber-600">{stats.late + stats.unmarked}</div>
                        </div>
                    </div>

                    {/* Lists Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Present Column */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
                            <div className="p-4 border-b border-slate-100 bg-emerald-50/50 flex justify-between items-center backdrop-blur-sm sticky top-0 z-10">
                                <h3 className="text-sm font-bold text-emerald-800 uppercase flex items-center gap-2">
                                    <div className="p-1 bg-emerald-100/50 rounded-md"><Check className="w-3.5 h-3.5" /></div>
                                    Present Students
                                </h3>
                                <span className="bg-white text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-100 shadow-sm">{stats.present}</span>
                            </div>
                            <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
                                {presentStudents.length > 0 ? (
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs border-b border-slate-100 sticky top-0">
                                            <tr>
                                                <th className="px-5 py-3 w-24">Roll No</th>
                                                <th className="px-5 py-3">Student Name</th>
                                                <th className="px-5 py-3 text-right">Parent Contact</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {presentStudents.map(s => (
                                                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-5 py-3 font-mono text-slate-400 font-medium text-xs">#{s.roll_number || 'N/A'}</td>
                                                    <td className="px-5 py-3 font-medium text-slate-700">{s.name}</td>
                                                    <td className="px-5 py-3 text-right flex items-center justify-end gap-3">
                                                        <span className="text-slate-400 text-xs font-mono">{s.contact_number || '-'}</span>
                                                        {s.marking_mode === 'face' && (
                                                            <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md" title="Marked via Face Scanner">
                                                                <Camera size={10} />
                                                            </div>
                                                        )}
                                                        {s.marking_mode === 'manual' && (
                                                            <div className="p-1 bg-amber-50 text-amber-600 rounded-md" title="Marked Manually">
                                                                <Edit2 size={10} />
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <p className="text-sm">No students present</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Absent Column */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
                            <div className="p-4 border-b border-slate-100 bg-rose-50/50 flex justify-between items-center backdrop-blur-sm sticky top-0 z-10">
                                <h3 className="text-sm font-bold text-rose-800 uppercase flex items-center gap-2">
                                    <div className="p-1 bg-rose-100/50 rounded-md"><X className="w-3.5 h-3.5" /></div>
                                    Absent Students
                                </h3>
                                <span className="bg-white text-rose-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-rose-100 shadow-sm">{stats.absent}</span>
                            </div>
                            <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
                                {absentStudents.length > 0 ? (
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs border-b border-slate-100 sticky top-0">
                                            <tr>
                                                <th className="px-5 py-3 w-24">Roll No</th>
                                                <th className="px-5 py-3">Student Name</th>
                                                <th className="px-5 py-3 text-right">Parent Contact</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {absentStudents.map(s => (
                                                <tr key={s.id} className="hover:bg-rose-50/30 transition-colors">
                                                    <td className="px-5 py-3 font-mono text-slate-400 font-medium text-xs">#{s.roll_number || 'N/A'}</td>
                                                    <td className="px-5 py-3 font-medium text-slate-700">{s.name}</td>
                                                    <td className="px-5 py-3 text-right flex items-center justify-end gap-3">
                                                        <span className="text-slate-400 text-xs font-mono">{s.contact_number || '-'}</span>
                                                        {s.marking_mode === 'manual' && (
                                                            <div className="p-1 bg-rose-50 text-rose-600 rounded-md" title="Marked Manually">
                                                                <Edit2 size={10} />
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <p className="text-sm">No students absent</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Other/Unmarked */}
                    {otherStudents.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
                            <div className="p-4 border-b border-slate-100 bg-amber-50/50 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-amber-800 uppercase">Late / Unmarked</h3>
                                <span className="bg-white text-amber-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-100 shadow-sm">{stats.late + stats.unmarked}</span>
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {otherStudents.map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-xs text-slate-400 bg-white px-1.5 py-0.5 border border-slate-200 rounded-md">#{s.roll_number || 'N/A'}</span>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700">{s.name}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{s.contact_number || '-'}</span>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${s.status === 'Late' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                                            {s.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="p-20 text-center flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <Check size={32} className="text-slate-300" />
                    </div>
                    <p className="text-lg font-medium text-slate-500">Select Class & Section</p>
                    <p className="text-sm">Please select a class and section to view daily attendance status.</p>
                </div>
            )}
        </div>
    );
};

export default DailyAttendanceStatus;
