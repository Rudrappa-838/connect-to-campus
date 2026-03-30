import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, BookOpen, Home, Bus, FileText, Calendar, DollarSign,
    LogOut, User, Bell, GraduationCap, Clock, Award, MessageSquare, Menu, X, Navigation, CheckSquare
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import LogoutConfirmationModal from '../components/LogoutConfirmationModal';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';

import api from '../api/axios';
import StudentDoubts from '../components/dashboard/students/StudentDoubts';
import SchoolCalendar from '../components/dashboard/calendar/SchoolCalendar';
import StudentLibraryStatus from '../components/dashboard/students/StudentLibraryStatus';
import StudentAcademics from '../components/dashboard/students/StudentAcademics';
import StudentMyAttendance from '../components/dashboard/students/StudentMyAttendance';
import StudentHostel from '../components/dashboard/students/StudentHostel';
import StudentFees from '../components/dashboard/students/StudentFees';
import StudentCertificates from '../components/dashboard/students/StudentCertificates';
import StudentLeaves from '../components/dashboard/students/StudentLeaves';
import StudentMyReviews from '../components/dashboard/students/StudentMyReviews';
import ViewAnnouncements from '../components/dashboard/calendar/ViewAnnouncements';
import AdminLiveMap from '../components/dashboard/admin/AdminLiveMap';
import RecentAnnouncements from '../components/dashboard/calendar/RecentAnnouncements';
import { MobileHeader, MobileFooter } from '../components/layout/MobileAppFiles';

const StudentDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isMobileApp, setIsMobileApp] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    // Detect Mobile App context
    useEffect(() => {
        const checkMobile = () => {
            const isNative = Capacitor.isNativePlatform();
            const params = new URLSearchParams(window.location.search);
            const isAppParam = params.get('is_mobile_app') === 'true';
            const isStored = localStorage.getItem('is_mobile_app') === 'true';

            if (isNative || isAppParam || isStored) {
                setIsMobileApp(true);
                if (isAppParam) localStorage.setItem('is_mobile_app', 'true');
            }
        };
        checkMobile();
    }, []);

    const [studentData, setStudentData] = useState(null);
    const [schoolName, setSchoolName] = useState('');
    const [schoolLogo, setSchoolLogo] = useState(null);
    const [leaveNotifications, setLeaveNotifications] = useState([]);
    const [overviewStats, setOverviewStats] = useState({
        attendance: { percentage: 0, present: 0, total: 0 },
        library: { active: 0, overdue: 0 },
        fees: { totalDue: 0, status: 'Checking' },
        bus: { route: 'Not Assigned', status: 'N/A' }
    });

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setIsMobileMenuOpen(false);

        // Mark leave notifications as read when user visits leaves page
        if (tab === 'leaves') {
            localStorage.setItem('lastLeaveCheck', new Date().toISOString());
            setLeaveNotifications([]); // Clear the badge immediately
        }
    };

    useEffect(() => {
        const fetchSchoolInfo = async () => {
            try {
                const res = await api.get('/schools/my-school');
                setSchoolName(res.data.name);
                setSchoolLogo(res.data.logo);
            } catch (error) {
                console.error("Failed to load school info", error);
            }
        };

        const fetchProfile = async () => {
            try {
                const res = await api.get('/students/profile');
                setStudentData(res.data);
            } catch (err) {
                console.error("Failed to load profile", err);
            }
        };

        const fetchData = async () => {
            const today = new Date();
            const month = today.getMonth() + 1;
            const year = today.getFullYear();

            // Default Stats
            let newStats = {
                attendance: { percentage: 0, present: 0, total: 0 },
                library: { active: 0, overdue: 0 },
                fees: { totalDue: 0, status: 'Paid' },
                hostel: { isAllocated: false, room: 'N/A', pendingBills: 0 },
                bus: { route: 'Not Assigned', status: 'N/A' }
            };

            try {
                const [attResult, libResult, feeResult, hostelResult, busResult] = await Promise.allSettled([
                    // Fetch current month's attendance only
                    api.get('/students/attendance/my-report', { params: { month, year } }),
                    api.get('/library/my-books'),
                    api.get('/fees/my-status'),
                    api.get('/hostel/my-details'),
                    api.get('/transport/my-route')
                ]);

                // 1. Attendance
                if (attResult.status === 'fulfilled' && attResult.value.data) {
                    // Backend returns flat object: { attendancePercentage, totalDays, presentDays, ... }
                    // OR { stats: { ... } } depending on version?
                    // Checked studentController.js: It returns flat object { attendancePercentage, totalDays, presentDays, ... }
                    // Logic below handles flat structure.
                    const data = attResult.value.data;
                    const present = data.presentDays || data.stats?.present || 0;
                    const total = data.totalDays || data.stats?.total || 0;
                    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
                    newStats.attendance = { percentage, present, total };
                }

                // 2. Library
                if (libResult.status === 'fulfilled') {
                    // Checked libraryController.js: Returns { books: [...] }
                    const data = libResult.value.data;
                    const books = Array.isArray(data) ? data : (data.books || []);

                    if (Array.isArray(books)) {
                        newStats.library = {
                            active: books.length,
                            overdue: books.filter(b => new Date(b.due_date) < new Date() && b.status === 'Issued').length
                        };
                    }
                }

                // 3. Fees
                if (feeResult.status === 'fulfilled' && Array.isArray(feeResult.value.data)) {
                    const totalDue = feeResult.value.data.reduce((sum, f) => sum + parseFloat(f.balance), 0);
                    newStats.fees = { totalDue, status: totalDue > 0 ? 'Pending' : 'Paid' };
                } else if (feeResult.status === 'rejected') {
                    // Keep default or set to 'Error'
                    console.error("Fees fetch failed", feeResult.reason);
                }

                // 4. Hostel
                if (hostelResult.status === 'fulfilled') {
                    const hData = hostelResult.value.data;
                    if (hData.is_allocated || hData.allocation_id) {
                        const pendingBills = hData.bills ? hData.bills.filter(b => b.status === 'Pending').length : 0;
                        newStats.hostel = {
                            isAllocated: true,
                            room: hData.room_number,
                            pendingBills
                        };
                    }
                }

                // 5. Transport
                if (busResult.status === 'fulfilled') {
                    const bData = busResult.value.data;
                    newStats.bus = {
                        route: bData.route_name || 'Assigned',
                        status: bData.vehicle_status || 'Active'
                    };
                }

                setOverviewStats(newStats);

            } catch (err) {
                console.error("Unexpected error in dashboard fetch", err);
            }
        };

        const fetchLeaveNotifications = async () => {
            try {
                const res = await api.get('/leaves/my-leaves');

                // Get the last time user checked leaves from localStorage
                let lastChecked = localStorage.getItem('lastLeaveCheck');

                // If this is the first time, set it to now (so old notifications don't show)
                if (!lastChecked) {
                    lastChecked = new Date().toISOString();
                    localStorage.setItem('lastLeaveCheck', lastChecked);
                }

                const lastCheckedTime = new Date(lastChecked);

                // Filter only recently approved/rejected leaves that are newer than last check
                const recent = res.data.filter(leave => {
                    if (leave.status === 'Pending') return false;

                    // Use updated_at if available, otherwise created_at
                    const updatedDate = new Date(leave.updated_at || leave.created_at);

                    // Only show if updated AFTER last check
                    return updatedDate.getTime() > lastCheckedTime.getTime();
                });

                setLeaveNotifications(recent);
            } catch (error) {
                console.error('Failed to fetch leave notifications', error);
            }
        };

        fetchSchoolInfo();
        fetchProfile();
        fetchData();
        fetchLeaveNotifications();

        // Poll for new notifications every 2 minutes
        const interval = setInterval(fetchLeaveNotifications, 120000);
        return () => clearInterval(interval);
    }, []);

    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleLogoutClick = () => {
        setShowLogoutModal(true);
    };

    const handleConfirmLogout = () => {
        logout();
        navigate('/');
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
                                <GraduationCap className="text-white w-6 h-6" />
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

                    <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-6">Academics</p>
                    <NavButton active={activeTab === 'academics'} onClick={() => handleTabChange('academics')} icon={BookOpen} label="Academics & Exams" />
                    <NavButton active={activeTab === 'doubts'} onClick={() => handleTabChange('doubts')} icon={MessageSquare} label="Ask Doubts" />
                    <NavButton active={activeTab === 'attendance'} onClick={() => handleTabChange('attendance')} icon={Clock} label="Attendance" />

                    <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-6">Services</p>
                    <NavButton active={activeTab === 'library'} onClick={() => handleTabChange('library')} icon={FileText} label="Library Books" />
                    <NavButton active={activeTab === 'hostel'} onClick={() => handleTabChange('hostel')} icon={Home} label="Hostel Rooms" />
                    <NavButton active={activeTab === 'fleet-map'} onClick={() => handleTabChange('fleet-map')} icon={Navigation} label="Live Fleet Map" />

                    <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-6">Personal</p>
                    <NavButton active={activeTab === 'fees'} onClick={() => handleTabChange('fees')} icon={DollarSign} label="My Fees" />
                    <NavButton active={activeTab === 'certificates'} onClick={() => handleTabChange('certificates')} icon={Award} label="Certificates" />
                    <NavButton
                        active={activeTab === 'leaves'}
                        onClick={() => handleTabChange('leaves')}
                        icon={Calendar}
                        label="Apply Leave"
                        badge={leaveNotifications.length}
                    />
                    <NavButton active={activeTab === 'feedback'} onClick={() => handleTabChange('feedback')} icon={MessageSquare} label="Reviews & Feedback" />

                    <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-6">General</p>
                    <NavButton id="btn-announcements" active={activeTab === 'announcements'} onClick={() => handleTabChange('announcements')} icon={Bell} label="Notice Board" />
                    <NavButton active={activeTab === 'calendar'} onClick={() => handleTabChange('calendar')} icon={Calendar} label="School Calendar" />
                </nav>

                {/* Footer User Profile */}
                <div className="p-4 border-t border-white/20 bg-black/10">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors cursor-pointer group border border-white/10 hover:border-white/30">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-600 font-bold shadow-lg">
                            {(studentData?.name || user?.name || 'S')?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-blue-100 uppercase font-medium tracking-tight">
                                {studentData?.class_name ? `Class ${studentData.class_name.toString().replace(/class/i, '').trim()}${studentData.section_name ? `-${studentData.section_name}` : ''}` : 'Student'} • {studentData?.admission_no || '--'}
                            </p>
                            <p className="text-sm font-bold text-white truncate">{studentData?.name || user?.name || 'Student'}</p>
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
                        title={getTabTitle(activeTab)}
                        schoolName={schoolName}
                        logo={schoolLogo}
                        subtitle={user?.name}
                        userName={studentData?.class_name ? `Class ${studentData.class_name.toString().replace(/class/i, '').trim()}${studentData.section_name ? ` - ${studentData.section_name}` : ''}` : ''}
                        onMenuClick={() => setIsMobileMenuOpen(true)}
                    />
                )}

                {/* Normal Header (Web/Desktop Only) */}
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
                                    {getTabTitle(activeTab)}
                                </h2>
                                <p className="text-xs text-slate-500 md:block hidden">Manage your academic journey here</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 py-2">
                            <NotificationBell />

                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                                {user?.name?.[0]}
                            </div>
                        </div>
                    </header>
                )}

                {/* Scrollable Content */}
                <div className={`flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar ${isMobileApp ? 'pt-[calc(4rem+var(--sat)+1rem)] pb-[calc(4rem+var(--sab)+1rem)]' : ''}`}>

                    <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
                        {activeTab === 'overview' && <StudentOverview schoolName={schoolName} stats={overviewStats} student={studentData} user={user} />}
                        {activeTab === 'doubts' && <StudentDoubts />}
                        {activeTab === 'leaves' && <StudentLeaves />}
                        {activeTab === 'fleet-map' && <AdminLiveMap />}
                        {activeTab === 'library' && <StudentLibraryStatus />}
                        {activeTab === 'hostel' && <StudentHostel />}
                        {activeTab === 'fees' && <StudentFees student={studentData} schoolName={schoolName} />}
                        {activeTab === 'certificates' && <StudentCertificates student={studentData} schoolName={schoolName} />}
                        {activeTab === 'academics' && <StudentAcademics />}
                        {activeTab === 'attendance' && <StudentMyAttendance />}
                        {activeTab === 'feedback' && <StudentMyReviews />}
                        {activeTab === 'announcements' && <ViewAnnouncements />}
                        {activeTab === 'calendar' && <SchoolCalendar />}
                    </div>
                </div>

                {/* Mobile Tab Bar (App Mode Only) */}
                {isMobileApp && (
                    <MobileFooter
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        onMenuToggle={() => setIsMobileMenuOpen(true)}
                        tabs={[
                            { id: 'overview', label: 'Home', icon: Home },
                            { id: 'fees', label: 'Fees', icon: DollarSign },
                            { id: 'feedback', label: 'Reviews', icon: MessageSquare },
                            { id: 'attendance', label: 'Attendance', icon: CheckSquare },
                        ]}
                    />
                )}
            </main>
            <LogoutConfirmationModal
                isOpen={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={handleConfirmLogout}
            />
        </div>
    );
};

