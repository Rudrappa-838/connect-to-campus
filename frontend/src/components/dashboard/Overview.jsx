import React, { useState, useEffect } from 'react';
import { Users, User, Calendar, Bell } from 'lucide-react';
import api from '../../api/axios';
import { useNavigate } from 'react-router-dom';

const Overview = ({ config }) => {
    const [stats, setStats] = useState({
        total: 0,
        male: 0,
        female: 0,
        teachers: 0,
        staff: 0,
        classDistribution: []
    });

    const [academicYear, setAcademicYear] = useState(null);
    const [pendingLeaves, setPendingLeaves] = useState([]);
    const navigate = useNavigate();



    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/schools/dashboard-stats');
                const data = res.data;

                setStats({
                    total: parseInt(data.total_students || 0),
                    male: parseInt(data.male_students || 0),
                    female: parseInt(data.female_students || 0),
                    teachers: parseInt(data.total_teachers || 0),
                    staff: parseInt(data.total_staff || 0),
                    classDistribution: data.classDistribution || []
                });
            } catch (error) {
                console.error('Error loading overview stats:', error);
            }
        };

        const fetchPendingLeaves = async () => {
            try {
                const res = await api.get('/leaves?status=Pending');
                setPendingLeaves(Array.isArray(res.data) ? res.data.slice(0, 5) : []);
            } catch (error) {
                console.error('Error loading pending leaves:', error);
            }
        };

        const fetchAcademicYear = async () => {
            try {
                const res = await api.get('/academic-years/current');
                if (res.data && res.data.notFound) {
                    setAcademicYear(null);
                } else {
                    setAcademicYear(res.data);
                }
            } catch (error) {
                console.error('Error loading academic year:', error);
            }
        };

        fetchStats();
        fetchPendingLeaves();
        fetchAcademicYear();
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <div className="overflow-hidden w-full mb-4 p-2">
                    <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-marquee-fast drop-shadow-sm uppercase tracking-wider font-serif italic">
                        {config?.name || 'My School'}
                    </p>
                </div>
            </div>

            {/* Academic Year Banner */}
            {academicYear && (
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl shadow-lg p-4 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5" />
                            <div>
                                <div className="text-xs font-medium opacity-90">Academic Year</div>
                                <div className="text-lg font-black">{academicYear.year_label}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-center">
                                <div className="text-2xl font-black">{academicYear.stats?.daysCompleted || 0}</div>
                                <div className="text-xs opacity-90">Days Passed</div>
                            </div>
                            <div className="h-10 w-px bg-white/30"></div>
                            <div className="text-center">
                                <div className="text-2xl font-black">{academicYear.stats?.daysRemaining || 0}</div>
                                <div className="text-xs opacity-90">Days Left</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* key Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users size={80} className="text-indigo-600" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Users size={24} />
                        </div>
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Total Students</p>
                    </div>
                    <h3 className="text-4xl font-black text-slate-800 tracking-tight">{stats.total}</h3>
                    <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <User size={80} className="text-emerald-600" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <User size={24} />
                        </div>
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Total Teachers</p>
                    </div>
                    <h3 className="text-4xl font-black text-slate-800 tracking-tight">{stats.teachers}</h3>
                    <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <User size={80} className="text-amber-600" />
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <User size={24} />
                        </div>
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Total Staff</p>
                    </div>
                    <h3 className="text-4xl font-black text-slate-800 tracking-tight">{stats.staff}</h3>
                    <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                </div>
            </div>

            {/* Class Distribution */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-slate-800">Class-wise Distribution</h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {stats.classDistribution.map((item, index) => (
                        <div key={item.name} className="relative group">
                            <div className="absolute inset-0 bg-indigo-500/5 rounded-xl transform rotate-3 scale-95 group-hover:rotate-6 transition-transform"></div>
                            <div className="relative p-6 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all group-hover:border-indigo-100">
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">Class</p>
                                <p className="text-lg font-black text-indigo-600 mb-1">{item.name}</p>
                                <p className="text-slate-600 font-medium text-sm">{item.count} Students</p>
                            </div>
                        </div>
                    ))}
                    {stats.classDistribution.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p>No class data available yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Overview;
