import React, { useState, useEffect } from 'react';
import { Calendar, Search, ArrowRight } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const TeacherMyTimetable = () => {
    const [timetable, setTimetable] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('personal'); // 'personal' | 'search'
    const [searchParams, setSearchParams] = useState({ class_id: '', section_id: '' });
    const [classes, setClasses] = useState([]); // For search
    const [searchResults, setSearchResults] = useState([]);

    useEffect(() => {
        fetchPersonalTimetable();
        fetchClasses();
    }, []);

    const fetchPersonalTimetable = async () => {
        setLoading(true);
        try {
            const res = await api.get('/timetable/teacher');
            setTimetable(res.data);
        } catch (error) {
            console.error('Failed to load timetable', error);
            // Don't toast error if it's just empty
        } finally {
            setLoading(false);
        }
    };

    const fetchClasses = async () => {
        try {
            const res = await api.get('/academic-config');
            setClasses(res.data.classes || []);
        } catch (error) {
            console.error('Failed to load classes', error);
        }
    };

    const handleSearch = async () => {
        if (!searchParams.class_id || !searchParams.section_id) {
            toast.error('Please select both Class and Section');
            return;
        }

        try {
            const res = await api.get('/timetable', {
                params: {
                    class_id: searchParams.class_id,
                    section_id: searchParams.section_id
                }
            });
            setSearchResults(res.data);
            setViewMode('search');
        } catch (error) {
            toast.error('Failed to fetch class timetable');
        }
    };

    const periods = [
        { num: 1, time: '08:00 - 08:45' },
        { num: 2, time: '08:45 - 09:30' },
        { num: 3, time: '09:30 - 10:15' },
        { num: 4, time: '10:30 - 11:15' },
        { num: 5, time: '11:15 - 12:00' },
        { num: 6, time: '12:00 - 12:45' },
        { num: 7, time: '13:30 - 14:15' }
    ];

    const days = [
        { id: 1, name: 'Monday' },
        { id: 2, name: 'Tuesday' },
        { id: 3, name: 'Wednesday' },
        { id: 4, name: 'Thursday' },
        { id: 5, name: 'Friday' },
        { id: 6, name: 'Saturday' }
    ];

    const renderTimetableGrid = (data) => (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
            <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                    <tr>
                        <th className="p-4 w-28 text-center bg-slate-50/50 sticky left-0 z-10 border-r border-slate-100">Day / Period</th>
                        {periods.map(p => (
                            <th key={p.num} className="p-4 text-center min-w-[120px]">
                                <div className="text-slate-800">Period {p.num}</div>
                                <div className="text-[10px] text-slate-400 font-medium mt-1">{p.time}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {days.map(day => (
                        <tr key={day.id} className="hover:bg-slate-50/30 transition-colors">
                            <td className="p-4 font-bold text-slate-700 text-center bg-slate-50/30 sticky left-0 border-r border-slate-100">
                                {day.name}
                            </td>
                            {periods.map(period => {
                                const slot = data.find(t => t.day_of_week === day.id && t.period_number === period.num);
                                return (
                                    <td key={period.num} className="p-2 border-r border-slate-50 last:border-0 align-top h-24">
                                        {slot ? (
                                            <div className={`h-full w-full rounded-lg p-2 flex flex-col justify-center items-center text-center gap-1 shadow-sm border transition-all hover:scale-105 ${viewMode === 'personal'
                                                ? 'bg-indigo-50 border-indigo-100 text-indigo-800' // Personal style
                                                : 'bg-emerald-50 border-emerald-100 text-emerald-800' // General style
                                                }`}>
                                                <div className="font-bold text-sm line-clamp-2">{slot.subject_name}</div>
                                                <div className="text-[10px] font-semibold opacity-70 bg-white/50 px-2 py-0.5 rounded-full">
                                                    {viewMode === 'personal'
                                                        ? `${slot.class_name} - ${slot.section_name}` // Show Class for teacher view
                                                        : slot.teacher_name || 'No Teacher'           // Show Teacher for class view
                                                    }
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="h-full w-full rounded-lg border border-dashed border-slate-100 flex items-center justify-center text-[10px] text-slate-300">
                                                Free
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header / Mode Switcher */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="text-indigo-600" />
                        {viewMode === 'personal' ? 'My Teaching Schedule' : 'Class Timetable Search'}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        {viewMode === 'personal'
                            ? 'View your assigned classes for the week.'
                            : 'Search and view timetable for any class.'}
                    </p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setViewMode('personal')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'personal' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        My Schedule
                    </button>
                    <button
                        onClick={() => setViewMode('search')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'search' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        View Class Timetable
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === 'personal' ? (
                loading ? (
                    <div className="text-center py-20 text-slate-400">Loading schedule...</div>
                ) : timetable.length > 0 ? (
                    renderTimetableGrid(timetable)
                ) : (
                    <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar className="text-slate-300 w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">No Classes Assigned</h3>
                        <p className="text-slate-500">Your schedule for this week is currently empty.</p>
                    </div>
                )
            ) : (
                <div className="space-y-6">
                    {/* Search Controls */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Class</label>
                            <select
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                value={searchParams.class_id}
                                onChange={e => setSearchParams({ ...searchParams, class_id: e.target.value, section_id: '' })}
                            >
                                <option value="">Select Class</option>
                                {classes.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        {classes.find(c => c.class_id === parseInt(searchParams.class_id))?.sections?.length > 0 && (
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Section</label>
                                <select
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                                    value={searchParams.section_id}
                                    onChange={e => setSearchParams({ ...searchParams, section_id: e.target.value })}
                                    disabled={!searchParams.class_id}
                                >
                                    <option value="">Select Section</option>
                                    {classes.find(c => c.class_id === parseInt(searchParams.class_id))?.sections.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <button
                            onClick={handleSearch}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2"
                        >
                            <Search size={16} /> View Timetable
                        </button>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {renderTimetableGrid(searchResults)}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Select a class and section to view its timetable.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TeacherMyTimetable;
