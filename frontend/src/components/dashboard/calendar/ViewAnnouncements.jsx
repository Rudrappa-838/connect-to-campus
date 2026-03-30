import React, { useState, useEffect } from 'react';
import { Bell, Clock, AlertCircle, FileText, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

import { Browser } from '@capacitor/browser';
import { useAuth } from '../../../context/AuthContext';

const ViewAnnouncements = () => {
    const { user } = useAuth();
    const isAdmin = ['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            // Add cache buster to ensure fresh data
            const res = await api.get(`/calendar/announcements?t=${Date.now()}`);

            // SECONDARY SHIELD: Double-filter on frontend for absolute safety
            if (!isAdmin) {
                const userRole = user?.role?.toUpperCase();
                const filtered = res.data.filter(item => {
                    const target = item.target_role;
                    if (target === 'All') return true;
                    if (userRole === 'STUDENT' && (target === 'Student' || target === 'Class')) return true;
                    if (userRole === 'TEACHER' && target === 'Teacher') return true;
                    if (['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'WARDEN'].includes(userRole) && target === 'Staff') return true;
                    return false;
                });
                setAnnouncements(filtered);
            } else {
                setAnnouncements(res.data);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load announcements');
        } finally {
            setLoading(false);
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'Urgent': return 'bg-red-50 text-red-700 border-red-200';
            case 'High': return 'bg-orange-50 text-orange-700 border-orange-200';
            default: return 'bg-white text-slate-700 border-slate-200';
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading announcements...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-3 rounded-xl shadow-lg shadow-indigo-200">
                    <Bell className="text-white w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Notice Board</h2>
                    <p className="text-slate-500 text-sm">Latest updates and announcements</p>
                </div>
            </div>

            {/* Session Info Badge */}
            <div className="flex justify-end mb-2">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border shadow-sm ${isAdmin ? 'bg-amber-100 border-amber-200 text-amber-800' : 'bg-slate-100 border-slate-200 text-slate-600'
                    }`}>
                    Logged in as: {user?.role} {isAdmin && ' (Full Access)'}
                </span>
            </div>

            {isAdmin && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center gap-3 text-amber-800 text-sm mb-4">
                    <AlertCircle size={18} />
                    <strong>Admin View:</strong> You can see all announcements, regardless of the target audience.
                </div>
            )}

            {announcements.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <Bell size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-600">No New Announcements</h3>
                    <p className="text-slate-400 text-sm mt-1">Check back later for updates.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {announcements.map((item) => (
                        <div
                            key={item.id}
                            className={`relative overflow-hidden rounded-xl border p-6 transition-all hover:shadow-md ${getPriorityColor(item.priority)}`}
                        >
                            {/* Target Badge moved to title row to prevent overlap */}
                            {item.priority === 'Urgent' && (
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <AlertCircle size={80} />
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-3 relative z-10">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-lg">{item.title}</h3>
                                    {item.priority !== 'Normal' && (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border flex-shrink-0 ${item.priority === 'Urgent' ? 'bg-red-100 border-red-200 text-red-700' : 'bg-orange-100 border-orange-200 text-orange-700'
                                            }`}>
                                            {item.priority}
                                        </span>
                                    )}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${item.target_role === 'All' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-200'
                                        }`}>
                                        {item.target_role === 'Class' && item.class_name ? `To ${item.class_name}` :
                                            item.target_role === 'Student' ? 'To Students' :
                                                item.target_role === 'Teacher' ? 'To Teachers' :
                                                    item.target_role === 'Staff' ? 'To Staffs' :
                                                        `Universal Notice`}
                                    </span>
                                </div>
                                <span className="text-xs font-medium opacity-60 flex items-center gap-1">
                                    <Clock size={12} />
                                    {new Date(item.created_at).toLocaleDateString('en-GB')}
                                </span>
                            </div>

                            <p className="text-sm opacity-90 leading-relaxed whitespace-pre-wrap relative z-10 mb-4">
                                {item.message}
                            </p>

                            {item.attachment_url && (
                                <div className="mb-4 relative z-10">
                                    <button 
                                        onClick={async () => {
                                            const url = `${api.defaults.baseURL}${item.attachment_url}`;
                                            try {
                                                await Browser.open({ url });
                                            } catch (e) {
                                                // Fallback for Web browser or if Capacitor Native plugin fails
                                                window.open(url, '_blank', 'noreferrer');
                                            }
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-2 bg-white/50 border border-black/10 rounded-lg text-sm font-medium hover:bg-white/80 transition-all text-current"
                                    >
                                        {(item.attachment_type || '').includes('pdf') ? <FileText size={16} /> : <ImageIcon size={16} />}
                                        View Attachment
                                    </button>
                                </div>
                            )}

                            {item.valid_until && (
                                <div className="mt-4 pt-3 border-t border-black/5 text-xs font-medium opacity-60 flex items-center gap-2 relative z-10">
                                    <span>Valid until: {new Date(item.valid_until).toLocaleDateString('en-GB')}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ViewAnnouncements;
