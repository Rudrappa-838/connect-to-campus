import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, AlertTriangle, RefreshCw, LogIn, LogOut, CheckCircle2, Navigation, Clock } from 'lucide-react';
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

const StaffMyAttendance = () => {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [report, setReport] = useState({});
    const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, total: 0 });
    const [loading, setLoading] = useState(false);
    const [startYear, setStartYear] = useState(new Date().getFullYear());
    const [events, setEvents] = useState([]);

    // GPS Geofenced Attendance States
    const [todayStatus, setTodayStatus] = useState(null);
    const [staffCoords, setStaffCoords] = useState({ latitude: null, longitude: null });
    const [distanceToSchool, setDistanceToSchool] = useState(null);
    const [locatingStaff, setLocatingStaff] = useState(false);
    const [gpsChecking, setGpsChecking] = useState(false);
    const [gpsError, setGpsError] = useState('');
    const [inRange, setInRange] = useState(false);

    // Haversine distance formula
    const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const d = R * c;
        return d;
    };

    const getStaffLocation = () => {
        if (!navigator.geolocation) {
            setGpsError('Geolocation is not supported by this browser.');
            return;
        }

        setLocatingStaff(true);
        setGpsError('');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                setStaffCoords({ latitude: lat, longitude: lng });
                setLocatingStaff(false);
            },
            (error) => {
                console.error('Error fetching location:', error);
                setLocatingStaff(false);
                setGpsError('Permission denied. Please grant location access to check-in.');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const fetchTodayStatus = async () => {
        try {
            const res = await api.get('/staff/attendance/today');
            setTodayStatus(res.data);
        } catch (error) {
            console.error('Failed to fetch today status', error);
        }
    };

    const handleCheckIn = async () => {
        if (!staffCoords.latitude || !staffCoords.longitude) {
            toast.error('Location coordinates not available. Please retry detecting location.');
            getStaffLocation();
            return;
        }

        setGpsChecking(true);
        try {
            const res = await api.post('/staff/attendance/check-in', {
                latitude: staffCoords.latitude,
                longitude: staffCoords.longitude
            });
            toast.success(res.data.message || 'Checked in successfully!');
            await fetchTodayStatus();
            await fetchHistory();
        } catch (error) {
            console.error('Check-in failed:', error);
            toast.error(error.response?.data?.message || 'Check-in failed. Please try again.');
        } finally {
            setGpsChecking(false);
        }
    };

    const handleCheckOut = async () => {
        if (!staffCoords.latitude || !staffCoords.longitude) {
            toast.error('Location coordinates not available. Please retry detecting location.');
            getStaffLocation();
            return;
        }

        if (!window.confirm('Are you sure you want to Check Out? This completes your working hours count for today.')) {
            return;
        }

        setGpsChecking(true);
        try {
            const res = await api.post('/staff/attendance/check-out', {
                latitude: staffCoords.latitude,
                longitude: staffCoords.longitude
            });
            toast.success(res.data.message || 'Checked out successfully!');
            await fetchTodayStatus();
            await fetchHistory();
        } catch (error) {
            console.error('Check-out failed:', error);
            toast.error(error.response?.data?.message || 'Check-out failed. Please try again.');
        } finally {
            setGpsChecking(false);
        }
    };

    useEffect(() => {
        const fetchSchoolStartYear = async () => {
            try {
                const res = await api.get('/schools/my-school');
                if (res.data.created_at) {
                    setStartYear(new Date(res.data.created_at).getFullYear());
                }
            } catch (error) {
                console.error("Failed to fetch school info", error);
            }
        };
        fetchSchoolStartYear();
        fetchEvents();
        fetchTodayStatus();
    }, []);

    // Run location check and status sync on a periodic interval (every 20 seconds)
    useEffect(() => {
        fetchTodayStatus();
        getStaffLocation();

        const intervalId = setInterval(() => {
            fetchTodayStatus();
            getStaffLocation();
        }, 20000);

        return () => clearInterval(intervalId);
    }, []);

    // Calculate distance and in-range whenever coordinates or school config updates
    useEffect(() => {
        if (staffCoords.latitude && staffCoords.longitude && todayStatus?.schoolConfig?.latitude && todayStatus?.schoolConfig?.longitude) {
            const dist = getDistanceMeters(
                staffCoords.latitude,
                staffCoords.longitude,
                todayStatus.schoolConfig.latitude,
                todayStatus.schoolConfig.longitude
            );
            setDistanceToSchool(dist);
            setInRange(dist <= (todayStatus.schoolConfig.radius || 200));
        }
    }, [staffCoords, todayStatus?.schoolConfig?.latitude, todayStatus?.schoolConfig?.longitude, todayStatus?.schoolConfig?.radius]);

    // Automatic Geofence Check-In / Check-Out Loop
    useEffect(() => {
        if (!todayStatus || !staffCoords.latitude || !staffCoords.longitude || gpsChecking) {
            return;
        }

        const runGeofenceCheck = async () => {
            // Case 1: Auto Check-Out (Out of Range & Currently Checked In)
            if (!inRange && todayStatus.currentlyCheckedIn) {
                console.log("Automatic Check-out triggered via Geofence (Left School Zone)!");
                setGpsChecking(true);
                const toastId = toast.loading("Leaving school zone! Auto checking out...", { id: "geofence-action" });
                try {
                    const res = await api.post('/staff/attendance/check-out', {
                        latitude: staffCoords.latitude,
                        longitude: staffCoords.longitude
                    });
                    toast.success(res.data.message || 'Auto Checked Out successfully!', { id: toastId });
                    await fetchTodayStatus();
                    await fetchHistory();
                } catch (error) {
                    console.error('Auto Check-out failed:', error);
                    toast.error(error.response?.data?.message || 'Auto Check-out failed.', { id: toastId });
                } finally {
                    setGpsChecking(false);
                }
            }

            // Case 2: Auto Check-In (In Range & Has Checked In Today & Currently Checked Out)
            else if (inRange && todayStatus.hasCheckedInToday && todayStatus.currentlyCheckedOut) {
                console.log("Automatic Check-in triggered via Geofence (Re-entered School Zone)!");
                setGpsChecking(true);
                const toastId = toast.loading("Welcome back! Auto checking in...", { id: "geofence-action" });
                try {
                    const res = await api.post('/staff/attendance/check-in', {
                        latitude: staffCoords.latitude,
                        longitude: staffCoords.longitude
                    });
                    toast.success(res.data.message || 'Auto Checked In successfully!', { id: toastId });
                    await fetchTodayStatus();
                    await fetchHistory();
                } catch (error) {
                    console.error('Auto Check-in failed:', error);
                    toast.error(error.response?.data?.message || 'Auto Check-in failed.', { id: toastId });
                } finally {
                    setGpsChecking(false);
                }
            }
        };

        runGeofenceCheck();
    }, [
        inRange,
        todayStatus?.hasCheckedInToday,
        todayStatus?.currentlyCheckedIn,
        todayStatus?.currentlyCheckedOut,
        staffCoords.latitude,
        staffCoords.longitude,
        gpsChecking
    ]);

    const fetchEvents = async () => {
        try {
            const res = await api.get('/calendar/events');
            setEvents(res.data);
        } catch (error) {
            console.error('Failed to load events');
        }
    };

    // Generate dates for the selected month
    const daysInMonth = new Date(year, month, 0).getDate();
    const dates = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    useEffect(() => {
        fetchHistory();
    }, [month, year]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await api.get('/staff/attendance/my', {
                params: { month, year }
            });
            const data = res.data || [];

            // Process array into object loop
            const rpt = {};
            let p = 0, a = 0, l = 0, t = 0;

            data.forEach(record => {
                if (record.date) {
                    const dateKey = record.date.split('T')[0]; // YYYY-MM-DD
                    rpt[dateKey] = record.status;

                    const s = record.status.toLowerCase();
                    if (s === 'present') p++;
                    else if (s === 'absent') a++;
                    else if (s === 'late') l++;
                    else if (s === 'leave') a++;

                    if (s !== 'holiday' && s !== 'sunday') t++;
                }
            });

            setReport(rpt);
            setStats({ present: p, absent: a, late: l, total: t });

        } catch (error) {
            console.error('Failed to load attendance history', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* GPS Geofenced Attendance Panel */}
            {todayStatus?.schoolConfig?.latitude && todayStatus?.schoolConfig?.longitude ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full blur-2xl opacity-50 -mr-5 -mt-5"></div>
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        {/* Status Left */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                    <MapPin size={22} className={locatingStaff ? "animate-pulse" : ""} />
                                </span>
                                <div>
                                    <h3 className="font-extrabold text-slate-800 text-base">GPS Geofenced Attendance</h3>
                                    <p className="text-xs text-slate-400">School Zone: {todayStatus.schoolConfig.name}</p>
                                </div>
                            </div>

                            {/* Distance & Range Display */}
                            {gpsError ? (
                                <div className="flex items-center gap-1.5 text-rose-500 text-xs font-semibold bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
                                    <AlertTriangle size={14} />
                                    {gpsError}
                                </div>
                            ) : locatingStaff ? (
                                <div className="text-xs text-slate-400 flex items-center gap-1.5 animate-pulse">
                                    <Navigation size={14} className="animate-spin text-indigo-500" />
                                    Detecting your exact GPS location...
                                </div>
                            ) : distanceToSchool !== null ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                                        inRange 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                            : 'bg-amber-50 text-amber-700 border-amber-100'
                                    }`}>
                                        <CheckCircle2 size={14} />
                                        {inRange ? 'In Range' : 'Out of School Zone'}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500">
                                        Distance: {distanceToSchool < 1000 
                                            ? `${Math.round(distanceToSchool)}m` 
                                            : `${(distanceToSchool/1000).toFixed(2)}km`} (Allowed: {todayStatus.schoolConfig.radius}m)
                                    </span>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400">Click detect location to find your range.</div>
                            )}
                        </div>

                        {/* Middle: Shift status */}
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center min-w-[200px] text-center">
                            {todayStatus.currentlyCheckedIn ? (
                                <>
                                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-600 tracking-wider">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                                        Shift Active
                                    </div>
                                    <span className="text-xs font-bold text-slate-500 mt-1">
                                        Checked in: {new Date(todayStatus.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="text-xl font-black text-slate-700 mt-2">{formatWorkingHours(todayStatus.workingHours)} accum.</span>
                                </>
                            ) : todayStatus.hasCheckedInToday ? (
                                <>
                                    <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Currently Away</span>
                                    <span className="text-xl font-black text-slate-700 mt-1">{formatWorkingHours(todayStatus.workingHours)}</span>
                                    <span className="text-[10px] text-slate-400 mt-1">
                                        Last Check-out: {new Date(todayStatus.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Today's Shift</span>
                                    <span className="text-sm font-extrabold text-slate-500 mt-1">Not Checked In</span>
                                    <span className="text-[10px] text-slate-400 mt-2">Please check in when inside school zone.</span>
                                </>
                            )}
                        </div>

                        {/* Action buttons Right */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={getStaffLocation}
                                disabled={locatingStaff || gpsChecking}
                                className="p-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-all shadow-sm disabled:opacity-50"
                                title="Recalculate distance"
                            >
                                <RefreshCw size={18} className={locatingStaff ? "animate-spin" : ""} />
                            </button>

                            {todayStatus.currentlyCheckedIn ? (
                                <div className="flex flex-col items-center gap-1">
                                    <button
                                        onClick={handleCheckOut}
                                        disabled={!inRange || gpsChecking}
                                        className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-md transition-all active:scale-95 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <LogOut size={16} /> Check Out
                                    </button>
                                    {!inRange && (
                                        <span className="text-[10px] text-rose-500 font-bold max-w-[150px] text-center animate-pulse">
                                            Out of Range: Check-Out Locked 🔒
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={handleCheckIn}
                                    disabled={!inRange || gpsChecking}
                                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition-all active:scale-95 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <LogIn size={16} /> Check In
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5 text-amber-800 text-sm flex items-center gap-3">
                    <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                        <MapPin size={20} />
                    </span>
                    <div>
                        <p className="font-bold">GPS Attendance Not Configured</p>
                        <p className="text-xs text-amber-700/80 mt-0.5">
                            School GPS coordinates have not been set by the administrator. Contact your administrator to enable geofenced attendance.
                        </p>
                    </div>
                </div>
            )}

            {/* Header Controls */}
            <div className="flex flex-wrap items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                    <Calendar size={18} className="text-slate-400" />
                    <select className="bg-transparent text-sm outline-none font-bold text-slate-700 cursor-pointer" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                        {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                    </select>
                    <div className="w-px h-4 bg-slate-300 mx-2"></div>
                    <select className="bg-transparent text-sm outline-none font-bold text-slate-700 cursor-pointer" value={year} onChange={e => setYear(parseInt(e.target.value))}>
                        {Array.from({ length: new Date().getFullYear() - startYear + 1 }, (_, i) => new Date().getFullYear() - i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                {loading && <span className="text-xs text-slate-400 font-medium animate-pulse">Updating...</span>}
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Total Present</div>
                    <div className="text-3xl font-black text-slate-700">{stats.present + stats.late}</div>
                </div>
                <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 flex flex-col justify-between">
                    <div className="text-emerald-600 text-[10px] font-bold uppercase tracking-widest mb-2">Present</div>
                    <div className="text-3xl font-black text-emerald-700">{stats.present}</div>
                </div>
                <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 flex flex-col justify-between">
                    <div className="text-rose-600 text-[10px] font-bold uppercase tracking-widest mb-2">Absent</div>
                    <div className="text-3xl font-black text-rose-700">{stats.absent}</div>
                </div>
                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 flex flex-col justify-between">
                    <div className="text-amber-600 text-[10px] font-bold uppercase tracking-widest mb-2">Late</div>
                    <div className="text-3xl font-black text-amber-700">{stats.late}</div>
                </div>
            </div>

            {/* Calendar View */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-700 mb-4">Daily Attendance Log</h3>
                <div className="grid grid-cols-7 gap-2 md:gap-4">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase py-2">{d}</div>
                    ))}

                    {/* Padding for start of month */}
                    {Array.from({ length: new Date(year, month - 1, 1).getDay() }).map((_, i) => (
                        <div key={`pad-${i}`} className="aspect-square"></div>
                    ))}

                    {dates.map(date => {
                        const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
                        const status = report[dateKey];

                        let bg = 'bg-slate-50';
                        let label = '';
                        let border = 'border-slate-100';

                        // Check for Sunday
                        const isSunday = new Date(year, month - 1, date).getDay() === 0;

                        if (isSunday) {
                            bg = 'bg-rose-100 text-rose-700 border-rose-200';
                            label = 'S';
                        }

                        if (status) {
                            border = 'border shadow-sm';
                            const s = status.toLowerCase();
                            if (s === 'present') {
                                bg = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                                label = 'P';
                            } else if (s === 'absent') {
                                bg = 'bg-rose-100 text-rose-700 border-rose-200';
                                label = 'A';
                            } else if (s === 'late') {
                                bg = 'bg-amber-100 text-amber-700 border-amber-200';
                                label = 'L';
                            } else if (s === 'leave') {
                                bg = 'bg-amber-50 text-amber-600 border-amber-200';
                                label = 'LV';
                            } else if (s === 'holiday') {
                                if (!isSunday) {
                                    bg = 'bg-purple-100 text-purple-700 border-purple-200';
                                    label = 'H';
                                }
                            } else if (s === 'sunday') {
                                bg = 'bg-rose-100 text-rose-700 border-rose-200';
                                label = 'S';
                            } else {
                                if (!isSunday) {
                                    if (s === 'unmarked') {
                                        bg = 'bg-gray-50 text-gray-400';
                                        label = '';
                                    } else {
                                        bg = 'bg-gray-50 text-gray-500';
                                        label = '';
                                    }
                                }
                            }
                        } else if (isSunday) {
                            bg = 'bg-rose-100 text-rose-700 border-rose-200';
                            label = 'S';
                        }

                        // Check if there is an event for this date to show its name
                        const eventForDay = events.find(e => {
                            const d = new Date(e.start_date);
                            return d.getDate() === date && d.getMonth() === month - 1 && d.getFullYear() === year && e.title.toLowerCase() !== 'sunday';
                        });

                        if (eventForDay) {
                            if (!bg || bg.includes('gray-50')) {
                                bg = 'bg-purple-100 text-purple-700 border-purple-200';
                            }
                            label = eventForDay.title;
                        }

                        return (
                            <div key={date} className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${bg} ${border} p-1`}>
                                <span className="text-sm font-bold">{date}</span>
                                {label && (
                                    <span className={`text-[9px] font-black uppercase text-center leading-tight line-clamp-2 ${label.length > 5 ? 'text-[8px]' : ''}`}>
                                        {label}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Events / Holidays List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <span className="w-1 h-5 bg-rose-500 rounded-full"></span>
                    Holidays & Events
                </h3>
                <div className="space-y-3">
                    {(() => {
                        const monthEvents = events.filter(e => {
                            const d = new Date(e.start_date);
                            if (e.title.toLowerCase() === 'sunday') return false;
                            return d.getMonth() === month - 1 && d.getFullYear() === year;
                        }).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

                        if (monthEvents.length === 0) {
                            return <div className="text-slate-400 text-sm text-center py-4">No events or holidays for this month.</div>;
                        }

                        return monthEvents.map(event => (
                            <div key={event.id} className="flex items-start gap-4 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                                <div className="text-center bg-rose-50 rounded-lg p-2 min-w-[50px] border border-rose-100">
                                    <span className="block text-[10px] font-bold text-rose-400 uppercase">
                                        {new Date(event.start_date).toLocaleString('default', { month: 'short' })}
                                    </span>
                                    <span className="block text-lg font-black text-rose-600">
                                        {new Date(event.start_date).getDate()}
                                    </span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{event.title}</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">{event.event_type} {event.description ? `- ${event.description}` : ''}</p>
                                </div>
                            </div>
                        ));
                    })()}
                </div>
            </div>
        </div>
    );
};

export default StaffMyAttendance;
