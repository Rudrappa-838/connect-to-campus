import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, AlertCircle, Plus, Settings } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const AcademicYearWidget = ({ onManageClick }) => {
    const [academicYear, setAcademicYear] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCurrentAcademicYear();
    }, []);

    const fetchCurrentAcademicYear = async () => {
        try {
            const res = await api.get('/academic-years/current');
            if (res.data && res.data.notFound) {
                setAcademicYear(null);
            } else {
                setAcademicYear(res.data);
            }
        } catch (error) {
            console.error('Error fetching academic year:', error);
            if (error.response?.status !== 404) {
                toast.error('Failed to load academic year');
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/2 mb-4"></div>
                <div className="h-20 bg-slate-200 rounded"></div>
            </div>
        );
    }

    if (!academicYear) {
        return (
            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl shadow-lg p-6 border-2 border-dashed border-orange-300">
                <div className="flex items-start gap-4">
                    <div className="bg-orange-100 p-3 rounded-xl">
                        <AlertCircle className="w-6 h-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-800 mb-1">No Active Academic Year</h3>
                        <p className="text-sm text-slate-600 mb-3">
                            Set up an academic year to start tracking attendance, marks, and fees.
                        </p>
                        <button
                            onClick={onManageClick}
                            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                        >
                            <Plus size={16} />
                            Create Academic Year
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const { stats } = academicYear;
    const isNearingEnd = stats.isNearingEnd;
    const hasEnded = stats.hasEnded;

    // Determine color scheme based on status
    let bgGradient = 'from-blue-500 to-cyan-600';
    let progressColor = 'bg-blue-600';
    let alertBg = 'bg-yellow-50 border-yellow-200';
    let alertText = 'text-yellow-800';
    let alertIcon = 'text-yellow-600';

    if (hasEnded) {
        bgGradient = 'from-red-500 to-pink-600';
        progressColor = 'bg-red-600';
        alertBg = 'bg-red-50 border-red-200';
        alertText = 'text-red-800';
        alertIcon = 'text-red-600';
    } else if (isNearingEnd) {
        bgGradient = 'from-orange-500 to-amber-600';
        progressColor = 'bg-orange-600';
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-200">
            {/* Header */}
            <div className={`bg-gradient-to-r ${bgGradient} p-6 text-white`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-medium opacity-90">Academic Year</h3>
                            <h2 className="text-2xl font-black">{academicYear.year_label}</h2>
                        </div>
                    </div>
                    <button
                        onClick={onManageClick}
                        className="bg-white/20 hover:bg-white/30 p-2 rounded-lg backdrop-blur-sm transition-all"
                        title="Manage Academic Years"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                        <span>{stats.percentageCompleted}% Complete</span>
                        <span>{stats.daysRemaining} days left</span>
                    </div>
                    <div className="bg-white/20 rounded-full h-3 overflow-hidden backdrop-blur-sm">
                        <div
                            className="bg-white h-full rounded-full transition-all duration-500 shadow-lg"
                            style={{ width: `${Math.min(stats.percentageCompleted, 100)}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-bold text-slate-500 uppercase">Completed</span>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{stats.daysCompleted}</div>
                        <div className="text-xs text-slate-500">days</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-bold text-slate-500 uppercase">Remaining</span>
                        </div>
                        <div className="text-2xl font-black text-slate-800">{stats.daysRemaining}</div>
                        <div className="text-xs text-slate-500">days</div>
                    </div>
                </div>

                {/* Alert Messages */}
                {hasEnded && (
                    <div className={`${alertBg} border-2 rounded-xl p-4`}>
                        <div className="flex items-start gap-3">
                            <AlertCircle className={`w-5 h-5 ${alertIcon} flex-shrink-0 mt-0.5`} />
                            <div className="flex-1">
                                <h4 className={`font-bold ${alertText} mb-1`}>Academic Year Ended</h4>
                                <p className="text-sm text-slate-600 mb-3">
                                    This academic year has ended. Create a new year to continue operations.
                                </p>
                                <button
                                    onClick={onManageClick}
                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                                >
                                    <Plus size={16} />
                                    Set Up New Year
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isNearingEnd && !hasEnded && (
                    <div className={`${alertBg} border-2 rounded-xl p-4`}>
                        <div className="flex items-start gap-3">
                            <AlertCircle className={`w-5 h-5 ${alertIcon} flex-shrink-0 mt-0.5`} />
                            <div className="flex-1">
                                <h4 className={`font-bold ${alertText} mb-1`}>
                                    {stats.daysRemaining} Days Remaining
                                </h4>
                                <p className="text-sm text-slate-600 mb-3">
                                    The academic year is ending soon. Prepare to set up the next year.
                                </p>
                                <button
                                    onClick={onManageClick}
                                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                                >
                                    <Plus size={16} />
                                    Prepare Next Year
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!isNearingEnd && !hasEnded && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-lg">
                                <Calendar className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-green-800">Year in Progress</h4>
                                <p className="text-sm text-slate-600">
                                    {new Date(academicYear.start_date).toLocaleDateString()} - {new Date(academicYear.end_date).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AcademicYearWidget;
