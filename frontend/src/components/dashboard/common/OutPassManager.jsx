import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { LogOut, LogIn, Clock, FileText, AlertCircle, CheckCircle2, History } from 'lucide-react';

const OutPassManager = ({ personType = 'TEACHER' }) => {
    const [passes, setPasses] = useState([]);
    const [activePass, setActivePass] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchPasses();
    }, []);

    const fetchPasses = async () => {
        setLoading(true);
        try {
            const res = await api.get('/out-passes/my');
            const data = res.data || [];
            setPasses(data);
            const active = data.find(p => p.status === 'OUT');
            setActivePass(active || null);
        } catch (error) {
            console.error('Failed to fetch out passes', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckout = async (e) => {
        e.preventDefault();
        if (!reason.trim()) return toast.error('Please enter a reason');
        setSubmitting(true);
        try {
            await api.post('/out-passes', { reason });
            toast.success('Out pass created! Stay safe 👋');
            setReason('');
            setShowModal(false);
            fetchPasses();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create out pass');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCheckIn = async (passId) => {
        if (!window.confirm('Mark yourself as returned?')) return;
        try {
            await api.put(`/out-passes/${passId}/checkin`);
            toast.success("Welcome back! ✅");
            fetchPasses();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to check in');
        }
    };

    const formatTime = (ts) => {
        if (!ts) return '--';
        return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const formatDate = (ts) => {
        if (!ts) return '--';
        return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getDuration = (checkout, checkin) => {
        if (!checkout) return '--';
        const end = checkin ? new Date(checkin) : new Date();
        const start = new Date(checkout);
        const mins = Math.floor((end - start) / 60000);
        if (mins < 60) return `${mins} min`;
        const hrs = Math.floor(mins / 60);
        const rem = mins % 60;
        return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
    };

    if (loading) {
        return <div className="flex items-center justify-center py-20 text-slate-400">Loading...</div>;
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {/* Status Card */}
            <div className={`rounded-2xl p-6 border shadow-sm transition-all ${activePass
                ? 'bg-amber-50 border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activePass ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                            {activePass
                                ? <AlertCircle size={24} className="text-amber-600" />
                                : <CheckCircle2 size={24} className="text-emerald-600" />
                            }
                        </div>
                        <div>
                            <p className={`font-bold text-lg ${activePass ? 'text-amber-800' : 'text-emerald-800'}`}>
                                {activePass ? '🔴 Currently OUT' : '🟢 On Campus'}
                            </p>
                            {activePass ? (
                                <p className="text-sm text-amber-600">
                                    Left at {formatTime(activePass.checkout_time)} • {getDuration(activePass.checkout_time, null)} ago
                                </p>
                            ) : (
                                <p className="text-sm text-emerald-600">You are currently on campus</p>
                            )}
                        </div>
                    </div>

                    {activePass ? (
                        <button
                            onClick={() => handleCheckIn(activePass.id)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                            <LogIn size={18} /> I'm Back
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                            <LogOut size={18} /> Going Out
                        </button>
                    )}
                </div>

                {/* Active pass reason */}
                {activePass && (
                    <div className="mt-4 pt-4 border-t border-amber-200">
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Reason</p>
                        <p className="text-sm text-amber-800 font-medium">{activePass.reason}</p>
                    </div>
                )}
            </div>

            {/* History */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                    <History size={18} className="text-slate-400" />
                    <h3 className="font-bold text-slate-700">My Out Pass History</h3>
                </div>

                {passes.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                        <FileText size={40} className="mx-auto mb-3 opacity-30" />
                        <p>No out passes yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {passes.map(p => (
                            <div key={p.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-800 text-sm mb-1">{p.reason}</p>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Clock size={11} />
                                                {formatDate(p.checkout_time)} • {formatTime(p.checkout_time)}
                                            </span>
                                            {p.checkin_time && (
                                                <span className="flex items-center gap-1">
                                                    <LogIn size={11} /> Back: {formatTime(p.checkin_time)}
                                                </span>
                                            )}
                                            <span className="font-bold">
                                                Duration: {getDuration(p.checkout_time, p.checkin_time)}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                        p.status === 'OUT'
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                        {p.status === 'OUT' ? '🔴 Out' : '✅ Returned'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                <LogOut size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">Going Outside?</h3>
                                <p className="text-xs text-slate-500">Please provide a reason for leaving</p>
                            </div>
                        </div>

                        <form onSubmit={handleCheckout} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Reason for Leaving *</label>
                                <textarea
                                    autoFocus
                                    required
                                    rows={4}
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="e.g. Bank work, Doctor appointment, Official duty..."
                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none resize-none text-sm transition-all"
                                />
                            </div>

                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setReason(''); }}
                                    className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    <LogOut size={16} />
                                    {submitting ? 'Submitting...' : 'Checkout'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OutPassManager;
