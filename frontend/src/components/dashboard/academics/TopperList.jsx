import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { Trophy, Medal, Award, Printer } from 'lucide-react';

const TopperList = ({ config }) => {
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [schedules, setSchedules] = useState([]);
    const [selectedScheduleId, setSelectedScheduleId] = useState('');
    const [toppers, setToppers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [subjects, setSubjects] = useState([]);

    useEffect(() => {
        // Always fetch from API to ensure we have full data including IDs
        console.log('[Topper List] Fetching classes from API...');
        fetchClassesFromAPI();
    }, []);

    // Fallback: Fetch classes from API
    const fetchClassesFromAPI = async () => {
        try {
            // We use /schools/my-school because it returns classes WITH sections nested
            // Standard /classes endpoint only returns class names without sections
            const res = await api.get('/schools/my-school');
            if (res.data && res.data.classes && Array.isArray(res.data.classes)) {
                // Transform API response
                const formattedClasses = res.data.classes.map(cls => ({
                    id: cls.class_id,       // Map class_id to id
                    name: cls.class_name,   // Map class_name to name
                    sections: cls.sections || []
                }));
                console.log('[Topper List] Loaded classes with sections:', formattedClasses);
                setClasses(formattedClasses);
            }
        } catch (error) {
            console.error('[Topper List] Failed to fetch classes:', error);
        }
    };

    // Fetch exam schedules when class (and section) changes
    useEffect(() => {
        if (selectedClassId) {
            fetchSchedules();
        } else {
            setSchedules([]);
            setSelectedScheduleId('');
        }
    }, [selectedClassId, selectedSection]);

    const fetchSchedules = async () => {
        try {
            // Use selectedClassId directly (it is an ID)
            const params = { class_id: selectedClassId };

            // Add section_id if selected (Trusting it is an ID now)
            if (selectedSection) {
                console.log('[Topper List] Filtering schedules by Section ID:', selectedSection);
                params.section_id = selectedSection;
            }

            const res = await api.get('/exam-schedule', { params });
            console.log('[Topper List] Raw Schedules:', res.data);

            // Deduplicate schedules (Group by Exam Type + Month/Year)
            const uniqueMap = new Map();
            if (res.data && Array.isArray(res.data)) {
                res.data.forEach(s => {
                    const typeName = s.exam_type_name || s.exam_type || 'Unknown Exam';
                    const monthYear = s.month_year || '';
                    const key = `${typeName}-${monthYear}`;
                    if (!uniqueMap.has(key)) {
                        uniqueMap.set(key, s);
                    }
                });
            }

            // Sort new to old
            const uniqueSchedules = Array.from(uniqueMap.values()).sort((a, b) => b.id - a.id);
            setSchedules(uniqueSchedules);

            // Reset selection to force user to choose valid exam
            setSelectedScheduleId('');
        } catch (error) {
            console.error('Failed to fetch schedules:', error);
            setSchedules([]);
        }
    };

    // Get sections for selected class
    const getSectionsForClass = () => {
        if (!selectedClassId) return [];
        // Find class by ID
        const classObj = classes.find(c => c.id == selectedClassId);
        if (classObj) {
            return classObj.sections || [];
        }
        return [];
    };

    // Handle class change
    const handleClassChange = (classId) => {
        setSelectedClassId(classId);
        setSelectedSection(''); // Reset Section
        setSelectedScheduleId(''); // Reset Exam
        setToppers([]);
    };

    // Fetch toppers
    // Fetch toppers
    const fetchToppers = async () => {
        if (!selectedClassId || !selectedScheduleId) {
            toast.error('Please select all required fields');
            return;
        }

        const schedule = schedules.find(s => s.id == selectedScheduleId);
        if (!schedule) {
            toast.error('Invalid schedule selected');
            return;
        }

        // Find Class Name (for backward compatibility)
        const classObj = classes.find(c => c.id == selectedClassId);

        setLoading(true);
        try {
            // Send IDs (Primary) AND Names (Fallback for old backend)
            const params = {
                class_id: selectedClassId,
                class_name: classObj?.name, // Fallback
                exam_type_id: schedule.exam_type_id,
                exam_type: schedule.exam_type_name || schedule.exam_type, // Fallback
                schedule_id: selectedScheduleId
            };

            // Validation for Exam Type
            if (!params.exam_type && !params.exam_type_id) {
                console.error('[Topper List] Missing Exam Type info in schedule:', schedule);
                toast.error('Exam information is incomplete. Please select a valid exam.');
                setLoading(false);
                return;
            }

            console.log('[Topper List] Fetching toppers with params:', params);

            if (selectedSection) {
                console.log('[Topper List] Fetching toppers for Section ID:', selectedSection);
                params.section_id = selectedSection;

                // Fallback Section Name
                const sections = getSectionsForClass();
                const secObj = sections.find(s => s.id == selectedSection || s.name === selectedSection);
                if (secObj) {
                    params.section = secObj.name || secObj;
                }
            }

            const res = await api.get('/marks/toppers', { params });

            if (res.data && res.data.toppers) {
                setToppers(res.data.toppers);
                setSubjects(res.data.subjects || []);

                if (res.data.toppers.length === 0) {
                    toast('No marks data available for the selected criteria', { icon: '📊' });
                }
            }
        } catch (error) {
            console.error('Failed to fetch toppers:', error);
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message || 'Failed to load topper list';

            if (status === 404) {
                toast.error(`Not Found: ${message}`);
            } else if (status === 400) {
                toast.error(`Invalid Request: ${message}`);
            } else if (status === 500) {
                const detailedError = error.response?.data?.error;
                toast.error(`Server Error: ${message}${detailedError ? ' - ' + detailedError : ''}`);
            } else {
                toast.error(`Error: ${message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Get rank badge
    const getRankBadge = (rank) => {
        if (rank === 1) {
            return (
                <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-4 py-2 rounded-full font-black shadow-lg">
                    <Trophy className="w-5 h-5" />
                    <span>1st</span>
                </div>
            );
        } else if (rank === 2) {
            return (
                <div className="flex items-center gap-2 bg-gradient-to-r from-gray-300 to-gray-400 text-black px-4 py-2 rounded-full font-black shadow-lg">
                    <Medal className="w-5 h-5" />
                    <span>2nd</span>
                </div>
            );
        } else if (rank === 3) {
            return (
                <div className="flex items-center gap-2 bg-gradient-to-r from-orange-400 to-orange-500 text-white px-4 py-2 rounded-full font-black shadow-lg">
                    <Award className="w-5 h-5" />
                    <span>3rd</span>
                </div>
            );
        } else {
            return (
                <div className="flex items-center justify-center w-12 h-12 bg-slate-100 text-slate-700 rounded-full font-bold text-lg">
                    {rank}
                </div>
            );
        }
    };

    // Print function
    const handlePrint = () => {
        window.print();
    };


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl print:hidden">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                        <Trophy className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black">Class Toppers</h2>
                        <p className="text-indigo-100 text-sm">View top performing students by exam</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4 print:hidden">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Select Criteria</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Class Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Class *</label>
                        <select
                            value={selectedClassId}
                            onChange={(e) => handleClassChange(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        >
                            <option value="">Select Class</option>
                            {classes
                                .slice()
                                .sort((a, b) => {
                                    const nameA = a.name || a.class_name || '';
                                    const nameB = b.name || b.class_name || '';
                                    const numA = parseInt(nameA.replace(/\D/g, '') || '0', 10);
                                    const numB = parseInt(nameB.replace(/\D/g, '') || '0', 10);
                                    return numA === numB ? nameA.localeCompare(nameB) : numA - numB;
                                })
                                .map((cls, index) => {
                                    const name = cls.name || cls.class_name || `Class ${index + 1}`;
                                    return (
                                        <option key={cls.id || index} value={cls.id}>{name}</option>
                                    );
                                })}
                        </select>
                    </div>

                    {/* Section Selection (if applicable) */}
                    {selectedClassId && getSectionsForClass().length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Section</label>
                            <select
                                value={selectedSection}
                                onChange={(e) => {
                                    setSelectedSection(e.target.value);
                                    setToppers([]);
                                }}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            >
                                <option value="">All Sections</option>
                                {getSectionsForClass().map((section, idx) => {
                                    // Handle section object/string
                                    const sectionName = typeof section === 'object' ? section.name : section;
                                    const sectionValue = typeof section === 'object' ? section.id || section.name : section;
                                    return (
                                        <option key={`section-${idx}-${sectionValue}`} value={sectionValue}>
                                            {sectionName}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}

                    {/* Exam Selection (Consolidated) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Exam *</label>
                        <select
                            value={selectedScheduleId}
                            onChange={(e) => {
                                setSelectedScheduleId(e.target.value);
                                setToppers([]);
                            }}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            disabled={!selectedClassId}
                        >
                            <option value="">Select Exam</option>
                            {schedules.map((schedule) => (
                                <option key={schedule.id} value={schedule.id}>
                                    {schedule.month_year ? `${schedule.month_year} - ` : ''}{schedule.exam_type_name || schedule.exam_type}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Fetch Button */}
                <div className="flex justify-end pt-2">
                    <button
                        onClick={fetchToppers}
                        disabled={loading || !selectedClassId || !selectedScheduleId}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Loading...' : 'View Toppers'}
                        {!loading && <Trophy className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Toppers List */}
            {toppers.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden print:shadow-none print:rounded-none">
                    {/* Print Header */}
                    <div className="hidden print:block p-8 pb-4">
                        <div className="text-center border-b-2 border-slate-800 pb-2 mb-4">
                            <h1 className="text-2xl font-black uppercase tracking-wider text-slate-800 mb-2">Topper List Report</h1>
                            <div className="flex flex-wrap justify-center gap-4 text-sm font-bold text-slate-600">
                                <span>Class: {classes.find(c => c.id == selectedClassId)?.name}</span>
                                {selectedSection && <span>Section: {getSectionsForClass().find(s => s.id == selectedSection || s.name == selectedSection)?.name || selectedSection}</span>}
                                <span>Exam: {schedules.find(s => s.id == selectedScheduleId)?.exam_type_name || schedules.find(s => s.id == selectedScheduleId)?.exam_type}</span>
                                <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center print:hidden">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">
                                {classes.find(c => c.id == selectedClassId)?.name}
                                {selectedSection && ` - ${getSectionsForClass().find(s => s.id == selectedSection || s.name == selectedSection)?.name || selectedSection}`}
                                {' | '}
                                {schedules.find(s => s.id == selectedScheduleId)?.exam_type_name}
                            </h3>
                            <p className="text-sm text-slate-600">{toppers.length} Students</p>
                        </div>
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2"
                        >
                            <Printer className="w-4 h-4" />
                            Print
                        </button>
                    </div>

                    {/* Table */}
                    <div className="">
                        <table className="w-full table-fixed text-sm print:text-xs">
                            <thead className="bg-gradient-to-r from-slate-700 to-slate-800 text-white print:bg-none print:bg-slate-200 print:text-black">
                                <tr>
                                    <th className="px-2 py-2 text-left font-bold uppercase w-10">#</th>
                                    <th className="px-2 py-2 text-left font-bold uppercase w-32">Student</th>
                                    {subjects.map((subject) => (
                                        <th key={subject} className="px-1 py-1 text-center font-bold uppercase truncate max-w-[80px]" title={subject}>
                                            {subject.slice(0, 3)}
                                        </th>
                                    ))}
                                    <th className="px-2 py-2 text-center font-bold uppercase bg-indigo-600 print:bg-slate-300 w-16">Total</th>
                                    <th className="px-2 py-2 text-center font-bold uppercase bg-purple-600 print:bg-slate-300 w-16">%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 print:divide-slate-300">
                                {toppers.map((student, index) => {
                                    // Format Name Logic: First Name + Father's Initial + Surname Initial(s)
                                    const formatName = (fullName, fatherName) => {
                                        if (!fullName) return '';
                                        const parts = fullName.trim().split(/\s+/);
                                        const firstName = parts[0];

                                        // Father's Initial
                                        let fatherInitial = '';
                                        if (fatherName) {
                                            fatherInitial = fatherName.trim().charAt(0).toUpperCase();
                                        }

                                        // Last Name / Surname Initials (from the name string parts)
                                        // We skip the first part (First Name). 
                                        // We also check if any part closely matches father's name to avoid duplication (basic check)
                                        const lastInitials = parts.slice(1)
                                            .filter(p => !fatherName || p.toLowerCase() !== fatherName.toLowerCase()) // Avoid full father name if present
                                            .map(p => p.charAt(0).toUpperCase())
                                            .join(' ');

                                        let result = firstName;
                                        if (fatherInitial) result += ` ${fatherInitial}`;
                                        if (lastInitials) result += ` ${lastInitials}`;

                                        return result;
                                    };

                                    return (
                                        <tr
                                            key={student.student_id}
                                            className={`hover:bg-slate-50 transition-colors ${index === 0 ? 'bg-yellow-50' :
                                                index === 1 ? 'bg-gray-50' :
                                                    index === 2 ? 'bg-orange-50' : ''
                                                }`}
                                        >
                                            <td className="px-2 py-2 font-bold">
                                                {index + 1}
                                            </td>
                                            <td className="px-2 py-2">
                                                <div className="font-bold text-slate-800 truncate leading-tight" title={student.student_name}>
                                                    {formatName(student.student_name, student.father_name)}
                                                </div>
                                                {student.section && (
                                                    <div className="text-[10px] text-slate-500">{student.section}</div>
                                                )}
                                            </td>
                                            {subjects.map((subject) => (
                                                <td key={subject} className="px-1 py-1 text-center">
                                                    <span className="inline-block px-1.5 py-0.5 rounded font-bold text-slate-700 bg-slate-100 print:bg-transparent">
                                                        {student.marks[subject] !== undefined ? student.marks[subject] : '-'}
                                                    </span>
                                                </td>
                                            ))}
                                            <td className="px-2 py-2 text-center bg-indigo-50 print:bg-transparent">
                                                <span className="font-black text-indigo-700 print:text-black">
                                                    {student.total_marks}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 text-center bg-purple-50 print:bg-transparent">
                                                <span className="font-black text-purple-700 print:text-black">
                                                    {student.percentage.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && toppers.length === 0 && selectedClassId && selectedScheduleId && (
                <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trophy className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No Data Available</h3>
                    <p className="text-slate-600">No marks have been entered for the selected criteria yet.</p>
                </div>
            )}
        </div>
    );
};

export default TopperList;
