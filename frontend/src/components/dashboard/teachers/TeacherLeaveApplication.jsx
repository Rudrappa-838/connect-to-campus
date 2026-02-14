import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Clock, CheckCircle, XCircle, FileText } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const TeacherLeaveApplication = () => {
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        leave_type: 'Casual Leave',
        start_date: '',
        end_date: '',
        reason: ''
    });

    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        fetchLeaves();
    }, []);

    const fetchLeaves = async () => {
        try {
            const res = await api.get('/leaves/my-leaves');
            setLeaves(res.data);
        } catch (error) {
            console.error("Failed to fetch leaves", error);
            // toast.error("Failed to load leave history");
        } finally {
            setLoading(false);
        }
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isSubmitting || isSubmittingRef.current) return;

        // Basic Validation
        if (!formData.start_date || !formData.end_date || !formData.reason) {
            return toast.error("Please fill all required fields");
        }

        if (new Date(formData.end_date) < new Date(formData.start_date)) {
            return toast.error("End date cannot be before start date");
        }

        setIsSubmitting(true);
        isSubmittingRef.current = true;

        try {
            await api.post('/leaves/my-leaves', formData);
            toast.success("Leave application submitted successfully!");
            setShowForm(false);
            setFormData({
                leave_type: 'Casual Leave',
                start_date: '',
                end_date: '',
                reason: ''
            });
            fetchLeaves();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || "Failed to submit application");
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Approved': return <CheckCircle size={18} className="text-emerald-500" />;
            case 'Rejected': return <XCircle size={18} className="text-rose-500" />;
            default: return <Clock size={18} className="text-amber-500" />;
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Approved': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'Rejected': return 'bg-rose-50 text-rose-700 border-rose-100';
            default: return 'bg-amber-50 text-amber-700 border-amber-100';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="text-indigo-600" /> Leave Management
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">Apply for leaves and track status.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-200"
                >
                    <Plus size={18} /> Apply for Leave
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg animate-in fade-in slide-in-from-top-4">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <FileText size={18} className="text-slate-500" /> New Leave Application
                    </h4>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Leave Type</label>
                                <select
                                    className="w-full p-3 border rounded-lg bg-slate-50 font-medium"
                                    value={formData.leave_type}
                                    onChange={e => setFormData({ ...formData, leave_type: e.target.value })}
                                >
                                    <option>Casual Leave</option>
                                    <option>Sick Leave</option>
                                    <option>Earned Leave</option>
                                    <option>Unpaid Leave</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                                <input
                                    type="date"
                                    className="w-full p-3 border rounded-lg bg-slate-50"
                                    value={formData.start_date}
                                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    required
                                    min={today}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                                <input
                                    type="date"
                                    className="w-full p-3 border rounded-lg bg-slate-50"
                                    value={formData.end_date}
                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                    required
                                    min={formData.start_date || today}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason for Leave</label>
                            <textarea
                                className="w-full p-3 border rounded-lg bg-slate-50 h-24 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                placeholder="Please describe the reason..."
                                value={formData.reason}
                                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                required
                            ></textarea>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg" disabled={isSubmitting}>Cancel</button>
                            <button type="submit" className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed" disabled={isSubmitting}>
                                {isSubmitting ? 'Sending...' : 'Submit Application'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List View */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-100">
                            <tr>
                                <th className="p-4 pl-6">Applied On</th>
                                <th className="p-4">Period</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">Reason</th>
                                <th className="p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading leave history...</td></tr>
                            ) : leaves.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-400">No leave applications found.</td></tr>
                            ) : (
                                leaves.map(leave => (
                                    <tr key={leave.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 pl-6 text-slate-500">
                                            {new Date(leave.created_at).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="p-4 font-medium text-slate-700">
                                            {new Date(leave.start_date).toLocaleDateString('en-GB')} <span className="text-slate-400 px-1">to</span> {new Date(leave.end_date).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="p-4 text-slate-700">
                                            {leave.leave_type}
                                        </td>
                                        <td className="p-4 text-slate-500 max-w-xs truncate" title={leave.reason}>
                                            {leave.reason}
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${getStatusStyle(leave.status)}`}>
                                                {getStatusIcon(leave.status)}
                                                {leave.status || 'Pending'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TeacherLeaveApplication;
