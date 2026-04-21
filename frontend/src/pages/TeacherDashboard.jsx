import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import LogoutConfirmationModal from '../components/LogoutConfirmationModal';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, Calendar,
    LogOut, Bell, GraduationCap,
    CheckSquare, Clock, Bus, MessageSquare, MapPin, BookOpen, Menu, X, Navigation, DollarSign, ClipboardList, Database, Book
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';
import api from '../api/axios';
import StudentAttendanceMarking from '../components/dashboard/students/StudentAttendanceMarking';
import TeacherMyTimetable from '../components/dashboard/teachers/TeacherMyTimetable';
import TeacherMySalary from '../components/dashboard/teachers/TeacherMySalary';

import TeacherMyAttendance from '../components/dashboard/teachers/TeacherMyAttendance';
import TeacherDoubts from '../components/dashboard/teachers/TeacherDoubts';
import TeacherLeaveApplication from '../components/dashboard/teachers/TeacherLeaveApplication';
import SchoolCalendar from '../components/dashboard/calendar/SchoolCalendar';
import TeacherLibraryStatus from '../components/dashboard/teachers/TeacherLibraryStatus';
import ViewAnnouncements from '../components/dashboard/calendar/ViewAnnouncements';
import RecentAnnouncements from '../components/dashboard/calendar/RecentAnnouncements';
import AdminLiveMap from '../components/dashboard/admin/AdminLiveMap';
import TeacherProfile from '../components/dashboard/teachers/TeacherProfile';
import StudentManagement from '../components/dashboard/students/StudentManagement';
import StudentReviewManagement from '../components/dashboard/students/StudentReviewManagement';
import QuestionPaperGenerator from '../components/dashboard/academics/question-paper/QuestionPaperGenerator';
import DedicatedQuestionBank from '../components/dashboard/academics/question-paper/DedicatedQuestionBank';
import FaceEnrollment from '../components/dashboard/biometric/FaceEnrollment';
import FaceAttendanceScanner from '../components/dashboard/biometric/FaceAttendanceScanner';
import { MobileHeader, MobileFooter } from '../components/layout/MobileAppFiles';
import { Capacitor } from '@capacitor/core';

const TeacherDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [teacherProfile, setTeacherProfile] = useState(null);
    const [schoolConfig, setSchoolConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [isMobileApp, setIsMobileApp] = useState(false);
    const schoolName = schoolConfig?.name || 'School Software';

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

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setIsMobileMenuOpen(false);
    };

    useEffect(() => {
        fetchProfile();
        fetchSchoolInfo();
    }, []);

    const fetchSchoolInfo = async () => {
        try {
            const res = await api.get('/schools/my-school');
            setSchoolConfig(res.data);
        } catch (error) {
            console.error("Failed to load school info", error);
        }
    };

    const fetchProfile = async () => {
        try {
            const res = await api.get('/teachers/profile');
            setTeacherProfile(res.data);
        } catch (error) {
            console.error("Failed to load teacher profile", error);
        } finally {
            setLoading(false);
        }
    };

    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleLogoutClick = () => {
        setShowLogoutModal(true);
    };

    const handleConfirmLogout = () => {
        logout();
        navigate('/');
    };

    // Construct Config for StudentAttendanceMarking based on assigned class
    const attendanceConfig = {
        classes: teacherProfile?.assigned_class_id ? [{
            class_id: teacherProfile.assigned_class_id,
            class_name: teacherProfile.class_name,
            sections: [{ id: teacherProfile.assigned_section_id, name: teacherProfile.section_name }]
        }] : (schoolConfig?.classes || []) // Default to all school classes if not assigned
    };

    return (
        <div className="relative min-h-screen w-full flex font-sans text-slate-900 overflow-hidden">
            {/* Global Background Image (Optional, but keeping consistent with Admin if wanted, or just dark sidebar) 
                 Actually, simpler to just style the sidebar directly as requested.
             */}

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
                        {schoolConfig.logo ? (
                            <div className="h-10 w-10 rounded-xl overflow-hidden bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-sm">
                                <img src={schoolConfig.logo} alt="Logo" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="bg-white/20 p-2.5 rounded-xl shadow-[0_0_15px_rgba(255,255,255,0.2)] border border-white/30 backdrop-blur-sm">
                                <GraduationCap className="text-white w-6 h-6" />
                            </div>
                        )}
                        <div className="w-full">
                            <h1 className="text-sm font-black text-white tracking-widest leading-none drop-shadow-md uppercase">Connect to Campus</h1>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100 mt-1 opacity-80">{schoolConfig.name || 'Software'}</p>
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

                    <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-6">Academic</p>
                    <NavButton active={activeTab === 'attendance'} onClick={() => handleTabChange('attendance')} icon={CheckSquare} label="Mark Attendance" />
                    
                    {(loading || teacherProfile?.can_enroll_face) && (
                         <NavButton active={activeTab === 'face-enroll'} onClick={() => handleTabChange('face-enroll')} icon={Users} label="Face Enrollment" />
                    )}
                    {(loading || teacherProfile?.can_take_face_attendance) && (
                         <NavButton active={activeTab === 'face-scanner'} onClick={() => handleTabChange('face-scanner')} icon={Database} label="Face Scanner" />
                    )}

                    <NavButton active={activeTab === 'timetable'} onClick={() => handleTabChange('timetable')} icon={Calendar} label="My Timetable" />
                    <NavButton active={activeTab === 'doubts'} onClick={() => handleTabChange('doubts')} icon={MessageSquare} label="Student Doubts" />
                    <NavButton active={activeTab === 'student-reviews'} onClick={() => handleTabChange('student-reviews')} icon={ClipboardList} label="Student Reviews" />
                    {schoolConfig.has_neet_exams && (
                        <>
                            <NavButton active={activeTab === 'question-bank'} onClick={() => handleTabChange('question-bank')} icon={Database} label="NEET Question Bank" />
                            <NavButton active={activeTab === 'question-generator'} onClick={() => handleTabChange('question-generator')} icon={Book} label="AI Question Paper" />
                        </>
                    )}
                    <NavButton active={activeTab === 'library'} onClick={() => handleTabChange('library')} icon={BookOpen} label="Library Books" />

                    <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-6">Personal</p>
                    <NavButton active={activeTab === 'my-attendance'} onClick={() => handleTabChange('my-attendance')} icon={Clock} label="My Attendance" />
                    <NavButton active={activeTab === 'salary'} onClick={() => handleTabChange('salary')} icon={DollarSign} label="My Salary" />
                    <NavButton active={activeTab === 'leaves'} onClick={() => handleTabChange('leaves')} icon={Clock} label="Leave Applications" />
                    <NavButton active={activeTab === 'fleet-map'} onClick={() => handleTabChange('fleet-map')} icon={Navigation} label="Live Fleet Map" />

                    <p className="px-4 text-xs font-bold text-blue-200 uppercase tracking-wider mb-2 mt-6">General</p>
                    <NavButton id="btn-announcements" active={activeTab === 'announcements'} onClick={() => handleTabChange('announcements')} icon={Bell} label="Notice Board" />
                    <NavButton active={activeTab === 'calendar'} onClick={() => handleTabChange('calendar')} icon={Calendar} label="School Calendar" />
                </nav>

                {/* Footer User Profile */}
                <div className="p-4 border-t border-white/20 bg-black/10">
                    <div
                        onClick={() => setActiveTab('profile')}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer group border flex-shrink-0
                            ${activeTab === 'profile' ? 'bg-white/20 border-white/40 shadow-inner' : 'bg-white/10 hover:bg-white/20 border-white/10 hover:border-white/30'}`}
                    >
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-600 font-bold shadow-lg overflow-hidden border-2 border-white/20 flex-shrink-0">
                            {teacherProfile?.profile_image ? (
                                <img src={teacherProfile.profile_image} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                (teacherProfile?.name || user?.name || 'T')?.[0]?.toUpperCase()
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{teacherProfile?.name || user?.name || 'Teacher'}</p>
                            <p className="text-[10px] text-blue-100 uppercase font-medium tracking-tight">
                                {teacherProfile?.subject_specialization || 'Teacher'} • {teacherProfile?.employee_id || '--'}
                            </p>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleLogoutClick(); }}
                            className="text-blue-200 hover:text-white transition-colors p-1"
                        >
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
                        logo={schoolConfig.logo}
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
                                    {getTabTitle(activeTab)}
                                </h2>
                                <p className="text-xs text-slate-500 md:block hidden">Manage your class and academic activities</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 py-2">
                            <NotificationBell />
                            <div
                                onClick={() => setActiveTab('profile')}
                                className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold border border-emerald-200 overflow-hidden cursor-pointer hover:ring-2 ring-emerald-300 transition-all"
                            >
                                {teacherProfile?.profile_image ? (
                                    <img src={teacherProfile.profile_image} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    user?.name?.[0]
                                )}
                            </div>
                        </div>
                    </header>
                )}

                {/* Scrollable Content */}
                <div className={`flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar ${isMobileApp ? 'pt-[calc(4rem+var(--sat)+1rem)] pb-[calc(4rem+var(--sab)+1rem)]' : 'pt-[calc(var(--sat)+1rem)]'}`}>

                    <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
                        {loading ? (
                            <div className="text-center py-20 text-slate-400">Loading profile...</div>
                        ) : (
                            <>
                                {activeTab === 'overview' && <TeacherOverview profile={teacherProfile} schoolName={schoolName} user={user} />}

                                {activeTab === 'attendance' && (
                                    teacherProfile?.assigned_class_id ?
                                        <StudentAttendanceMarking config={attendanceConfig} /> :
                                        <div className="p-12 border-2 border-dashed border-slate-300 rounded-2xl text-center text-slate-400 font-bold">
                                            You are not assigned as a Class Teacher to mark attendance.
                                        </div>
                                )}

                                {activeTab === 'my-attendance' && <TeacherMyAttendance />}
                                {activeTab === 'salary' && <TeacherMySalary />}

                                {activeTab === 'timetable' && <TeacherMyTimetable />}

                                {activeTab === 'fleet-map' && <AdminLiveMap />}

                                {activeTab === 'doubts' && <TeacherDoubts />}

                                {activeTab === 'student-reviews' && <StudentReviewManagement />}
                                {activeTab === 'question-bank' && <DedicatedQuestionBank config={attendanceConfig} />}
                                {activeTab === 'question-generator' && <QuestionPaperGenerator config={attendanceConfig} />}
                                
                                {activeTab === 'face-enroll' && <FaceEnrollment config={attendanceConfig} preferredFacingMode="environment" />}
                                {activeTab === 'face-scanner' && <FaceAttendanceScanner config={attendanceConfig} preferredFacingMode="user" />}
                                {activeTab === 'library' && <TeacherLibraryStatus />}
                                {activeTab === 'leaves' && <TeacherLeaveApplication />}
                                {activeTab === 'announcements' && <ViewAnnouncements />}
                                {activeTab === 'calendar' && <SchoolCalendar />}
                                {activeTab === 'profile' && <TeacherProfile profile={teacherProfile} onUpdate={fetchProfile} />}
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
                        { id: 'attendance', label: 'Attendance', icon: CheckSquare },
                        { id: 'doubts', label: 'Doubts', icon: MessageSquare },
                        { id: 'student-reviews', label: 'Reviews', icon: Users },
                    ]}
                />
            )}
            <LogoutConfirmationModal
                isOpen={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={handleConfirmLogout}
            />
        </div>
    );
};

// --- Sub Components ---

const TeacherOverview = ({ profile, schoolName, user }) => {
    const [attendancePercent, setAttendancePercent] = React.useState(0);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchAttendance = async () => {
            setLoading(true);
            try {
                const now = new Date();
                const res = await api.get('/teachers/attendance/my', {
                    params: { month: now.getMonth() + 1, year: now.getFullYear() }
                });

                const data = res.data || [];
                const presentCount = data.filter(r => r.status?.toLowerCase() === 'present').length;
                const totalMarked = data.length;

                if (totalMarked > 0) {
                    setAttendancePercent(Math.round((presentCount / totalMarked) * 100));
                } else {
                    setAttendancePercent(0);
                }
            } catch (e) {
                console.error("Failed to load attendance stats", e);
            } finally {
                setLoading(false);
            }
        };
        fetchAttendance();
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-full mb-6">
                <div className="overflow-hidden w-full bg-white rounded-xl p-6 border border-slate-200 shadow-sm relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-50 transition-colors"></div>
                    <div className="relative z-10 flex items-center gap-6">
                        {profile?.profile_image ? (
                            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg border-2 border-white flex-shrink-0">
                                <img src={profile.profile_image} alt="Profile" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-3xl shadow-inner flex-shrink-0">
                                {profile?.name?.[0] || user?.name?.[0]}
                            </div>
                        )}
                        <div className="flex-1">
                            <h3 className="text-3xl font-black text-slate-800 tracking-tight font-serif italic mb-1 truncate">
                                {schoolName}
                            </h3>
                            {user && (
                                <div className="flex flex-col gap-1">
                                    <h2 className="text-xl font-bold text-slate-700">{profile?.name || user.name}</h2>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 font-medium">
                                        <span className="flex items-center gap-1">
                                            <BookOpen size={14} className="text-emerald-500" />
                                            {profile?.subject_specialization || 'Teacher'}
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
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-all"></div>
                <h3 className="font-bold text-emerald-100 mb-1 relative z-10">My Assigned Class</h3>
                {profile?.class_name ? (
                    <>
                        <div className="text-3xl font-bold relative z-10">{profile.class_name}{profile.section_name ? ` - ${profile.section_name}` : ''}</div>
                        <div className="text-xs text-emerald-200 mt-2 relative z-10 font-medium bg-emerald-700/30 inline-block px-2 py-1 rounded">Class Teacher</div>
                    </>
                ) : (
                    <div className="text-xl font-bold opacity-80 mt-2">No Class Assigned</div>
                )}
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <h3 className="font-bold text-slate-500 mb-1">This Month's Attendance</h3>
                <div className="text-3xl font-bold text-slate-800">
                    {loading ? <span className="text-sm text-slate-400">Loading...</span> : `${attendancePercent}%`}
                </div>
                <div className="text-xs text-slate-400 mt-2">Current month attendance rate</div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <h3 className="font-bold text-slate-500 mb-1">Subject Specialization</h3>
                <div className="text-2xl font-bold text-slate-800 truncate" title={profile?.subject_specialization}>
                    {profile?.subject_specialization || 'General'}
                </div>
                <div className="text-xs text-slate-400 mt-2">Primary Subject</div>
            </div>

            {/* Recent Announcements Widget */}
            <div className="col-span-full">
                <RecentAnnouncements limit={3} onMoreClick={() => document.getElementById('btn-announcements')?.click()} />
            </div>
        </div>
    );
};



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

const getTabTitle = (tab) => {
    switch (tab) {
        case 'overview': return 'Teacher Dashboard';
        case 'attendance': return 'Mark Student Attendance';
        case 'my-attendance': return 'My Daily Attendance';
        case 'salary': return 'My Details & Salary Info';
        case 'timetable': return 'Class Timetable';
        case 'fleet-map': return 'Live Fleet Tracking';
        case 'doubts': return 'Student Doubts & Questions';
        case 'library': return 'My Issued Books';
        case 'leaves': return 'Leave Applications';
        case 'student-reviews': return 'Student Performance & Feedback';
        case 'calendar': return 'Academic Calendar';
        case 'announcements': return 'Announcements';
        case 'question-bank': return 'NEET & JEE Master Bank';
        case 'question-generator': return 'AI Question Paper Generator';
        case 'face-enroll': return 'Student Face Enrollment';
        case 'face-scanner': return 'Biometric Face Scanner';
        case 'profile': return 'My Profile Settings';
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

export default function WrappedTeacherDashboard() {
    return (
        <>
            <style>{styles}</style>
            <TeacherDashboard />
        </>
    );
};
