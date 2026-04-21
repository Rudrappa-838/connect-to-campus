import React, { useState, useEffect } from 'react';
import { Bell, ChevronRight, AlertCircle, Clock, Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/axios';
import { useAuth } from '../../../context/AuthContext';

const RecentAnnouncements = ({ limit = 3, onMoreClick }) => {
    const { user } = useAuth();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchRecent = async () => {
            try {
                // Fetch with cache buster
                const res = await api.get(`/calendar/announcements?t=${Date.now()}`);

                // Use session user for accurate filtering
                const isAdmin = ['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

                let data = res.data;

                // SECONDARY SHIELD: Double-filter for absolute safety
                if (!isAdmin) {
                    const userRole = user?.role?.toUpperCase();
                    data = data.filter(item => {
                        const target = item.target_role;
                        if (target === 'All') return true;
                        if (userRole === 'STUDENT' && (target === 'Student' || target === 'Class')) return true;
                        if (userRole === 'TEACHER' && target === 'Teacher') return true;
                        if (['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN'].includes(userRole) && target === 'Staff') return true;
                        return false;
                    });
                }

                setAnnouncements(data.slice(0, limit));
            } catch (error) {
                console.error("Failed to load recent announcements", error);
            } finally {
                setLoading(false);
            }
        };
        fetchRecent();
    }, [limit, user]);

    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden relative">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Bell size={18} className="text-indigo-600" /> Notice Board
                </h3>
                {onMoreClick && (
                    <button
                        onClick={onMoreClick}
                        className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                        View All <ChevronRight size={12} />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                {loading ? (
                    <div className="text-xs text-slate-400 animate-pulse text-center py-4">Checking for updates...</div>
                ) : announcements.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-100">
                        <p className="text-xs font-medium">No recent notices</p>
                    </div>
                ) : (
                    announcements.map(item => (
                        <div key={item.id} className={`p-3 rounded-xl border ${item.priority === 'Urgent' ? 'bg-red-50 border-red-100' :
                            item.priority === 'High' ? 'bg-orange-50 border-orange-100' :
                                'bg-slate-50 border-slate-100'
                            } transition-colors group`}>
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`text-sm font-bold line-clamp-1 ${item.priority === 'Urgent' ? 'text-red-700' :
                                    item.priority === 'High' ? 'text-orange-700' :
                                        'text-slate-700'
                                    }`}>
                                    {item.title}
                                </h4>
                                {item.priority !== 'Normal' && (
                                    <AlertCircle size={12} className={
                                        item.priority === 'Urgent' ? 'text-red-500' : 'text-orange-500'
                                    } />
                                )}
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2">
                                {item.message}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                                <Clock size={10} />
                                <span>{new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                                {item.target_role !== 'All' && (
                                    <span className="bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-100 ml-auto text-slate-500">
                                        {item.target_role}
                                    </span>
                                )}
                                {item.attachment_url && (
                                    <span className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-100 text-indigo-500 ml-1">
                                        <Paperclip size={10} />
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
        </div>
    );
};

export default RecentAnnouncements;
