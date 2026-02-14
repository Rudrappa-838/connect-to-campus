import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, CheckCircle, Clock } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const TeacherDoubts = () => {
    const [doubts, setDoubts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [replyModalOpen, setReplyModalOpen] = useState(false);
    const [selectedDoubt, setSelectedDoubt] = useState(null);
    const [replyText, setReplyText] = useState('');

    useEffect(() => {
        fetchDoubts();
    }, []);

    const fetchDoubts = async () => {
        try {
            const res = await api.get('/doubts/teacher');
            setDoubts(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load doubts");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenReply = (doubt) => {
        setSelectedDoubt(doubt);
        setReplyText('');
        setReplyModalOpen(true);
    };

    const submitReply = async () => {
        if (!replyText.trim()) return toast.error("Reply cannot be empty");

        try {
            await api.put(`/doubts/${selectedDoubt.id}/reply`, { answer: replyText });
            toast.success("Reply sent successfully");
            setReplyModalOpen(false);
            fetchDoubts();
        } catch (error) {
            console.error(error);
            toast.error("Failed to send reply");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <MessageSquare className="text-emerald-600" /> Student Doubts
                </h3>
                <button onClick={fetchDoubts} className="text-sm text-emerald-600 font-bold hover:underline">Refresh</button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-slate-400">Loading doubts...</div>
            ) : doubts.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                    <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageSquare size={32} />
                    </div>
                    <p className="text-slate-400 font-medium">No doubts asked yet.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {doubts.map(doubt => (
                        <div key={doubt.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="font-bold text-slate-800">{doubt.student_name}</h4>
                                    <p className="text-xs text-slate-500 font-medium">{doubt.class_name || 'Class N/A'} • {doubt.subject_name || 'General'}</p>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded font-bold flex items-center gap-1 ${doubt.status === 'Answered' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {doubt.status === 'Answered' ? <CheckCircle size={12} /> : <Clock size={12} />}
                                    {doubt.status}
                                </div>
                            </div>

                            <div className="bg-slate-50 p-3 rounded-lg text-slate-700 text-sm mb-4 border border-slate-100">
                                <span className="font-bold text-slate-400 text-xs block mb-1">QUESTION:</span>
                                {doubt.question}
                            </div>

                            {doubt.status === 'Answered' ? (
                                <div className="bg-emerald-50 p-3 rounded-lg text-emerald-900 text-sm border border-emerald-100">
                                    <span className="font-bold text-emerald-600 text-xs block mb-1">YOUR ANSWER:</span>
                                    {doubt.answer}
                                </div>
                            ) : (
                                <button
                                    onClick={() => handleOpenReply(doubt)}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                                >
                                    <Send size={16} /> Reply to Student
                                </button>
                            )}

                            <div className="mt-3 text-right text-xs text-slate-400">
                                Asked on {new Date(doubt.created_at).toLocaleDateString('en-GB')}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Reply Modal */}
            {replyModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Reply to Doubt</h3>
                        <div className="bg-slate-50 p-4 rounded-lg mb-4 text-sm text-slate-600 italic border border-slate-200">
                            "{selectedDoubt?.question}"
                        </div>

                        <label className="block text-sm font-bold text-slate-700 mb-2">Your Answer</label>
                        <textarea
                            rows={5}
                            className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
                            placeholder="Type your explanation here..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                        />

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setReplyModalOpen(false)}
                                className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitReply}
                                className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all"
                            >
                                Send Reply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherDoubts;
