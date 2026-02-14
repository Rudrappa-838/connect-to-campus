import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Edit2, Trash2, CheckCircle, XCircle, TrendingUp, DollarSign, Users, BookOpen, X } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const AcademicYearSettings = () => {
    const [academicYears, setAcademicYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingYear, setEditingYear] = useState(null);
    const [stats, setStats] = useState(null);
    const [showStatsModal, setShowStatsModal] = useState(false);

    const [formData, setFormData] = useState({
        year_label: '',
        start_date: '',
        end_date: '',
        status: 'upcoming'
    });

    useEffect(() => {
        fetchAcademicYears();
    }, []);

    const fetchAcademicYears = async () => {
        try {
            const res = await api.get('/academic-years');
            setAcademicYears(res.data);
        } catch (error) {
            console.error('Error fetching academic years:', error);
            toast.error('Failed to load academic years');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingYear(null);
        setFormData({
            year_label: '',
            start_date: '',
            end_date: '',
            status: 'upcoming'
        });
        setShowModal(true);
    };

    const handleEdit = (year) => {
        setEditingYear(year);
        setFormData({
            year_label: year.year_label,
            start_date: year.start_date.split('T')[0],
            end_date: year.end_date.split('T')[0],
            status: year.status
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            if (editingYear) {
                await api.put(`/academic-years/${editingYear.id}`, formData);
                toast.success('Academic year updated successfully');
            } else {
                await api.post('/academic-years', formData);
                toast.success('Academic year created successfully');
            }

            setShowModal(false);
            fetchAcademicYears();
        } catch (error) {
            console.error('Error saving academic year:', error);
            toast.error(error.response?.data?.message || 'Failed to save academic year');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this academic year? This action cannot be undone.')) {
            return;
        }

        try {
            await api.delete(`/academic-years/${id}`);
            toast.success('Academic year deleted successfully');
            fetchAcademicYears();
        } catch (error) {
            console.error('Error deleting academic year:', error);
            toast.error(error.response?.data?.message || 'Failed to delete academic year');
        }
    };

    const handleComplete = async (id) => {
        if (!confirm('Mark this academic year as completed? This will allow you to set a new active year.')) {
            return;
        }

        try {
            await api.post(`/academic-years/${id}/complete`);
            toast.success('Academic year marked as completed');
            fetchAcademicYears();
        } catch (error) {
            console.error('Error completing academic year:', error);
            toast.error('Failed to complete academic year');
        }
    };

    const handleViewStats = async (id) => {
        try {
            const res = await api.get(`/academic-years/${id}/stats`);
            setStats(res.data);
            setShowStatsModal(true);
        } catch (error) {
            console.error('Error fetching stats:', error);
            toast.error('Failed to load statistics');
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            active: 'bg-green-100 text-green-800 border-green-200',
            completed: 'bg-slate-100 text-slate-800 border-slate-200',
            upcoming: 'bg-blue-100 text-blue-800 border-blue-200'
        };

        const icons = {
            active: <CheckCircle size={14} />,
            completed: <XCircle size={14} />,
            upcoming: <Calendar size={14} />
        };

        return (
            <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 flex items-center gap-1 ${badges[status]}`}>
                {icons[status]}
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                            <Calendar className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black">Academic Year Management</h2>
                            <p className="text-blue-100 text-sm">Manage academic years and track progress</p>
                        </div>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="bg-white text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                    >
                        <Plus size={20} />
                        New Academic Year
                    </button>
                </div>
            </div>

            {/* Academic Years List */}
            <div className="grid grid-cols-1 gap-4">
                {academicYears.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-2 border-dashed border-slate-300">
                        <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                        <h3 className="text-xl font-bold text-slate-800 mb-2">No Academic Years</h3>
                        <p className="text-slate-600 mb-4">Create your first academic year to get started</p>
                        <button
                            onClick={handleCreate}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Create Academic Year
                        </button>
                    </div>
                ) : (
                    academicYears.map((year) => (
                        <div
                            key={year.id}
                            className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 transition-all ${year.status === 'active' ? 'border-green-300 shadow-green-100' : 'border-slate-200'
                                }`}
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-2xl font-black text-slate-800">{year.year_label}</h3>
                                            {getStatusBadge(year.status)}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-slate-600">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={14} />
                                                {new Date(year.start_date).toLocaleDateString('en-GB')}
                                            </span>
                                            <span>→</span>
                                            <span className="flex items-center gap-1">
                                                <Calendar size={14} />
                                                {new Date(year.end_date).toLocaleDateString('en-GB')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleViewStats(year.id)}
                                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-lg font-bold text-sm transition-all"
                                        >
                                            <TrendingUp size={16} className="inline mr-1" />
                                            Stats
                                        </button>
                                        <button
                                            onClick={() => handleEdit(year)}
                                            className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-2 rounded-lg transition-all"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        {year.status === 'active' && (
                                            <button
                                                onClick={() => handleComplete(year.id)}
                                                className="bg-orange-50 hover:bg-orange-100 text-orange-600 px-4 py-2 rounded-lg font-bold text-sm transition-all"
                                            >
                                                Complete
                                            </button>
                                        )}
                                        {year.status !== 'active' && (
                                            <button
                                                onClick={() => handleDelete(year.id)}
                                                className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-lg transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {year.status === 'active' && (
                                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                                        <div className="text-sm font-bold text-green-800 mb-2">Current Academic Year</div>
                                        <div className="text-xs text-slate-600">
                                            All new data (attendance, marks, fees, etc.) will be associated with this year.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white rounded-t-2xl">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-black">
                                    {editingYear ? 'Edit Academic Year' : 'Create Academic Year'}
                                </h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Year Label <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.year_label}
                                    onChange={(e) => setFormData({ ...formData, year_label: e.target.value })}
                                    placeholder="e.g., 2026-2027"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Start Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    End Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Status <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    required
                                >
                                    <option value="upcoming">Upcoming</option>
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                </select>
                                <p className="text-xs text-slate-500 mt-1">
                                    Note: Setting as "Active" will mark other years as "Completed"
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all"
                                >
                                    {editingYear ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stats Modal */}
            {showStatsModal && stats && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
                        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white rounded-t-2xl">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-black">Academic Year Statistics</h3>
                                <button
                                    onClick={() => setShowStatsModal(false)}
                                    className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BookOpen className="w-5 h-5 text-blue-600" />
                                        <span className="text-xs font-bold text-blue-600 uppercase">Marks</span>
                                    </div>
                                    <div className="text-3xl font-black text-slate-800">{stats.total_marks}</div>
                                    <div className="text-xs text-slate-600">{stats.students_with_marks} students</div>
                                </div>

                                <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="w-5 h-5 text-green-600" />
                                        <span className="text-xs font-bold text-green-600 uppercase">Attendance</span>
                                    </div>
                                    <div className="text-3xl font-black text-slate-800">{stats.total_attendance}</div>
                                    <div className="text-xs text-slate-600">records</div>
                                </div>

                                <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DollarSign className="w-5 h-5 text-purple-600" />
                                        <span className="text-xs font-bold text-purple-600 uppercase">Fees Collected</span>
                                    </div>
                                    <div className="text-3xl font-black text-slate-800">₹{parseFloat(stats.total_fees_collected).toLocaleString()}</div>
                                    <div className="text-xs text-slate-600">{stats.total_fee_payments} payments</div>
                                </div>

                                <div className="bg-orange-50 rounded-xl p-4 border-2 border-orange-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DollarSign className="w-5 h-5 text-orange-600" />
                                        <span className="text-xs font-bold text-orange-600 uppercase">Salaries Paid</span>
                                    </div>
                                    <div className="text-3xl font-black text-slate-800">₹{parseFloat(stats.total_salaries_paid).toLocaleString()}</div>
                                    <div className="text-xs text-slate-600">{stats.total_salary_payments} payments</div>
                                </div>

                                <div className="bg-red-50 rounded-xl p-4 border-2 border-red-200 col-span-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="w-5 h-5 text-red-600" />
                                        <span className="text-xs font-bold text-red-600 uppercase">Expenditures</span>
                                    </div>
                                    <div className="text-3xl font-black text-slate-800">₹{parseFloat(stats.total_expenditure_amount).toLocaleString()}</div>
                                    <div className="text-xs text-slate-600">{stats.total_expenditures} transactions</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcademicYearSettings;