// --- Sub Components (Placeholders for now, will expand) ---

const StudentOverview = ({ schoolName, stats, student, user }) => (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="col-span-full mb-6">
            <div className="overflow-hidden w-full bg-white rounded-xl p-6 border border-slate-200 shadow-sm relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10">
                    <h3 className="text-3xl font-black text-slate-800 tracking-tight font-serif italic mb-1">
                        {schoolName}
                    </h3>
                    {user && (
                        <div className="mt-4 flex flex-col gap-1">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 font-medium mb-1">
                                <span className="flex items-center gap-1">
                                    <GraduationCap size={14} className="text-indigo-500" />
                                    {student?.class_name ? `Class ${student.class_name.toString().replace(/class/i, '').trim()}${student.section_name ? `-${student.section_name}` : ''}` : 'Student'}
                                </span>
                                {student?.admission_no && (
                                    <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                        Roll: {student.admission_no}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-slate-700">{student?.name || user?.name || 'Student'}</h2>
                        </div>
                    )}
                </div>
            </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="font-bold text-indigo-100 mb-1">Attendance</h3>
            <div className="text-3xl font-bold">{stats?.attendance?.percentage || 0}%</div>
            <div className="text-xs text-indigo-200 mt-2">Present {stats?.attendance?.present || 0}/{stats?.attendance?.total || 0}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-500 mb-1">Library</h3>
            <div className="text-3xl font-bold text-slate-800">{stats?.library?.active || 0} <span className="text-sm text-slate-400 font-normal">Issued</span></div>
            <div className="text-xs text-rose-500 mt-2 font-bold">{stats?.library?.overdue > 0 ? `${stats.library.overdue} Overdue` : 'No Overdue'}</div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-500 mb-1">Fees</h3>
            {stats?.fees?.status === 'Checking' ? (
                <div className="text-sm text-slate-400 font-medium animate-pulse mt-2">Syncing records...</div>
            ) : (
                <>
                    <div className={`text-2xl font-black ${stats?.fees?.totalDue > 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                        {stats?.fees?.totalDue > 0 ? `₹${stats?.fees?.totalDue.toLocaleString()}` : 'Paid'}
                    </div>
                    <div className={`text-xs mt-2 font-bold ${stats?.fees?.totalDue > 0 ? 'text-rose-400' : 'text-emerald-500'}`}>
                        {stats?.fees?.totalDue > 0 ? `Total Dues` : 'No Dues'}
                    </div>
                </>
            )}
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-500 mb-1">Hostel</h3>
            <div className={`text-xl font-bold ${stats?.hostel?.isAllocated ? 'text-slate-800' : 'text-slate-400'}`}>
                {stats?.hostel?.isAllocated ? `Room ${stats.hostel.room}` : 'N/A'}
            </div>
            <div className="text-xs text-slate-500 mt-2 font-bold">
                {stats?.hostel?.isAllocated ? (
                    <span className={stats.hostel.pendingBills > 0 ? 'text-rose-500' : 'text-emerald-500'}>
                        {stats.hostel.pendingBills > 0 ? `${stats.hostel.pendingBills} Bills Due` : 'All Paid'}
                    </span>
                ) : 'Not Allocated'}
            </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-500 mb-1">Transport</h3>
            <div className="text-xl font-bold text-slate-800">{stats?.bus?.route || 'N/A'}</div>
            <div className="text-xs text-emerald-600 mt-2 font-bold">{stats?.bus?.status || 'Active'}</div>
        </div>

        {/* Recent Announcements Widget */}
        <div className="md:col-span-2 lg:col-span-2 h-80">
            <RecentAnnouncements limit={5} onMoreClick={() => document.getElementById('btn-announcements')?.click()} />
        </div>
    </div>
);


// Helper Component
const NavButton = ({ active, onClick, icon: Icon, label, badge, id }) => (
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
        {badge > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                {badge}
            </span>
        )}
        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600/20"></span>}
    </button>
);

const getTabTitle = (tab) => {
    switch (tab) {
        case 'overview': return 'Student Dashboard';
        case 'fleet-map': return 'Live Fleet Tracking';
        case 'library': return 'My Issued Books';
        case 'hostel': return 'My Hostel Room';
        case 'fees': return 'Fee Status';
        case 'certificates': return 'My Certificates';
        case 'academics': return 'Academics';
        case 'doubts': return 'My Doubts & Questions';
        case 'leaves': return 'Leave Application';
        case 'attendance': return 'Attendance';
        case 'calendar': return 'Academic Calendar';
        case 'announcements': return 'Announcement';
        case 'feedback': return 'Teacher Feedback';
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

export default function WrappedStudentDashboard() {
    return (
        <>
            <style>{styles}</style>
            <StudentDashboard />
        </>
    );
};

