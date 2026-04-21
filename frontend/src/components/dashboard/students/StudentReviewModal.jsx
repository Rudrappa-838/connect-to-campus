import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, Trash2, User, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

const StudentReviewModal = ({ isOpen, onClose, student }) => {
    const [message, setMessage] = useState('');
    const [reviewType, setReviewType] = useState('GENERAL');
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && student) {
            fetchReviews();
        }
    }, [isOpen, student]);

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/student-reviews/student/${student.id}`);
            setReviews(res.data);
        } catch (error) {
            console.error('Error fetching reviews:', error);
            toast.error('Failed to load previous messages');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        setSubmitting(true);
        try {
            await api.post('/student-reviews', {
                student_id: student.id,
                message: message.trim(),
                review_type: reviewType
            });
            toast.success('Message sent successfully!');
            setMessage('');
            fetchReviews();
        } catch (error) {
            console.error('Error sending review:', error);
            toast.error('Failed to send message');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (reviewId) => {
        if (!window.confirm('Delete this message?')) return;
        try {
            await api.delete(`/student-reviews/${reviewId}`);
            toast.success('Message deleted');
            fetchReviews();
        } catch (error) {
            toast.error('Failed to delete message');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center border border-white/30 truncate text-lg font-bold">
                            {student?.name?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{student?.name}</h2>
                            <p className="text-blue-100 text-xs opacity-80 uppercase tracking-wider font-medium">
                                Student Feedback & Direct Messaging
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
                    {/* Message Box */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex items-center gap-3 mb-2">
                                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                    <MessageSquare size={16} className="text-blue-500" />
                                    Write Message / Review
                                </label>
                                <select 
                                    value={reviewType}
                                    onChange={(e) => setReviewType(e.target.value)}
                                    className="ml-auto text-xs font-bold border-none bg-slate-100 rounded-lg px-2 py-1 outline-none text-slate-600 focus:ring-2 ring-blue-500/20 cursor-pointer"
                                >
                                    <option value="GENERAL">General Feedback</option>
                                    <option value="ACADEMIC">Academic Progress</option>
                                    <option value="BEHAVIOR">Behavioral Report</option>
                                    <option value="URGENT">Urgent Notice</option>
                                </select>
                            </div>
                            <textarea 
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Write your feedback here... Parents will also be notified."
                                className="w-full min-h-[100px] p-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none text-slate-700 resize-none bg-slate-50/30"
                                required
                            />
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={submitting || !message.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-95"
                                >
                                    {submitting ? 'Sending...' : 'Send Message'}
                                    <Send size={18} />
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* History */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-1">Message History</h3>
                        {loading ? (
                            <div className="py-10 text-center text-slate-400">Loading history...</div>
                        ) : reviews.length === 0 ? (
                            <div className="py-10 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                                No messages sent yet.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {reviews.map((rev) => (
                                    <div key={rev.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 group relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                                                    rev.review_type === 'URGENT' ? 'bg-red-100 text-red-600' : 
                                                    rev.review_type === 'ACADEMIC' ? 'bg-blue-100 text-blue-600' : 
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {rev.review_type}
                                                </div>
                                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {new Date(rev.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={() => handleDelete(rev.id)}
                                                className="text-slate-300 hover:text-rose-500 transition-colors md:opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{rev.message}</p>
                                        <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-400 border-t border-slate-50 pt-2">
                                            <User size={12} />
                                            Sent by: <span className="text-slate-600 uppercase tracking-tighter">{rev.sender_name} ({rev.sender_role})</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Tip */}
                <div className="p-4 bg-blue-50 border-t border-blue-100 flex items-center gap-3 text-blue-700 text-xs font-medium">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    Messages sent here are visible to the Student and their Parent, and trigger a push notification.
                </div>
            </div>
        </div>
    );
};

export default StudentReviewModal;
