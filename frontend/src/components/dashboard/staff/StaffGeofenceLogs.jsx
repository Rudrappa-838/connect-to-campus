import React, { useState, useEffect } from 'react';
import { Calendar, User, MapPin, Clock, ArrowUpRight, ArrowDownLeft, Compass } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const formatWorkingHours = (decimalHours) => {
    if (decimalHours == null || isNaN(decimalHours) || decimalHours <= 0) {
        return '0 minutes';
    }
    const totalMinutes = Math.round(decimalHours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    if (hrs === 0) {
        return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
    }
    if (mins === 0) {
        return `${hrs} ${hrs === 1 ? 'hour' : 'hours'}`;
    }
    return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
};

const StaffGeofenceLogs = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [staffList, setStaffList] = useState([]);
    const [logs, setLogs] = useState([]);
    const [dailyAttendance, setDailyAttendance] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedStaffId, setExpandedStaffId] = useState(null);

    // Fetch all staff for filter dropdown
    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const res = await api.get('/staff');
                setStaffList(res.data || []);
            } catch (e) {
                console.error('Failed to fetch staff:', e);
            }
        };
        fetchStaff();
    }, []);

    // Fetch logs and daily attendance
    const fetchData = async () => {
        setLoading(true);
        try {
            const [logsRes, dailyRes] = await Promise.all([
                api.get('/staff/attendance/geofence-logs', {
                    params: { date, staffId: selectedStaffId || undefined }
                }),
                api.get('/staff/attendance/daily', {
                    params: { date }
                })
            ]);
            setLogs(logsRes.data || []);
            setDailyAttendance(dailyRes.data || []);
        } catch (e) {
            console.error('Failed to fetch data:', e);
            toast.error('Failed to load geofence logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [date, selectedStaffId]);

    // Group logs by staff member
    const staffSummaries = dailyAttendance.map(member => {
        const memberLogs = logs.filter(l => l.staff_id === member.id);
        
        // Calculate session count (number of check-ins)
        const checkInCount = memberLogs.filter(l => l.event_type === 'CHECK_IN').length;
        
        return {
            ...member,
            logs: memberLogs,
            checkInCount,
            totalLogs: memberLogs.length
        };
    }).filter(summary => {
        // If filter is active, only return the selected staff member
        if (selectedStaffId) {
            return summary.id === parseInt(selectedStaffId);
        }
        return true;
    });

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header Control Panel */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Staff Geofence Check-In/Out Audit Logs</h2>
                    <p className="text-xs text-slate-500 mt-1">Detailed real-time tracking of geofenced entries, exits, and cumulative shift hours.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    {/* Date Picker */}
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                        <Calendar size={18} className="text-slate-400" />
                        <input 
                            type="date" 
                            className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                        />
                    </div>

                    {/* Staff Dropdown Filter */}
                    <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                        <User size={18} className="text-slate-400" />
                        <select 
                            className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                            value={selectedStaffId}
                            onChange={e => setSelectedStaffId(e.target.value)}
                        >
                            <option value="">-- All Staff --</option>
                            {staffList.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400 animate-pulse">Loading geofenced logs and shift details...</div>
            ) : staffSummaries.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
                    No staff attendance records found for this date.
                </div>
            ) : (
                <div className="space-y-4">
                    {staffSummaries.map(summary => {
                        const isExpanded = expandedStaffId === summary.id;
                        
                        return (
                            <div 
                                key={summary.id} 
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-indigo-200 transition-all"
                            >
                                {/* Staff Main Overview Card */}
                                <div 
                                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition-colors"
                                    onClick={() => setExpandedStaffId(isExpanded ? null : summary.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700">
                                            {summary.name[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-slate-800">{summary.name}</h3>
                                            <p className="text-xs text-slate-400">Role: {summary.role} | Contact: {summary.phone || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-6 text-center md:text-left">
                                        <div className="px-3 border-r border-slate-200">
                                            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status</span>
                                            <span className={`inline-block mt-1 text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                                                summary.status === 'Present' 
                                                    ? 'bg-emerald-100 text-emerald-700' 
                                                    : summary.status === 'Absent' 
                                                    ? 'bg-rose-100 text-rose-700' 
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {summary.status}
                                            </span>
                                        </div>
                                        <div className="px-3 border-r border-slate-200">
                                            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Check-ins Count</span>
                                            <span className="block mt-1 text-sm font-black text-slate-700">{summary.checkInCount} sessions</span>
                                        </div>
                                        <div className="px-3">
                                            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Shift Hours</span>
                                            <span className="block mt-1 text-sm font-black text-indigo-600">
                                                {formatWorkingHours(summary.working_hours)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Dropdown Indicator */}
                                    <div className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                                        {isExpanded ? 'Hide Details' : 'View Timeline Logs'}
                                        <span className={`inline-block transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                                    </div>
                                </div>

                                {/* Expanded Timeline Logs */}
                                {isExpanded && (
                                    <div className="border-t border-slate-200 p-6 bg-white space-y-4 animate-in slide-in-from-top-2">
                                        <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Shift Logging Timeline</h4>
                                        
                                        {summary.logs.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">No individual geofence check-in/out logs recorded for this date.</p>
                                        ) : (
                                            <div className="relative border-l-2 border-slate-100 pl-6 ml-3 space-y-6">
                                                {summary.logs.map((log, idx) => {
                                                    const isCheckIn = log.event_type === 'CHECK_IN';
                                                    
                                                    return (
                                                        <div key={log.id} className="relative">
                                                            {/* Timeline dot icon */}
                                                            <span className={`absolute -left-[35px] top-0.5 rounded-full p-1.5 ${
                                                                isCheckIn 
                                                                    ? 'bg-emerald-100 text-emerald-600' 
                                                                    : 'bg-rose-100 text-rose-600'
                                                            }`}>
                                                                {isCheckIn ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                                                            </span>

                                                            {/* Log Info */}
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 hover:bg-slate-100/75 transition-colors p-4 rounded-xl border border-slate-100">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-extrabold text-sm text-slate-800">
                                                                            {isCheckIn ? 'Geofenced Check-In' : 'Geofenced Check-Out (Logout)'}
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                                                            Event #{idx + 1}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    {/* Location GPS link */}
                                                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                                                                        <MapPin size={12} className="text-slate-400" />
                                                                        <a 
                                                                            href={`https://www.google.com/maps/search/?api=1&query=${log.latitude},${log.longitude}`} 
                                                                            target="_blank" 
                                                                            rel="noreferrer"
                                                                            className="underline text-indigo-600 hover:text-indigo-800 font-mono font-medium"
                                                                            title="View on Google Maps"
                                                                        >
                                                                            {Number(log.latitude).toFixed(6)}, {Number(log.longitude).toFixed(6)}
                                                                        </a>
                                                                        <span className="text-slate-300">|</span>
                                                                        <Compass size={12} className="text-slate-400" />
                                                                        <span>Distance from school: <strong className="text-slate-700">{log.distance}m</strong></span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm w-fit">
                                                                    <Clock size={14} className="text-slate-400" />
                                                                    <span>{formatTime(log.timestamp)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default StaffGeofenceLogs;
