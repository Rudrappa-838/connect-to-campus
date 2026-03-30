import React, { useState, useEffect } from 'react';
import { MessageSquare, Clock, User, AlertCircle, Info, Star, Timer } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const getDaysRemaining = (createdAt) => {
    const created = new Date(createdAt);
    const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diff = expiry - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const StudentMyReviews = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMyReviews();
    }, []);

    const fetchMyReviews = async () => {
        setLoading(true);
        try {
            // This endpoint fetches from student_reviews table (INDEPENDENT of notifications)
            // Marking a notification as read does NOT affect this list
            const res = await api.get('/student-reviews/my-reviews');
            setReviews(res.data || []);
        } catch (error) {
            console.error('Error fetching reviews:', error);
            toast.error('Failed to load messages');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="w-10 h-10 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-slate-400 text-sm font-medium">Loading your reviews...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-70 -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20 text-white">
                            <MessageSquare size={26} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Teacher Feedback</h2>
                            <p className="text-slate-500 text-sm font-medium">Direct messages and performance reviews from your teachers</p>
                        </div>
                    </div>

                </div>
            </div>

            {/* Review List */}
            {reviews.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-200 space-y-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                        <MessageSquare size={40} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-700">No Reviews Yet</h3>
                        <p className="text-slate-400 text-sm max-w-xs mx-auto mt-1">
                            When your teachers send you direct feedback or reviews, they will appear here.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {reviews.map((rev) => {
                        const daysLeft = getDaysRemaining(rev.created_at);
                        const isExpiringSoon = daysLeft <= 5;
                        const isUrgent = rev.review_type === 'URGENT';

                        return (
                            <div
                                key={rev.id}
                                className={`bg-white rounded-2xl p-6 shadow-sm border transition-all group animate-in slide-in-from-bottom-2 duration-300 ${
                                    isUrgent ? 'border-red-200 bg-red-50/30' : 'border-slate-200 hover:border-indigo-300'
                                }`}
                            >
                                <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                                    {/* Left: Type + Date */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
                                            isUrgent ? 'bg-red-100 text-red-600 border-red-200' :
                                            rev.review_type === 'ACADEMIC' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                                            rev.review_type === 'BEHAVIOR' ? 'bg-amber-100 text-amber-600 border-amber-200' :
                                            'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                            {rev.review_type}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                                            <Clock size={12} />
                                            {new Date(rev.created_at).toLocaleDateString('en-GB', {
                                                day: 'numeric', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    </div>

                                    {/* Right: Days countdown + Sender */}
                                    <div className="flex items-center gap-2">
                                        <span className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-xl border ${
                                            isExpiringSoon
                                                ? 'bg-red-50 text-red-500 border-red-200'
                                                : 'bg-green-50 text-green-600 border-green-200'
                                        }`}>
                                            <Timer size={10} />
                                            {daysLeft === 0 ? 'Expires today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
                                        </span>
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                            <User size={12} className="text-slate-400" />
                                            <span className="text-[11px] font-bold text-slate-600">
                                                {rev.sender_name}
                                                <span className="text-slate-400 font-medium ml-1">
                                                    ({rev.sender_role?.replace('_', ' ')})
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Message */}
                                <div className="relative pl-4">
                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap select-text">
                                        {rev.message}
                                    </p>
                                </div>

                                {isUrgent && (
                                    <div className="mt-4 flex items-center gap-2 text-rose-600 text-[10px] font-black uppercase tracking-widest bg-rose-50 px-3 py-1.5 rounded-lg w-fit border border-rose-100">
                                        <AlertCircle size={12} />
                                        Requires Immediate Attention
                                    </div>
                                )}

                                {/* Expiry progress bar */}
                                <div className="mt-4 pt-3 border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Review Validity</span>
                                        <span className="text-[9px] text-slate-400 font-bold">{daysLeft}/30 days remaining</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                isExpiringSoon ? 'bg-red-400' : 'bg-emerald-400'
                                            }`}
                                            style={{ width: `${(daysLeft / 30) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Bottom Tip */}
            <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex items-start gap-4">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-600 flex-shrink-0">
                    <Star size={18} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-amber-800">Growth Mindset</h4>
                    <p className="text-amber-700/80 text-xs mt-0.5 leading-relaxed">
                        Regular feedback helps you identify your strengths and areas for improvement.
                        Always discuss feedback with your teachers and parents to excel further!
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StudentMyReviews;
