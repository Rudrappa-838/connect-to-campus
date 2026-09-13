import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
    LayoutDashboard, CheckSquare, Bus, Calendar,
    FileText, LogOut, Bell, Briefcase, Navigation, Radio, MapPin, Menu, X, ChevronDown, ChevronRight, Clock
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import LogoutConfirmationModal from '../components/LogoutConfirmationModal';
import SchoolCalendar from '../components/dashboard/calendar/SchoolCalendar';
import ViewAnnouncements from '../components/dashboard/calendar/ViewAnnouncements';
import RecentAnnouncements from '../components/dashboard/calendar/RecentAnnouncements';
import StudentAttendanceMarking from '../components/dashboard/students/StudentAttendanceMarking';
import DailyAttendanceStatus from '../components/dashboard/students/DailyAttendanceStatus';
import StudentAttendanceReports from '../components/dashboard/students/StudentAttendanceReports';
import StaffMyAttendance from '../components/dashboard/staff/StaffMyAttendance';
import TeacherTransportMap from '../components/dashboard/teachers/TeacherTransportMap';
import StaffSalarySlips from '../components/dashboard/staff/StaffSalarySlips';
import StaffLeaveApplication from '../components/dashboard/staff/StaffLeaveApplication';
import AdminLiveMap from '../components/dashboard/admin/AdminLiveMap';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { MobileHeader, MobileFooter } from '../components/layout/MobileAppFiles';
import { BookOpen, Home as HomeIcon } from 'lucide-react';
import LibraryOverview from '../components/dashboard/library/LibraryOverview';
import BookManagement from '../components/dashboard/library/BookManagement';
import IssueReturn from '../components/dashboard/library/IssueReturn';
import HostelOverview from '../components/dashboard/hostel/HostelOverview';
import RoomManagement from '../components/dashboard/hostel/RoomManagement';
import RoomAllocation from '../components/dashboard/hostel/RoomAllocation';
import HostelFinance from '../components/dashboard/hostel/HostelFinance';
import FaceEnrollment from '../components/dashboard/biometric/FaceEnrollment';
import FaceAttendanceScanner from '../components/dashboard/biometric/FaceAttendanceScanner';
import { Users } from 'lucide-react';
import OutPassManager from '../components/dashboard/common/OutPassManager';
import DriverTracking from '../components/dashboard/transport/DriverTracking';

const StaffDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [isMobileApp, setIsMobileApp] = useState(false);
    const [expandedSections, setExpandedSections] = useState({ library: false, hostel: false });
    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Detect Mobile App context
    useEffect(() => {
        const checkMobile = () => {
            if (Capacitor.isNativePlatform()) {
                setIsMobileApp(true);
                return;
            }
            const params = new URLSearchParams(window.location.search);
            const isAppStr = params.get('is_mobile_app') === 'true';
            if (isAppStr || localStorage.getItem('is_mobile_app') === 'true') {
                setIsMobileApp(true);
                if (isAppStr) localStorage.setItem('is_mobile_app', 'true');
            }
        };
        checkMobile();
    }, []);

    const [schoolConfig, setSchoolConfig] = useState(null);
    const [schoolName, setSchoolName] = useState('');
    const [schoolLogo, setSchoolLogo] = useState(null);
    const [staffProfile, setStaffProfile] = useState(null);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setIsMobileMenuOpen(false);
    };

    // Driver Specific State
    const [profileLoading, setProfileLoading] = useState(true);
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [isTracking, setIsTracking] = useState(false);
    const [logs, setLogs] = useState([]);
    const [location, setLocation] = useState(null);
    const watchIdRef = useRef(null);
    const prevGpsRef = useRef(null); // { lat, lng, timestamp } of last SENT update
    const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);

    const isDriver = user?.role === 'DRIVER' ||
        staffProfile?.role?.toLowerCase().includes('driver') ||
        staffProfile?.role?.toLowerCase().includes('transport') ||
        staffProfile?.designation?.toLowerCase().includes('driver') ||
        staffProfile?.department?.toLowerCase().includes('transport') ||
        staffProfile?.vehicle_id ||
        staffProfile?.transport_route_id;

    useEffect(() => {
        const fetchSchoolInfo = async () => {
            try {
                const res = await api.get('/schools/my-school');
                setSchoolConfig(res.data);
                setSchoolName(res.data.name);
                setSchoolLogo(res.data.logo);
            } catch (error) {
                console.error("Failed to load school info", error);
            }
        };

        const fetchProfile = async () => {
            try {
                const res = await api.get('/staff/profile');
                setStaffProfile(res.data);
            } catch (error) {
                console.error("Failed to load profile", error);
            } finally {
                setProfileLoading(false);
            }
        };

        fetchSchoolInfo();
        fetchProfile();
    }, [user?.id, user?.role]);

    // Update vehicles when profile loads and identifies as driver
    useEffect(() => {
        if (isDriver) {
            fetchVehicles();
        }
    }, [isDriver]);

    const fetchVehicles = async () => {
        try {
            const res = await api.get('/transport/vehicles');
            setVehicles(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load vehicles');
        }
    };

    // Show the Google Play-required prominent disclosure before requesting background location
    const startTracking = async () => {
        if (!selectedVehicle) return toast.error('Please select a vehicle first');
        if (isMobileApp) {
            // Must show prominent disclosure BEFORE requesting background location permission
            setShowLocationDisclosure(true);
            return;
        }
        await beginTrackingAfterDisclosure();
    };

    // Called after user accepts the prominent disclosure dialog
    const handleDisclosureAccept = async () => {
        setShowLocationDisclosure(false);
        await beginTrackingAfterDisclosure();
    };

    const beginTrackingAfterDisclosure = async () => {
        try {
            if (isMobileApp) {
                const perm = await Geolocation.checkPermissions();
                if (perm.location !== 'granted') {
                    const req = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
                    if (req.location !== 'granted') {
                        return toast.error('Location permission denied. Please enable it in phone settings.');
                    }
                }
            } else if (!navigator.geolocation) {
                return toast.error('Geolocation is not supported by your browser');
            }

            setIsTracking(true);
            prevGpsRef.current = null; // Reset on new tracking session
            addLog('Tracking started...');

            const id = await Geolocation.watchPosition(
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                },
                async (position, err) => {
                    if (err) {
                        console.error('GPS Watch Error:', err);
                        addLog(`GPS Error: ${err.message}`);
                        return;
                    }
                    if (!position) return;

                    const { latitude, longitude, speed: rawSpeed, heading: rawHeading, accuracy } = position.coords;
                    const now = Date.now();

                    // Skip very inaccurate fixes (deep indoor / tunnel)
                    if (accuracy && accuracy > 100) {
                        addLog(`GPS skipped — accuracy: ${Math.round(accuracy)}m (too poor)`);
                        return;
                    }

                    // ── Minimum distance filter (5m) ──────────────────────────────
                    // Prevents GPS jitter from sending fake "movement" updates
                    const prev = prevGpsRef.current;
                    let distanceMeters = 0;
                    if (prev) {
                        // Haversine distance formula
                        const R = 6371000;
                        const dLat = (latitude - prev.lat) * Math.PI / 180;
                        const dLng = (longitude - prev.lng) * Math.PI / 180;
                        const a = Math.sin(dLat/2)**2 +
                                  Math.cos(prev.lat * Math.PI/180) * Math.cos(latitude * Math.PI/180) *
                                  Math.sin(dLng/2)**2;
                        distanceMeters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

                        if (distanceMeters < 5) {
                            // Less than 5m moved — GPS jitter, skip this update
                            return;
                        }
                    }

                    // ── Calculate speed from position delta ────────────────────────
                    // Capacitor speed is often null or 0 at low speeds — calculate it ourselves
                    let speedKmh = 0;
                    if (prev && distanceMeters > 0) {
                        const timeDeltaSec = (now - prev.timestamp) / 1000;
                        if (timeDeltaSec > 0) {
                            const calculatedMs = distanceMeters / timeDeltaSec; // m/s
                            speedKmh = calculatedMs * 3.6; // km/h
                        }
                    }
                    // Use device speed if it looks valid (> calculated and reasonable)
                    if (rawSpeed !== null && rawSpeed > 0) {
                        const deviceKmh = rawSpeed * 3.6;
                        // Prefer device speed if within reasonable range of calculated
                        if (speedKmh === 0 || Math.abs(deviceKmh - speedKmh) < 20) {
                            speedKmh = deviceKmh;
                        }
                    }
                    speedKmh = Math.min(Math.round(speedKmh * 10) / 10, 120); // Cap at 120 km/h

                    // ── Calculate heading from successive GPS points ───────────────
                    // Phone compass heading is unreliable at slow speed — compute from travel direction
                    let computedHeading = rawHeading || 0;
                    if (prev && distanceMeters > 3) {
                        const dLat2 = latitude - prev.lat;
                        const dLng2 = longitude - prev.lng;
                        const bearing = (Math.atan2(dLng2, dLat2) * 180 / Math.PI + 360) % 360;
                        computedHeading = bearing;
                    }

                    // ── Update state and send ──────────────────────────────────────
                    prevGpsRef.current = { lat: latitude, lng: longitude, timestamp: now };
                    setLocation({ lat: latitude, lng: longitude });
                    sendLocationUpdate(latitude, longitude, speedKmh, computedHeading, accuracy);
                }
            );
            watchIdRef.current = id;
        } catch (err) {
            console.error('Failed to start tracking', err);
            toast.error('Could not start GPS. Please check settings.');
        }
    };

    const stopTracking = async () => {
        if (watchIdRef.current !== null) {
            try {
                await Geolocation.clearWatch({ id: watchIdRef.current });
            } catch (err) {
                console.error('Clear watch failed', err);
            }
            watchIdRef.current = null;
        }
        prevGpsRef.current = null;
        setIsTracking(false);
        addLog('Tracking stopped.');
    };

    const sendLocationUpdate = async (lat, lng, speedKmh, heading, accuracy) => {
        try {
            await api.put(`/transport/vehicles/${selectedVehicle}/location`, {
                lat,
                lng,
                speed: speedKmh,     // Already in km/h
                speedUnit: 'kmh',    // Tell backend not to convert
                heading: heading || 0,
                accuracy: accuracy || null,
                status: 'Active',
            });
            addLog(`📍 ${lat.toFixed(5)}, ${lng.toFixed(5)} | 🚀 ${Math.round(speedKmh)} km/h | 🧭 ${Math.round(heading)}°`);
        } catch (error) {
            console.error(error);
            addLog('Failed to send update to server');
        }
    };

    const addLog = (msg) => setLogs(prev => [msg, ...prev].slice(0, 50));

    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleLogoutClick = () => {
        setShowLogoutModal(true);
    };

    const handleConfirmLogout = () => {
        if (isDriver) stopTracking();
        logout();
        navigate('/');
    };

    const getAllowedClasses = () => {
        if (!staffProfile || !schoolConfig?.classes) return [];
        // Parse manual attendance classes
        let manualClasses = [];
        try {
            let parsed = typeof staffProfile.manual_attendance_classes === 'string' 
                ? JSON.parse(staffProfile.manual_attendance_classes) 
                : staffProfile.manual_attendance_classes;
            manualClasses = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error(e);
            manualClasses = [];
        }

        if (manualClasses.includes('ALL')) {
            return schoolConfig.classes; // Give full access
        }

        const classAccess = {}; 

        manualClasses.forEach(item => {
            if (typeof item === 'number' || (typeof item === 'string' && !isNaN(item))) {
                classAccess[parseInt(item)] = 'ALL';
            } else if (item.startsWith('C_')) {
                classAccess[parseInt(item.replace('C_', ''))] = 'ALL';
            } else if (item.startsWith('S_')) {
                const secId = parseInt(item.replace('S_', ''));
                const schoolClass = schoolConfig.classes.find(c => c.sections && c.sections.find(s => s.id === secId));
                if (schoolClass) {
                    if (classAccess[schoolClass.class_id] !== 'ALL') {
                        if (!classAccess[schoolClass.class_id]) classAccess[schoolClass.class_id] = [];
                        classAccess[schoolClass.class_id].push(secId);
                    }
                }
            }
        });

        // Add additional manual classes and sections
        const allowed = [];
        Object.keys(classAccess).forEach(cIdStr => {
            const cId = parseInt(cIdStr);
            const schoolClass = schoolConfig.classes.find(c => c.class_id === cId);
            if (schoolClass) {
                if (classAccess[cId] === 'ALL') {
                    allowed.push(schoolClass);
                } else {
                    const filteredSections = schoolClass.sections?.filter(s => classAccess[cId].includes(s.id)) || [];
                    allowed.push({
                        ...schoolClass,
                        sections: filteredSections
                    });
                }
            }
        });

        return allowed;
    };

    const allowedClasses = getAllowedClasses();
    const hasAttendanceAccess = allowedClasses.length > 0;

    const attendanceConfig = {
        classes: hasAttendanceAccess ? allowedClasses : []
    };

    return (
        <div className="relative min-h-screen w-full flex font-sans text-slate-900 overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar - Blue Gradient Theme */}
            <aside className={`w-72 bg-gradient-to-b from-sky-500 to-blue-600 text-white flex flex-col shadow-2xl transition-transform duration-300 
                fixed inset-y-0 left-0 h-screen overflow-y-auto custom-scrollbar print:hidden
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
                ${isMobileApp ? 'z-[80]' : 'z-50'}
                md:translate-x-0 md:sticky md:top-0 md:flex`}>

                {/* Brand Area */}
                <div className="p-6 flex items-center justify-between border-b border-white/20 pt-10">
                    <div className="flex items-center gap-3">
                        {schoolLogo ? (
                            <div className="h-10 w-10 rounded-xl overflow-hidden bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-sm">
                                <img src={schoolLogo} alt="Logo" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="bg-white/20 p-2.5 rounded-xl shadow-[0_0_15px_rgba(255,255,255,0.2)] border border-white/30 backdrop-blur-sm">
                                <Briefcase className="text-white w-6 h-6" />
                            </div>
                        )}
                        <div className="w-full">
                            <h1 className="text-sm font-black text-white tracking-widest leading-none drop-shadow-md uppercase">Connect to Campus</h1>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100 mt-1 opacity-80">{schoolName || 'Software'}</p>
                        </div>
                    </div>
                    {/* Mobile Close Button */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden text-blue-100 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-1 flex-1 overflow-y-auto custom-scrollbar">
                    <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-2">Main</p>
                    <NavButton active={activeTab === 'overview'} onClick={() => handleTabChange('overview')} icon={LayoutDashboard} label="Dashboard" />

                    <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-6">Work</p>
                    <NavButton active={activeTab === 'attendance'} onClick={() => handleTabChange('attendance')} icon={Calendar} label="My Attendance" />

                    {hasAttendanceAccess && (
                        <>
                            <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-6">Student Academics</p>
                            <NavButton active={activeTab === 'student-attendance'} onClick={() => handleTabChange('student-attendance')} icon={CheckSquare} label="Mark Attendance" />
                            <NavButton active={activeTab === 'daily-status'} onClick={() => handleTabChange('daily-status')} icon={LayoutDashboard} label="Daily Status" />
                            <NavButton active={activeTab === 'attendance-reports'} onClick={() => handleTabChange('attendance-reports')} icon={FileText} label="Attendance Reports" />
                        </>
                    )}

                    {Boolean(staffProfile?.can_enroll_face || staffProfile?.can_take_face_attendance) && (
                        <div className="mt-6">
                            <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2">Biometrics</p>
                            {Boolean(staffProfile?.can_enroll_face) && (
                                <NavButton active={activeTab === 'face-enroll'} onClick={() => handleTabChange('face-enroll')} icon={Users} label="Face Enrollment" />
                            )}
                            {Boolean(staffProfile?.can_take_face_attendance) && (
                                <NavButton active={activeTab === 'face-scanner'} onClick={() => handleTabChange('face-scanner')} icon={CheckSquare} label="Face Scanner" />
                            )}
                        </div>
                    )}

                    {user?.libraryAccess && (
                        <div className="mt-6">
                            <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2">Library Admin</p>
                            <NavGroup label="Library Management" icon={BookOpen} expanded={expandedSections.library} onToggle={() => toggleSection('library')}>
                                <NavSubButton active={activeTab === 'library-overview'} onClick={() => handleTabChange('library-overview')} label="Library Overview" />
                                <NavSubButton active={activeTab === 'library-books'} onClick={() => handleTabChange('library-books')} label="Manage Books" />
                                <NavSubButton active={activeTab === 'library-issue'} onClick={() => handleTabChange('library-issue')} label="Issue & Return" />
                            </NavGroup>
                        </div>
                    )}

                    {user?.hostelAccess && (
                        <div className="mt-6">
                            <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2">Hostel Admin</p>
                            <NavGroup label="Hostel Management" icon={HomeIcon} expanded={expandedSections.hostel} onToggle={() => toggleSection('hostel')}>
                                <NavSubButton active={activeTab === 'hostel-overview'} onClick={() => handleTabChange('hostel-overview')} label="Hostel Overview" />
                                <NavSubButton active={activeTab === 'hostel-rooms'} onClick={() => handleTabChange('hostel-rooms')} label="Room Management" />
                                <NavSubButton active={activeTab === 'hostel-allocation'} onClick={() => handleTabChange('hostel-allocation')} label="Room Allocation" />
                                <NavSubButton active={activeTab === 'hostel-finance'} onClick={() => handleTabChange('hostel-finance')} label="Hostel Finances" />
                            </NavGroup>
                        </div>
                    )}

                    <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-6">Transport</p>
                    {isDriver && (
                        <NavButton active={activeTab === 'transport'} onClick={() => handleTabChange('transport')} icon={Bus} label="🚀 Let's Drive" />
                    )}
                    <NavButton active={activeTab === 'fleet-map'} onClick={() => handleTabChange('fleet-map')} icon={Navigation} label="Live Fleet Map" />

                    <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-6">Finance</p>
                    <NavButton active={activeTab === 'salary'} onClick={() => handleTabChange('salary')} icon={FileText} label="Salary Slips" />
                    <NavButton active={activeTab === 'leaves'} onClick={() => handleTabChange('leaves')} icon={Clock} label="Leave Applications" />
                    <NavButton active={activeTab === 'out-pass'} onClick={() => handleTabChange('out-pass')} icon={LogOut} label="Out Pass" />

                    <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-6">General</p>
                    <NavButton id="btn-announcements" active={activeTab === 'announcements'} onClick={() => handleTabChange('announcements')} icon={Bell} label="Notice Board" />
                    <NavButton active={activeTab === 'calendar'} onClick={() => handleTabChange('calendar')} icon={Calendar} label="School Calendar" />
                </nav>

                {/* Footer User Profile */}
                <div className="p-4 border-t border-white/20 bg-black/10">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors cursor-pointer group border border-white/10 hover:border-white/30">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-600 font-bold shadow-lg">
                            {user?.email?.[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{staffProfile?.name || user?.name}</p>
                            <p className="text-[10px] text-blue-100 uppercase font-medium tracking-tight">
                                {isDriver ? 'Driver' : (staffProfile?.role || 'Staff')} • {staffProfile?.employee_id || '--'}
                            </p>
                            <p className="text-[10px] text-blue-200 truncate">{schoolName}</p>
                        </div>
                        <button onClick={handleLogoutClick} className="text-blue-200 hover:text-white transition-colors">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area - LIGHT THEME */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#f1f5f9] relative z-10">
                {/* Mobile Header (App Mode Only) */}
                {isMobileApp && (
                    <MobileHeader
                        title={getTabTitle(activeTab, isDriver)}
                        schoolName={schoolName}
                        logo={schoolLogo}
                        onMenuClick={() => setIsMobileMenuOpen(true)}
                        onBack={activeTab !== 'overview' ? () => setActiveTab('overview') : null}
                    />
                )}

                {/* Header */}
                {!isMobileApp && (
                    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 min-h-[5rem] flex items-end justify-between px-6 sticky top-0 z-20 shadow-sm print:hidden safe-area-top pb-3">
                        <div className="flex items-center gap-4 py-2">
                            <button
                                className="text-slate-800 hover:text-indigo-600 bg-slate-100 p-2.5 rounded-xl md:hidden"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            >
                                <Menu size={22} />
                            </button>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    {getTabTitle(activeTab, isDriver)}
                                </h2>
                                <p className="text-xs text-slate-500 md:block hidden">Manage your work and profile</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 py-2">
                            <NotificationBell />
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold border border-orange-200">
                                {user?.name?.[0]}
                            </div>
                        </div>
                    </header>
                )}

                {/* Scrollable Content */}
                <div className={`flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar ${isMobileApp ? 'pt-[calc(4rem+var(--sat)+1rem)] pb-[calc(4rem+var(--sab)+1rem)]' : 'pt-[calc(var(--sat)+1rem)]'}`}>


                    <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
                        {activeTab === 'overview' && <StaffOverview isDriver={isDriver} schoolName={schoolName} profile={staffProfile} user={user} />}
                        {activeTab === 'attendance' && <StaffMyAttendance />}

                        {activeTab === 'student-attendance' && hasAttendanceAccess && <StudentAttendanceMarking config={attendanceConfig} />}
                        {activeTab === 'daily-status' && hasAttendanceAccess && <DailyAttendanceStatus config={attendanceConfig} />}
                        {activeTab === 'attendance-reports' && hasAttendanceAccess && <StudentAttendanceReports config={attendanceConfig} />}

                        {activeTab === 'face-enroll' && <FaceEnrollment config={{ classes: [] }} preferredFacingMode="environment" />}
                        {activeTab === 'face-scanner' && <FaceAttendanceScanner config={{ classes: [] }} preferredFacingMode="user" />}

                        {/* Driver Trip Tracker - Let's Drive (kept mounted so tab switching never destroys ongoing GPS trip) */}
                        {isDriver && (
                            <div style={{ display: activeTab === 'transport' ? 'block' : 'none' }}>
                                <DriverTracking />
                            </div>
                        )}
                        {activeTab === 'fleet-map' && <AdminLiveMap />}

                        {activeTab === 'salary' && <StaffSalarySlips />}
                        {activeTab === 'leaves' && <StaffLeaveApplication />}
                        {activeTab === 'out-pass' && <OutPassManager personType="STAFF" />}
                        {activeTab === 'announcements' && <ViewAnnouncements />}
                        {activeTab === 'calendar' && <SchoolCalendar />}
                        
                        {user?.libraryAccess && (
                            <>
                                {activeTab === 'library-overview' && <LibraryOverview />}
                                {activeTab === 'library-books' && <BookManagement />}
                                {activeTab === 'library-issue' && <IssueReturn />}
                            </>
                        )}
                        
                        {user?.hostelAccess && (
                            <>
                                {activeTab === 'hostel-overview' && <HostelOverview />}
                                {activeTab === 'hostel-rooms' && <RoomManagement />}
                                {activeTab === 'hostel-allocation' && <RoomAllocation />}
                                {activeTab === 'hostel-finance' && <HostelFinance />}
                            </>
                        )}
                    </div>
                </div>
            </main>

            {/* Mobile Tab Bar (App Mode Only) */}
            {isMobileApp && (
                <MobileFooter
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onMenuToggle={() => setIsMobileMenuOpen(true)}
                    tabs={[
                        { id: 'overview', label: 'Home', icon: LayoutDashboard },
                        { id: 'attendance', label: 'Attendance', icon: Calendar },
                        ...(user?.libraryAccess ? [{ id: 'library-issue', label: 'Library', icon: BookOpen }] : []),
                        ...(user?.hostelAccess ? [{ id: 'hostel-overview', label: 'Hostel', icon: HomeIcon }] : []),
                        ...(isDriver ? [{ id: 'transport', label: 'Trip', icon: Bus }] : (!(user?.libraryAccess || user?.hostelAccess) ? [{ id: 'salary', label: 'Salary', icon: FileText }] : [])),
                        { id: 'announcements', label: 'Notices', icon: Bell },
                    ]}
                />
            )}
            <LogoutConfirmationModal
                isOpen={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={handleConfirmLogout}
            />

            {/* ── Google Play Prominent Disclosure Modal (required before ACCESS_BACKGROUND_LOCATION) ── */}
            {showLocationDisclosure && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
                        style={{ fontFamily: 'sans-serif' }}
                    >
                        {/* Header */}
                        <div style={{ background: 'linear-gradient(135deg, #0ea5e9, #2563eb)', padding: '20px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    background: 'rgba(255,255,255,0.25)', borderRadius: '12px',
                                    width: 44, height: 44, display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', flexShrink: 0
                                }}>
                                    <MapPin size={22} color="#fff" />
                                </div>
                                <div>
                                    <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 17, margin: 0 }}>
                                        Location Access Required
                                    </h2>
                                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: '2px 0 0' }}>
                                        Connect to Campus — Driver Mode
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '20px 24px', fontSize: 14, color: '#374151', lineHeight: '1.6' }}>
                            <p style={{ fontWeight: 600, marginBottom: 12, color: '#111827' }}>
                                This app collects location data in the <strong>background</strong> to:
                            </p>
                            <ul style={{ margin: 0, paddingLeft: 20, color: '#374151' }}>
                                <li style={{ marginBottom: 8 }}>
                                    📍 Continuously broadcast your bus's <strong>live GPS position</strong> to parents and school admins while you are on a trip
                                </li>
                                <li style={{ marginBottom: 8 }}>
                                    🚌 Ensure accurate vehicle tracking even when the app is in the background or screen is off
                                </li>
                                <li style={{ marginBottom: 8 }}>
                                    🔒 Data is only shared with authorized school administrators and parents of enrolled students
                                </li>
                            </ul>
                            <div style={{
                                marginTop: 16, padding: '10px 14px',
                                background: '#eff6ff', borderRadius: 10,
                                border: '1px solid #bfdbfe', fontSize: 12, color: '#1e40af'
                            }}>
                                ℹ️ Location is <strong>only active while tracking is ON</strong>. You can stop tracking at any time using the Stop button.
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10 }}>
                            <button
                                onClick={() => setShowLocationDisclosure(false)}
                                style={{
                                    flex: 1, padding: '12px 0', borderRadius: 10, border: '1.5px solid #d1d5db',
                                    background: '#fff', color: '#374151', fontWeight: 600, fontSize: 14,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDisclosureAccept}
                                style={{
                                    flex: 2, padding: '12px 0', borderRadius: 10, border: 'none',
                                    background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
                                    color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer'
                                }}
                            >
                                Allow &amp; Start Tracking
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Sub Components ---

const StaffOverview = ({ isDriver, schoolName, profile, user }) => {
    const navigate = useNavigate();
    const [attendancePercent, setAttendancePercent] = useState('0');
    const [lastSalary, setLastSalary] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const now = new Date();

                // Parallel Fetch
                const [attRes, salRes] = await Promise.allSettled([
                    api.get('/staff/attendance/my', {
                        params: { month: now.getMonth() + 1, year: now.getFullYear() }
                    }),
                    api.get('/staff/salary/history')
                ]);

                // Process Attendance
                if (attRes.status === 'fulfilled') {
                    const data = attRes.value.data;
                    const presentCount = data.filter(r => r.status?.toLowerCase() === 'present').length;
                    const totalMarked = data.length;

                    if (totalMarked > 0) {
                        setAttendancePercent(Math.round((presentCount / totalMarked) * 100));
                    } else {
                        setAttendancePercent(0);
                    }
                }

                // Process Salary
                if (salRes.status === 'fulfilled') {
                    const data = salRes.value.data;
                    if (data && data.length > 0) {
                        setLastSalary(data[0]); // first one is latest due to DESC sort
                    }
                }

            } catch (e) {
                console.error("Failed to load dashboard stats", e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-full mb-6">
                <div className="overflow-hidden w-full bg-white rounded-xl p-6 border border-slate-200 shadow-sm relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10">
                        <h3 className="text-3xl font-black text-slate-800 tracking-tight font-serif italic mb-1">
                            {schoolName}
                        </h3>
                        {user && (
                            <div className="mt-4 flex flex-col gap-1">
                                <h2 className="text-xl font-bold text-slate-700">{profile?.name || user.name}</h2>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 font-medium">
                                    <span className="flex items-center gap-1">
                                        <Briefcase size={14} className="text-indigo-500" />
                                        {isDriver ? 'Driver' : (profile?.role || 'Staff Member')}
                                    </span>
                                    {profile?.employee_id && (
                                        <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                            ID: {profile.employee_id}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>



            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-500 mb-1">Attendance (This Month)</h3>
                <div className="text-3xl font-bold text-slate-800">
                    {loading ? <span className="text-sm text-slate-400">Loading...</span> : `${attendancePercent}%`}
                </div>
                <div className={`text-xs mt-2 font-bold ${attendancePercent >= 90 ? 'text-emerald-500' : attendancePercent >= 75 ? 'text-amber-500' : 'text-rose-500'}`}>
                    {loading ? '' : attendancePercent >= 90 ? 'Excellent' : attendancePercent >= 75 ? 'Good' : 'Needs Improvement'}
                </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-500 mb-1">Last Salary</h3>
                <div className="text-3xl font-bold text-slate-800">
                    {loading ? <span className="text-sm text-slate-400">...</span> : lastSalary ? `₹${lastSalary.amount}` : '-'}
                </div>
                {loading ? '' : lastSalary ? `${new Date(0, lastSalary.month - 1).toLocaleString('default', { month: 'short' })} ${lastSalary.year} • ${lastSalary.status}` : 'No records'}
            </div>
            {/* Recent Announcements Widget */}
            <div className="h-full">
                <RecentAnnouncements limit={3} onMoreClick={() => document.getElementById('btn-announcements')?.click()} />
            </div>
        </div>
    );
};

const DriverTrackingView = ({ vehicles, selectedVehicle, setSelectedVehicle, startTracking, stopTracking, isTracking, location, logs }) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="bg-indigo-600 p-6 text-white text-center">
                <Bus size={48} className="mx-auto mb-2 opacity-90" />
                <h2 className="text-2xl font-bold">Trip Tracker</h2>
                <p className="text-indigo-200 text-sm">Select your bus and start driving</p>
            </div>

            <div className="p-6 space-y-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Select Vehicle</label>
                    <select
                        className="w-full p-3 border rounded-lg bg-slate-50 text-slate-700 font-medium disabled:opacity-50"
                        value={selectedVehicle}
                        onChange={(e) => setSelectedVehicle(e.target.value)}
                        disabled={isTracking}
                    >
                        <option value="">-- Choose Bus --</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>
                                {v.vehicle_number} ({v.vehicle_model})
                            </option>
                        ))}
                    </select>
                </div>

                <div className={`flex items-center justify-center gap-3 p-4 rounded-lg border ${isTracking ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                    <span className="font-bold text-sm">
                        {isTracking ? 'TRACKING ACTIVE' : 'Status: Offline'}
                    </span>
                </div>

                {!isTracking ? (
                    <button onClick={startTracking} disabled={!selectedVehicle} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed">
                        <Navigation size={20} /> START TRACKING
                    </button>
                ) : (
                    <button onClick={stopTracking} className="w-full py-4 bg-red-500 hover:bg-red-600 active:scale-95 transition-all text-white rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2">
                        <Radio size={20} /> STOP TRACKING
                    </button>
                )}

                {location && (
                    <div className="text-center text-xs text-slate-400">
                        GPS: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </div>
                )}
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 h-96 overflow-hidden flex flex-col">
            <h3 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2">
                <MapPin size={14} /> Activity Log
            </h3>
            <div className="flex-1 overflow-y-auto bg-slate-50 rounded-lg p-3 space-y-1 text-xs font-mono text-slate-600 custom-scrollbar">
                {logs.length === 0 && <span className="text-slate-400 italic">No activity yet...</span>}
                {logs.map((log, i) => (
                    <div key={i} className="border-b border-slate-100 last:border-0 pb-1">
                        {log}
                    </div>
                ))}
            </div>
        </div>
    </div>
);



// Helper Component
const NavButton = ({ active, onClick, icon: Icon, label, id }) => (
    <button
        id={id}
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group ${active
            ? 'bg-white text-blue-600 shadow-lg translate-x-1'
            : 'text-blue-100 hover:bg-white/10 hover:text-white hover:translate-x-1'
            }`}
    >
        <Icon size={18} className={`${active ? 'text-blue-600' : 'text-blue-200 group-hover:text-white px-0'}`} />
        <span className="flex-1 text-left">{label}</span>
        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600/20"></span>}
    </button>
);

const NavGroup = ({ label, icon: Icon, expanded, onToggle, children }) => (
    <div className="space-y-1">
        <button
            onClick={onToggle}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold rounded-xl transition-all duration-200 group ${expanded ? 'text-white shadow-md bg-white/10' : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon size={18} className={`${expanded ? 'text-white' : 'text-blue-200 group-hover:text-white'}`} />
                {label}
            </div>
            <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-180 text-white' : 'text-blue-200'}`} />
        </button>
        {expanded && (
            <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {children}
            </div>
        )}
    </div>
);

const NavSubButton = ({ active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${active
            ? 'text-white bg-white/10 shadow-sm'
            : 'text-blue-200 hover:text-white hover:bg-white/5'
            }`}
    >
        <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${active ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-blue-300/50'
            }`}></span>
        {label}
    </button>
);

const getTabTitle = (tab, isDriver) => {
    switch (tab) {
        case 'overview': return isDriver ? 'Driver Dashboard' : 'Staff Dashboard';

        case 'attendance': return 'Attendance History';
        case 'student-attendance': return 'Mark Student Attendance';
        case 'daily-status': return 'Daily Attendance Status';
        case 'attendance-reports': return 'Student Attendance Reports';
        case 'transport': return 'Trip Tracking';
        case 'fleet-map': return 'Live Fleet Tracking';
        case 'salary': return 'Salary & Payslips';
        case 'calendar': return 'Academic Calendar';
        case 'announcements': return 'Announcements';
        case 'leaves': return 'Leave Applications';
        case 'out-pass': return 'Out Pass';
        case 'library-overview': return 'Library Information';
        case 'library-books': return 'Book Management';
        case 'library-issue': return 'Circulation Desk';
        case 'hostel-overview': return 'Hostel Management';
        case 'hostel-rooms': return 'Room Configurations';
        case 'hostel-allocation': return 'Room Allocations';
        case 'hostel-finance': return 'Hostel Finances';
        case 'face-enroll': return 'Biometric Face Enrollment';
        case 'face-scanner': return 'Biometric Face Scanner';
        default: return 'Dashboard';
    }
};

// Styles for custom scrollbar (injected here to ensure consistency)
/* 
   Note: Ideally move to index.css, but this ensures it works immediately 
   without touching global files.
*/
const styles = `
    .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    aside .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
`;

export default function WrappedStaffDashboard() {
    return (
        <>
            <style>{styles}</style>
            <StaffDashboard />
        </>
    );
};
