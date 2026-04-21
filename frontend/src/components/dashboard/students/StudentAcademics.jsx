import React, { useState, useEffect } from 'react';
import { Calendar, Award, BookOpen, Clock, AlertCircle } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const StudentAcademics = () => {
    const [activeTab, setActiveTab] = useState('schedule'); // schedule | marks
    const [profile, setProfile] = useState(null);
    const [examTypes, setExamTypes] = useState([]);
    const [selectedExam, setSelectedExam] = useState('');
    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const [schedule, setSchedule] = useState([]);
    const [marksheet, setMarksheet] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchProfile();
        fetchExamTypes();
    }, []);

    useEffect(() => {
        if (profile) {
            fetchYears();
            fetchExamTypes();
        }
    }, [profile]);

    useEffect(() => {
        if (selectedExam && profile) {
            if (activeTab === 'schedule') {
                fetchSchedule();
            } else {
                fetchMarks();
            }
        }
    }, [selectedExam, activeTab, profile, selectedYear]);

    const fetchProfile = async () => {
        try {
            const res = await api.get('/students/profile');
            setProfile(res.data);
        } catch (error) {
            console.error("Failed to load profile", error);
        }
    };

    const fetchYears = async () => {
        if (!profile) return;
        try {
            const res = await api.get('/marks/marksheet/years', { params: { student_id: profile.id } });
            if (res.data && res.data.length > 0) {
                setYears(res.data);
                // Default to latest year if current selection is not in list (optional, but good UX)
                if (!res.data.includes(selectedYear)) {
                    setSelectedYear(res.data[0]);
                }
            } else {
                // If no years found (new student), keep current year
                setYears([new Date().getFullYear()]);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchExamTypes = async () => {
        try {
            const params = {};
            if (profile) {
                params.class_id = profile.class_id;
                params.student_id = profile.id;
            }
            const res = await api.get('/marks/exam-types', { params });
            setExamTypes(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSchedule = async () => {
        if (!selectedExam || !profile) return;
        setLoading(true);
        console.log('Fetching schedule for:', { exam: selectedExam, class: profile.class_id, section: profile.section_id });
        try {
            const res = await api.get('/exam-schedule', {
                params: {
                    exam_type_id: selectedExam,
                    class_id: profile.class_id,
                    section_id: profile.section_id
                }
            });
            console.log('Schedule fetched:', res.data);
            setSchedule(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch schedule');
        } finally {
            setLoading(false);
        }
    };

    const fetchMarks = async () => {
        if (!selectedExam || !profile) return;
        setLoading(true);
        try {
            const res = await api.get('/marks/marksheet/student', {
                params: {
                    student_id: profile.id,
                    exam_type_id: selectedExam,
                    year: selectedYear
                }
            });
            setMarksheet(res.data);
        } catch (error) {
            console.error(error);
            // toast.error('Failed to fetch marks'); // Silent fail or user friendly message
            setMarksheet(null);
        } finally {
            setLoading(false);
        }
    };

    const formatTime12Hour = (time24) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-GB');
    };

    if (!profile) return <div className="text-center py-20 text-slate-400">Loading academic details...</div>;

    return (
        <div className="space-y-6">
            {/* Header / Controls */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Academics & Exams</h3>
                        <p className="text-sm text-slate-500 font-medium">
                            {profile.class_name}{profile.section_name ? ` - ${profile.section_name}` : ''}
                        </p>
                    </div>

                    <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('schedule')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'schedule' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Exam Schedule
                        </button>
                        <button
                            onClick={() => setActiveTab('marks')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'marks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            My Results
                        </button>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="max-w-xs flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Exam</label>
                        <select
                            value={selectedExam}
                            onChange={(e) => setSelectedExam(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium"
                        >
                            <option value="">-- Choose an Exam --</option>
                            {examTypes.map((exam) => (
                                <option key={exam.id} value={exam.id}>{exam.name}</option>
                            ))}
                        </select>
                    </div>
                    {activeTab === 'marks' && (
                        <div className="w-32">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Year</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium"
                            >
                                {years.length > 0 ? (
                                    years.map(y => <option key={y} value={y}>{y}</option>)
                                ) : (
                                    <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                                )}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            {selectedExam ? (
                loading ? (
                    <div className="text-center py-12 text-slate-400">Loading data...</div>
                ) : (
                    <>
                        {activeTab === 'schedule' && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                {schedule.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500 font-medium">No schedule published for this exam yet.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="p-4">Date</th>
                                                    <th className="p-4">Time</th>
                                                    <th className="p-4">Subject</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {schedule.map((item) => (
                                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-4 font-bold text-slate-800">{formatDate(item.exam_date)}</td>
                                                        <td className="p-4 text-slate-600 font-medium flex items-center gap-2">
                                                            <Clock size={16} className="text-indigo-400" />
                                                            {formatTime12Hour(item.start_time)} - {formatTime12Hour(item.end_time)}
                                                        </td>
                                                        <td className="p-4 font-bold text-indigo-600">{item.subject_name}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'marks' && (
                            <div className="space-y-6">
                                {marksheet ? (
                                    <>
                                        {/* Summary Card */}
                                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                                                <div>
                                                    <div className="text-indigo-200 text-xs uppercase font-bold mb-1">Total Marks</div>
                                                    <div className="text-3xl font-black">{marksheet.summary.total_marks} <span className="text-lg opacity-60 font-normal">/ {marksheet.summary.max_marks}</span></div>
                                                </div>
                                                <div>
                                                    <div className="text-indigo-200 text-xs uppercase font-bold mb-1">Percentage</div>
                                                    <div className="text-3xl font-black">{marksheet.summary.percentage}%</div>
                                                </div>
                                                <div>
                                                    <div className="text-indigo-200 text-xs uppercase font-bold mb-1">Admission No</div>
                                                    <div className="text-xl font-bold font-mono mt-1">{profile.admission_no}</div>
                                                </div>
                                                <div>
                                                    <div className="text-indigo-200 text-xs uppercase font-bold mb-1">Result Status</div>
                                                    <div className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full font-bold text-sm mt-1">
                                                        <Award size={14} /> Passed
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Marks Table */}
                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold border-b border-slate-200">
                                                    <tr>
                                                        <th className="p-4">Subject</th>
                                                        <th className="p-4 text-center">Max Marks</th>
                                                        <th className="p-4 text-center">Obtained</th>
                                                        <th className="p-4">Remarks</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {marksheet.marks.map((mark) => (
                                                        <tr key={mark.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-4 font-bold text-slate-800">{mark.subject_name}</td>
                                                            <td className="p-4 text-center text-slate-500">{mark.max_marks}</td>
                                                            <td className="p-4 text-center font-bold text-indigo-600 text-lg">{mark.marks_obtained}</td>
                                                            <td className="p-4 text-slate-500 italic text-xs">{mark.remarks || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                ) : (
                                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 border-dashed">
                                        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-slate-500 font-bold text-lg">Results Not Available</p>
                                        <p className="text-slate-400 text-sm mt-1">Marks for this exam haven't been published yet.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )
            ) : (
                <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
                    <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-700">Select an Exam</h3>
                    <p className="text-slate-500 max-w-xs mx-auto mt-2">Please select an exam type from the dropdown above to view the schedule or your results.</p>
                </div>
            )}
        </div>
    );
};

export default StudentAcademics;
