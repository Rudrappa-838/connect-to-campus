import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Send, User, BookOpen } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const StudentDoubts = () => {
    const [doubts, setDoubts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [formData, setFormData] = useState({
        subject_id: '',
        teacher_id: '',
        question: ''
    });

    useEffect(() => {
        fetchDoubts();
        fetchOptions();
    }, []);

    const fetchDoubts = async () => {
        try {
            const res = await api.get('/doubts/student');
            setDoubts(res.data);
        } catch (error) {
            console.error(error); // fail silently often
        } finally {
            setLoading(false);
        }
    };

    const fetchOptions = async () => {
        try {
            // Fetch Teachers
            const tRes = await api.get('/teachers');
            setTeachers(tRes.data);

            // Fetch Subjects (using generic list for now)
            const sRes = await api.get('/teachers/subjects'); // Reusing existing endpoint
            setSubjects(sRes.data);
        } catch (error) {
            console.error("Error fetching options", error);
        }
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isSubmitting || isSubmittingRef.current) return;

        if (!formData.question || !formData.teacher_id) {
            return toast.error("Please fill required fields");
        }

        setIsSubmitting(true);
        isSubmittingRef.current = true;

        try {
            const payload = {
                teacher_id: formData.teacher_id,
                question: formData.question
            };

            // Only include subject_id if it has a value
            if (formData.subject_id) {
                payload.subject_id = formData.subject_id;
            }

            await api.post('/doubts', payload);

            toast.success("Doubt sent successfully!");
            setShowForm(false);
            setFormData({ subject_id: '', teacher_id: '', question: '' });
            fetchDoubts();
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || "Failed to send doubt";
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <MessageSquare className="text-indigo-600" /> My Doubts & Questions
                </h3>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2 transition-all"
                >
                    <Plus size={18} /> Ask New Doubt
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-lg animate-in fade-in slide-in-from-top-4">
                    <h4 className="font-bold text-slate-700 mb-4">Ask a Question</h4>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Teacher</label>
                                <select
                                    className="w-full p-3 border rounded-lg bg-slate-50"
                                    value={formData.teacher_id}
                                    onChange={e => {
                                        const tId = e.target.value;
                                        const selectedTeacher = teachers.find(t => t.id == tId);
                                        // Attempt to get subject_id if it exists on teacher object, else null
                                        const sId = selectedTeacher?.subject_id || null;
                                        setFormData({
                                            ...formData,
                                            teacher_id: tId,
                                            subject_id: sId
                                        });
                                    }}
                                    required
                                >
                                    <option value="">-- Choose Teacher --</option>
                                    {teachers.map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.subject_specialization})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Your Question</label>
                            <textarea
                                className="w-full p-3 border rounded-lg bg-slate-50 h-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Describe your doubt clearly..."
                                value={formData.question}
                                onChange={e => setFormData({ ...formData, question: e.target.value })}
                                required
                            ></textarea>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg" disabled={isSubmitting}>Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" disabled={isSubmitting}>
                                <Send size={18} /> {isSubmitting ? 'Sending...' : 'Submit Question'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="text-center py-10 text-slate-400">Loading history...</div>
            ) : doubts.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                    <p className="text-slate-400 font-medium">You haven't asked any questions yet.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {doubts.map(doubt => (
                        <div key={doubt.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="bg-slate-100 p-2 rounded-full">
                                        <User size={16} className="text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">To: {doubt.teacher_name}</h4>
                                        <p className="text-xs text-slate-400">{new Date(doubt.created_at).toLocaleDateString('en-GB')}</p>
                                    </div>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded font-bold ${doubt.status === 'Answered' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {doubt.status}
                                </div>
                            </div>

                            <div className="ml-10">
                                <p className="text-slate-800 font-medium mb-3">{doubt.question}</p>

                                {doubt.answer && (
                                    <div className="bg-indigo-50 p-4 rounded-lg text-sm text-indigo-900 border border-indigo-100 mt-2 relative">
                                        <div className="absolute top-0 left-4 -mt-2 w-4 h-4 bg-indigo-50 border-t border-l border-indigo-100 transform rotate-45"></div>
                                        <p className="font-bold text-indigo-700 text-xs mb-1">TEACHER'S REPLY:</p>
                                        {doubt.answer}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StudentDoubts;
