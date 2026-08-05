import React, { useState, useEffect } from 'react';
import { Calendar, Award, BookOpen, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const StudentAcademics = () => {
    const [activeTab, setActiveTab] = useState('schedule'); // schedule | marks | analytics
    const [profile, setProfile] = useState(null);
    const [examTypes, setExamTypes] = useState([]);
    const [selectedExam, setSelectedExam] = useState('');
    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const [schedule, setSchedule] = useState([]);
    const [marksheet, setMarksheet] = useState(null);
    const [loading, setLoading] = useState(false);

    const [schoolConfig, setSchoolConfig] = useState(null);
    const [assignment, setAssignment] = useState(null);
    const [subjectGroups, setSubjectGroups] = useState([]);

    const [allExamsHistory, setAllExamsHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedHistoryExam, setSelectedHistoryExam] = useState(null);
    const [hoveredPoint, setHoveredPoint] = useState(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        if (profile) {
            fetchYears();
            fetchExamTypes();
            fetchSchoolConfig();
            fetchStudentCombination();
            fetchOverallHistory();
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

    const fetchSchoolConfig = async () => {
        try {
            const res = await api.get('/schools/my-school');
            setSchoolConfig(res.data?.data || res.data || {});
        } catch (error) {
            console.error("Failed to load school config", error);
        }
    };

    const fetchStudentCombination = async () => {
        if (!profile) return;
        try {
            const [asnRes, grpRes] = await Promise.all([
                api.get(`/subject-groups/assignments/student/${profile.id}`),
                api.get('/subject-groups/groups')
            ]);
            setAssignment(asnRes.data || null);
            setSubjectGroups(grpRes.data || []);
        } catch (error) {
            console.error("Failed to load combination data", error);
        }
    };

    const isSubjectAssignedToStudent = (subjectId, targetBatch = null) => {
        const className = (profile?.class_name || '').toLowerCase().trim();
        const isPUC = className === 'class 1' || 
                      className === 'class 2' || 
                      className.includes('11') || 
                      className.includes('12') || 
                      className.includes('puc') || 
                      className.includes('pu') || 
                      className === '1' || 
                      className === '2';

        // Check target batch compatibility first (only for PUC classes and if exam batches enabled)
        if (isPUC && targetBatch && schoolConfig?.has_exam_batches === true && profile) {
            const sBatches = (profile.exam_batch || '').toLowerCase().split(',').map(b => b.trim()).filter(Boolean);
            const tBatch = targetBatch.toLowerCase().trim();
            if (!sBatches.includes(tBatch)) {
                return false;
            }
        }

        // Guard 1: Only apply combinations if enabled for this school
        if (schoolConfig?.has_subject_combinations !== true) {
            return true;
        }
        
        if (!isPUC) return true;
        
        if (!assignment) return false;
        
        // Check if assigned via group
        if (assignment.group_id) {
            const group = subjectGroups.find(g => g.id === assignment.group_id);
            if (group && Array.isArray(group.subjects)) {
                const hasSubject = group.subjects.some(s => 
                    parseInt(s.id) === parseInt(subjectId) || 
                    parseInt(s.subject_id) === parseInt(subjectId)
                );
                if (hasSubject) return true;
            }
        }
        
        // Check if assigned via custom subjects
        if (Array.isArray(assignment.chosen_subjects)) {
            const hasSubject = assignment.chosen_subjects.some(id => 
                parseInt(id) === parseInt(subjectId)
            );
            if (hasSubject) return true;
        }
        
        return false;
    };

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

    const fetchOverallHistory = async () => {
        if (!profile?.admission_no) return;
        setHistoryLoading(true);
        try {
            const res = await api.get('/marks/student-all', {
                params: { admission_no: profile.admission_no }
            });
            const exams = res.data?.exams || [];
            setAllExamsHistory(exams);
            if (exams.length > 0) {
                setSelectedHistoryExam(exams[exams.length - 1]);
            }
        } catch (error) {
            console.error("Failed to load overall exam history", error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const renderAnalyticsContent = () => {
        const paddingLeft = 55;
        const paddingRight = 30;
        const paddingTop = 25;
        const paddingBottom = 40;
        const chartWidth = 600 - paddingLeft - paddingRight;
        const chartHeight = 240 - paddingTop - paddingBottom;

        const points = allExamsHistory.map((exam, index) => {
            const pct = parseFloat(exam.percentage || 0);
            const x = allExamsHistory.length > 1 
                ? paddingLeft + (index / (allExamsHistory.length - 1)) * chartWidth 
                : paddingLeft + chartWidth / 2;
            const y = paddingTop + chartHeight - (pct / 100) * chartHeight;
            return { x, y, exam, index };
        });

        // SVG lines / paths
        let linePath = "";
        let areaPath = "";

        if (allExamsHistory.length > 1) {
            linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
            areaPath = `M ${points[0].x} ${paddingTop + chartHeight} L ${points[0].x} ${points[0].y} ` + 
                       points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + 
                       ` L ${points[points.length - 1].x} ${paddingTop + chartHeight} Z`;
        }

        const selectedExamDetails = selectedHistoryExam || allExamsHistory[allExamsHistory.length - 1];

        return (
            <div className="space-y-6">
                {/* Chart Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-500" />
                                Performance Trend
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">Overall academic progress across all exam terms</p>
                        </div>
                        <div className="text-xs text-slate-400 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            Click nodes to inspect details
                        </div>
                    </div>

                    {/* Interactive SVG Chart Container */}
                    <div className="relative w-full overflow-hidden">
                        <svg viewBox="0 0 600 240" className="w-full h-auto overflow-visible">
                            <defs>
                                <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>

                            {/* Grid Lines at 0%, 25%, 50%, 75%, 100% */}
                            {[0, 25, 50, 75, 100].map((val) => {
                                const y = paddingTop + chartHeight - (val / 100) * chartHeight;
                                return (
                                    <g key={val}>
                                        <line 
                                            x1={paddingLeft} 
                                            y1={y} 
                                            x2={paddingLeft + chartWidth} 
                                            y2={y} 
                                            stroke="#f1f5f9" 
                                            strokeWidth="1.5" 
                                        />
                                        <text 
                                            x={paddingLeft - 10} 
                                            y={y} 
                                            textAnchor="end" 
                                            alignmentBaseline="middle" 
                                            fill="#94a3b8" 
                                            fontSize="10" 
                                            fontWeight="700"
                                        >
                                            {val}%
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Main Graph Area/Line */}
                            {allExamsHistory.length > 1 ? (
                                <>
                                    <path d={areaPath} fill="url(#chartAreaGradient)" />
                                    <path 
                                        d={linePath} 
                                        fill="none" 
                                        stroke="#4f46e5" 
                                        strokeWidth="3.5" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round" 
                                    />
                                </>
                            ) : (
                                <line 
                                    x1={paddingLeft} 
                                    y1={points[0].y} 
                                    x2={paddingLeft + chartWidth} 
                                    y2={points[0].y} 
                                    stroke="#818cf8" 
                                    strokeWidth="2.5" 
                                    strokeDasharray="4 4" 
                                />
                            )}

                            {/* Dots/Interactive Nodes */}
                            {points.map((p) => {
                                const isSelected = selectedExamDetails?.exam_name === p.exam.exam_name;
                                return (
                                    <g key={p.index}>
                                        {/* Point Glow */}
                                        {isSelected && (
                                            <circle 
                                                cx={p.x} 
                                                cy={p.y} 
                                                r="12" 
                                                fill="#4f46e5" 
                                                fillOpacity="0.15" 
                                            />
                                        )}
                                        {/* Main Circle */}
                                        <circle 
                                            cx={p.x} 
                                            cy={p.y} 
                                            r={isSelected ? 6 : 4.5} 
                                            fill={isSelected ? "#ffffff" : "#4f46e5"} 
                                            stroke="#4f46e5" 
                                            strokeWidth={isSelected ? 4 : 2}
                                            style={{ transition: 'all 0.15s ease-in-out' }}
                                        />
                                        {/* Percentage Label */}
                                        <text
                                            x={p.x}
                                            y={p.y - 12}
                                            textAnchor="middle"
                                            fill="#4f46e5"
                                            fontSize="10"
                                            fontWeight="800"
                                            className="select-none pointer-events-none"
                                        >
                                            {parseFloat(p.exam.percentage).toFixed(1)}%
                                        </text>
                                        {/* Larger Touch/Hover Area */}
                                        <circle
                                            cx={p.x}
                                            cy={p.y}
                                            r="18"
                                            fill="transparent"
                                            className="cursor-pointer"
                                            onClick={() => setSelectedHistoryExam(p.exam)}
                                            onMouseEnter={() => setHoveredPoint(p.index)}
                                            onMouseLeave={() => setHoveredPoint(null)}
                                        />
                                    </g>
                                );
                            })}

                            {/* X-Axis Labels */}
                            {points.map((p) => {
                                const isSelected = selectedExamDetails?.exam_name === p.exam.exam_name;
                                const displayName = p.exam.exam_name.length > 12 
                                    ? `${p.exam.exam_name.slice(0, 10)}...` 
                                    : p.exam.exam_name;
                                return (
                                    <text 
                                        key={p.index}
                                        x={p.x} 
                                        y={paddingTop + chartHeight + 20} 
                                        textAnchor="middle" 
                                        fill={isSelected ? "#4f46e5" : "#64748b"} 
                                        fontSize="10" 
                                        fontWeight={isSelected ? "700" : "600"}
                                        className="cursor-pointer select-none"
                                        onClick={() => setSelectedHistoryExam(p.exam)}
                                    >
                                        {displayName}
                                    </text>
                                );
                            })}
                        </svg>

                        {/* Tooltip Overlay */}
                        {hoveredPoint !== null && (
                            <div 
                                className="absolute bg-slate-900/95 text-white text-xs rounded-xl p-3 shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full flex flex-col gap-1 z-20 border border-slate-800 transition-all duration-150"
                                style={{ 
                                    left: `${(points[hoveredPoint].x / 600) * 100}%`, 
                                    top: `${(points[hoveredPoint].y / 240) * 100 - 6}%` 
                                }}
                            >
                                <span className="font-extrabold whitespace-nowrap text-slate-100">{points[hoveredPoint].exam.exam_name}</span>
                                <span className="text-indigo-400 font-black text-sm">{parseFloat(points[hoveredPoint].exam.percentage).toFixed(2)}%</span>
                                <span className="text-slate-400 text-[10px] whitespace-nowrap font-medium">
                                    {points[hoveredPoint].exam.total_obtained} / {points[hoveredPoint].exam.total_max} Marks
                                </span>
                                <div className="absolute left-1/2 bottom-0 w-2 h-2 bg-slate-900/95 border-r border-b border-slate-800 transform -translate-x-1/2 translate-y-1/2 rotate-45"></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Selected Exam Detailed Summary Card */}
                {selectedExamDetails && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <span className="text-indigo-200 text-xs uppercase font-extrabold tracking-wider">Exam Analysis</span>
                                    <h3 className="text-2xl font-black mt-0.5">{selectedExamDetails.exam_name}</h3>
                                </div>
                                <div className="flex gap-6">
                                    <div className="text-center md:text-left">
                                        <div className="text-indigo-200 text-xs uppercase font-bold mb-0.5">Total Marks</div>
                                        <div className="text-2xl font-black">
                                            {selectedExamDetails.total_obtained} 
                                            <span className="text-sm opacity-70 font-normal"> / {selectedExamDetails.total_max}</span>
                                        </div>
                                    </div>
                                    <div className="text-center md:text-left border-l border-white/20 pl-6">
                                        <div className="text-indigo-200 text-xs uppercase font-bold mb-0.5">Overall Percentage</div>
                                        <div className="text-2xl font-black">{parseFloat(selectedExamDetails.percentage).toFixed(2)}%</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Subject-wise Marks Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="p-4">Subject Name</th>
                                        <th className="p-4 text-center">Max Marks</th>
                                        <th className="p-4 text-center">Marks Obtained</th>
                                        <th className="p-4">Subject Percentage</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {selectedExamDetails.subjects.map((sub, idx) => {
                                        const subPct = sub.max > 0 ? ((sub.marks / sub.max) * 100) : 0;
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 font-bold text-slate-800">{sub.subject}</td>
                                                <td className="p-4 text-center text-slate-500">{sub.max}</td>
                                                <td className="p-4 text-center font-extrabold text-indigo-600 text-base">{sub.marks}</td>
                                                <td className="p-4 font-bold text-slate-700 min-w-[200px]">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-12 text-xs font-bold">{subPct.toFixed(1)}%</span>
                                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-indigo-500 rounded-full" 
                                                                style={{ width: `${subPct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
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
                        <button
                            onClick={() => setActiveTab('analytics')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Performance Analytics
                        </button>
                    </div>
                </div>

                {activeTab !== 'analytics' && (
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
                )}
            </div>

            {/* Content Area */}
            {activeTab === 'analytics' ? (
                historyLoading ? (
                    <div className="text-center py-12 text-slate-400">Loading performance analytics...</div>
                ) : allExamsHistory.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 border-dashed">
                        <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-bold text-lg">No Results Found</p>
                        <p className="text-slate-400 text-sm mt-1">We couldn't find any recorded exam results for performance analytics.</p>
                    </div>
                ) : (
                    renderAnalyticsContent()
                )
            ) : selectedExam ? (
                loading ? (
                    <div className="text-center py-12 text-slate-400">Loading data...</div>
                ) : (
                    <>
                        {activeTab === 'schedule' && (() => {
                            const filteredSchedule = schedule.filter(item => isSubjectAssignedToStudent(item.subject_id, item.target_batch));
                            return (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    {filteredSchedule.length === 0 ? (
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
                                                    {filteredSchedule.map((item) => (
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
                            );
                        })()}

                        {activeTab === 'marks' && (() => {
                            const filteredMarks = marksheet ? marksheet.marks.filter(mark => {
                                const schItem = schedule.find(s => s.subject_id === mark.subject_id);
                                return isSubjectAssignedToStudent(mark.subject_id, schItem?.target_batch);
                            }) : [];
                            const summaryTotalMarks = filteredMarks.reduce((sum, m) => sum + parseFloat(m.marks_obtained || 0), 0);
                            const summaryMaxMarks = filteredMarks.reduce((sum, m) => sum + parseFloat(m.max_marks || 0), 0);
                            const summaryPercentage = summaryMaxMarks > 0 ? ((summaryTotalMarks / summaryMaxMarks) * 100).toFixed(2) : 0;
                            
                            return (
                                <div className="space-y-6">
                                    {marksheet ? (
                                        <>
                                            {/* Summary Card */}
                                            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                                                    <div>
                                                        <div className="text-indigo-200 text-xs uppercase font-bold mb-1">Total Marks</div>
                                                        <div className="text-3xl font-black">{summaryTotalMarks} <span className="text-lg opacity-60 font-normal">/ {summaryMaxMarks}</span></div>
                                                    </div>
                                                    <div>
                                                        <div className="text-indigo-200 text-xs uppercase font-bold mb-1">Percentage</div>
                                                        <div className="text-3xl font-black">{summaryPercentage}%</div>
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
                                                        {filteredMarks.map((mark) => (
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
                            );
                        })()}
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
