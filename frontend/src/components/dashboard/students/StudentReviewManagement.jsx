import React, { useState, useEffect } from 'react';
import { Search, User, MessageSquare, Send, Clock, AlertCircle, Trash2, Calendar, BookOpen, Timer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

const getDaysRemaining = (createdAt) => {
    const created = new Date(createdAt);
    const expiry = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const diff = expiry - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const ReviewTypeBadge = ({ type }) => {
    const styles = {
        URGENT: 'bg-red-100 text-red-600 border-red-200',
        ACADEMIC: 'bg-blue-100 text-blue-600 border-blue-200',
        BEHAVIOR: 'bg-amber-100 text-amber-600 border-amber-200',
        GENERAL: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return (
        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border ${styles[type] || styles.GENERAL}`}>
            {type}
        </span>
    );
};

const StudentReviewManagement = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('review_selected_student') || 'null'); } catch { return null; }
    });
    const [message, setMessage] = useState('');
    const [reviewType, setReviewType] = useState('GENERAL');
    const [reviews, setReviews] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Persist selected student in sessionStorage
    useEffect(() => {
        if (selectedStudent) {
            sessionStorage.setItem('review_selected_student', JSON.stringify(selectedStudent));
            fetchReviews(selectedStudent.id);
        } else {
            sessionStorage.removeItem('review_selected_student');
        }
    }, [selectedStudent?.id]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearching(true);
        setSelectedStudent(null);
        setReviews([]);
        try {
            const res = await api.get('/students', { params: { search: searchQuery.trim(), limit: 5 } });
            const students = res.data.data || [];
            if (students.length > 0) {
                setSelectedStudent(students[0]);
            } else {
                toast.error('No student found with that ID or Name');
            }
        } catch (error) {
            console.error('Search error:', error);
            toast.error('Search failed');
        } finally {
            setSearching(false);
        }
    };

    const fetchReviews = async (studentId) => {
        setLoadingHistory(true);
        try {
            const res = await api.get(`/student-reviews/student/${studentId}`);
            setReviews(res.data || []);
        } catch (error) {
            console.error('Error fetching reviews:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim() || !selectedStudent) return;
        setSubmitting(true);
        try {
            await api.post('/student-reviews', {
                student_id: selectedStudent.id,
                message: message.trim(),
                review_type: reviewType
            });
            toast.success('✅ Review sent! Student notified.');
            setMessage('');
            fetchReviews(selectedStudent.id);
        } catch (error) {
            console.error('Error sending review:', error);
            toast.error('Failed to send review');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (reviewId) => {
        if (!window.confirm('Delete this review?')) return;
        try {
            await api.delete(`/student-reviews/${reviewId}`);
            toast.success('Review deleted');
            fetchReviews(selectedStudent.id);
        } catch (error) {
            toast.error('Failed to delete review');
        }
    };

    const clearStudent = () => {
        setSelectedStudent(null);
        setReviews([]);
        setMessage('');
        setSearchQuery('');
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-xl text-white">
                            <MessageSquare className="w-6 h-6" />
                        </div>
                        Student Reviews & Feedback
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1 ml-1">
                        Search by Student ID or Name to send feedback
                    </p>
                </div>

                <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Student ID or Name..."
                        className="w-full pl-12 pr-24 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-semibold text-slate-700 bg-slate-50"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <button
                        type="submit"
                        disabled={searching || !searchQuery.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-40"
                    >
                        {searching ? '...' : 'Search'}
                    </button>
                </form>
            </div>

            {selectedStudent ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Student Card + Form */}
                    <div className="space-y-4">

                        {/* Student Verification Card */}
                        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                            <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-blue-400/20 rounded-full blur-xl" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-[10px] uppercase tracking-widest font-black text-blue-200 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                        Student Verified
                                    </div>
                                    <button onClick={clearStudent} className="text-white/60 hover:text-white text-xs font-bold transition-colors">
                                        × Clear
                                    </button>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-xl font-black">
                                        {(selectedStudent.first_name || selectedStudent.name || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold">
                                            {selectedStudent.first_name
                                                ? `${selectedStudent.first_name} ${selectedStudent.last_name || ''}`
                                                : selectedStudent.name || 'Unknown Student'}
                                        </h3>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className="text-[10px] font-bold bg-white/15 border border-white/20 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                                                <User size={10} /> {selectedStudent.admission_no || `ID: ${selectedStudent.id}`}
                                            </span>
                                            <span className="text-[10px] font-bold bg-white/15 border border-white/20 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                                                <BookOpen size={10} /> {selectedStudent.class_name || 'N/A'}
                                                {selectedStudent.section_name ? ` – ${selectedStudent.section_name}` : ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Send Form */}
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                            <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Send className="text-blue-500" size={18} />
                                New Feedback
                            </h4>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Review Type</label>
                                    <select
                                        value={reviewType}
                                        onChange={(e) => setReviewType(e.target.value)}
                                        className="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50 font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm"
                                    >
                                        <option value="GENERAL">General Feedback</option>
                                        <option value="ACADEMIC">Academic Progress</option>
                                        <option value="BEHAVIOR">Behavioral Report</option>
                                        <option value="URGENT">Urgent Notice</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Message</label>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Enter feedback for student and parents..."
                                        className="w-full min-h-[140px] p-4 rounded-2xl border border-slate-200 bg-slate-50 font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none text-sm"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting || !message.trim()}
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white py-3.5 rounded-2xl font-black shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 text-sm"
                                >
                                    {submitting ? (
                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                                    ) : (
                                        <><Send size={16} /> Send Review</>
                                    )}
                                </button>
                                <p className="text-[10px] text-center text-slate-400 font-bold flex items-center justify-center gap-1">
                                    <AlertCircle size={10} /> Notification sent to Student & visible for 30 days
                                </p>
                            </form>
                        </div>
                    </div>

                    {/* Right: Review History */}
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col">
                        <div className="flex items-center justify-between mb-5">
                            <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <Calendar className="text-blue-500" size={18} />
                                Active Reviews
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-2.5 py-1 rounded-full">
                                    {reviews.length} active
                                </span>
                                <button
                                    onClick={() => fetchReviews(selectedStudent.id)}
                                    className="text-slate-400 hover:text-blue-600 transition-colors text-[10px] font-bold"
                                >
                                    ↻ Refresh
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 min-h-[300px] max-h-[520px] pr-1 custom-scrollbar">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                                    <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-3" />
                                    <p className="text-xs font-bold">Loading...</p>
                                </div>
                            ) : reviews.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                                    <Clock className="w-10 h-10 mb-2 opacity-20" />
                                    <p className="font-bold text-sm">No active reviews</p>
                                    <p className="text-xs mt-1 px-8">Reviews auto-expire after 30 days</p>
                                </div>
                            ) : (
                                reviews.map((rev) => {
                                    const daysLeft = getDaysRemaining(rev.created_at);
                                    const isExpiringSoon = daysLeft <= 5;
                                    return (
                                        <div key={rev.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 group hover:bg-white hover:shadow-md hover:border-slate-200 transition-all">
                                            <div className="flex justify-between items-start mb-2.5">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <ReviewTypeBadge type={rev.review_type} />
                                                    <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                                                        <Clock size={9} />
                                                        {new Date(rev.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-black flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg ${isExpiringSoon ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                                                        <Timer size={8} />
                                                        {daysLeft}d left
                                                    </span>
                                                    <button
                                                        onClick={() => handleDelete(rev.id)}
                                                        className="text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-slate-700 text-sm leading-relaxed">{rev.message}</p>
                                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                                                <span className="text-[10px] text-slate-400 font-bold">By: {rev.sender_name}</span>
                                                <span className="text-[9px] bg-white px-2 py-0.5 rounded-lg shadow-sm text-slate-500 font-bold border border-slate-100">
                                                    {rev.sender_role?.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm flex flex-col items-center gap-5">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-full flex items-center justify-center">
                        <Search className="w-9 h-9 text-blue-300" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-700">Search for a Student</h3>
                        <p className="text-slate-400 text-sm max-w-xs mx-auto mt-1.5">
                            Enter a student ID or name above to view and send feedback. Reviews auto-expire after 30 days.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentReviewManagement;
