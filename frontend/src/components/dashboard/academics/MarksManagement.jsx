import React, { useState, useEffect } from 'react';
import { Award, Download, Save, Printer, Eye, Plus, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

const MarksManagement = ({ config }) => {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [examSchedule, setExamSchedule] = useState([]);
    const [grades, setGrades] = useState([]); // Grade configuration
    const [examTypes, setExamTypes] = useState([]);
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [marks, setMarks] = useState({});
    const [loading, setLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showExamModal, setShowExamModal] = useState(false);
    const [showMarksheetModal, setShowMarksheetModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [marksheetData, setMarksheetData] = useState(null);
    const [scheduledExams, setScheduledExams] = useState([]);
    const [scheduledPeriod, setScheduledPeriod] = useState(''); // Text to display e.g., "Jan 2026 - Feb 2026"

    // Fetch Schedule Period when Exam Type changes
    useEffect(() => {
        if (selectedExam) {
            fetchExamPeriod(selectedExam);
        } else {
            setScheduledPeriod('');
        }
    }, [selectedExam]);

    const fetchExamPeriod = async (examId) => {
        try {
            // We need an endpoint or just fetch schedule list logic
            // Reusing existing: /exam-schedule?exam_type_id=...
            // Note: This fetches ALL schedules for this exam type across all classes.
            setScheduledPeriod('Fetching...');
            const res = await api.get('/exam-schedule', { params: { exam_type_id: examId } });

            if (res.data && res.data.length > 0) {
                const dates = res.data.map(s => new Date(s.exam_date));
                const min = new Date(Math.min(...dates));
                const max = new Date(Math.max(...dates));

                const minStr = min.toLocaleDateString('default', { month: 'short', year: 'numeric' });
                const maxStr = max.toLocaleDateString('default', { month: 'short', year: 'numeric' });

                if (minStr === maxStr) {
                    setScheduledPeriod(minStr);
                } else {
                    setScheduledPeriod(`${minStr} - ${maxStr}`);
                }
            } else {
                setScheduledPeriod('No schedule found');
            }
        } catch (error) {
            console.error(error);
            setScheduledPeriod('Error fetching period');
        }
    };

    useEffect(() => {
        if (selectedClass) {
            fetchScheduledExams();
        }
    }, [selectedClass, selectedSection]);

    const fetchScheduledExams = async () => {
        try {
            let url = `/exam-schedule?class_id=${selectedClass}`;
            if (selectedSection) url += `&section_id=${selectedSection}`;

            const res = await api.get(url);
            const uniqueExams = [];
            const seen = new Set();

            if (Array.isArray(res.data)) {
                res.data.forEach(sch => {
                    if (!seen.has(sch.exam_type_id)) {
                        seen.add(sch.exam_type_id);
                        uniqueExams.push({
                            id: sch.exam_type_id,
                            name: sch.exam_type_name
                        });
                    }
                });
            }
            setScheduledExams(uniqueExams);
        } catch (error) {
            console.error('Error fetching schedules:', error);
        }
    };

    const handleSelectScheduledExam = (examId) => {
        setSelectedExam(examId);
        setShowExamModal(false);
    };

    // New Exam with Components
    const [newExam, setNewExam] = useState({
        name: '',
        max_marks: 100,
        weightage: 0,
        start_month: new Date().getMonth() + 1,
        end_month: new Date().getMonth() + 1,
        components: []
    });

    const sections = config?.classes?.find(c => c.class_id === parseInt(selectedClass))?.sections || [];

    const months = [
        'January', 'February', 'March', '"April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Year dropdown: Show current year and past years only (back to 2020 or when school was added)
    const currentYear = new Date().getFullYear();
    const startYear = 2020; // Or fetch from school.created_at in future
    const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => currentYear - i);


    useEffect(() => {
        fetchExamTypes();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            fetchSubjects();
        }
    }, [selectedClass]);

    useEffect(() => {
        if (selectedClass) {
            const hasSections = sections.length > 0;
            // logic: If sections exist, wait for section selection. If no sections, fetch immediately.
            if (hasSections && !selectedSection) return;
            fetchStudents();
        }
    }, [selectedClass, selectedSection]);

    useEffect(() => {
        if (selectedClass && selectedExam) {
            const hasSections = sections.length > 0;
            if (hasSections && !selectedSection) return;
            fetchMarks();
        }
    }, [selectedClass, selectedSection, selectedExam, selectedYear]);

    // ...

    const fetchExamTypes = async () => {
        try {
            const examsRes = await api.get('/marks/exam-types');
            setExamTypes(examsRes.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchGrades = async () => {
        if (!selectedExam) {
            setGrades([]);
            return;
        }

        try {
            const gradesRes = await api.get('/grades', {
                params: { exam_type_id: selectedExam }
            });
            setGrades(gradesRes.data);
        } catch (error) {
            console.error('Error fetching grades:', error);
            setGrades([]);
        }
    };

    // Fetch grades when exam type changes
    useEffect(() => {
        fetchGrades();
    }, [selectedExam]);

    const fetchSubjects = async () => {
        if (!selectedClass) return;
        try {
            const res = await api.get(`/classes/${selectedClass}/subjects`);
            setSubjects(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSchedule = async () => {
        if (selectedExam && selectedClass) {
            try {
                const sectionIdVal = selectedSection ? parseInt(selectedSection) : null;
                const scheduleRes = await api.get('/exam-schedule', {
                    params: {
                        class_id: selectedClass,
                        section_id: sectionIdVal || undefined,
                        exam_type_id: selectedExam
                    }
                });
                setExamSchedule(scheduleRes.data);
            } catch (err) {
                console.error("Failed to fetch schedule components", err);
                setExamSchedule([]);
            }
        }
    };

    useEffect(() => {
        fetchSchedule();
    }, [selectedExam, selectedClass, selectedSection]);



    const fetchStudents = async () => {
        try {
            let url = `/students?class_id=${selectedClass}`;
            if (selectedSection) url += `&section_id=${selectedSection}`;

            const res = await api.get(url);
            const studentsList = res.data.data || res.data || [];
            setStudents(studentsList);
        } catch (error) {
            console.error('Error fetching students:', error);
        }
    };

    const fetchMarks = async () => {
        if (!selectedClass || !selectedExam) return;

        setMarks({}); // Clear marks before fetching to avoid stale keys
        try {
            let url = `/marks?class_id=${selectedClass}&exam_type_id=${selectedExam}&year=${selectedYear}`;
            if (selectedSection) url += `&section_id=${selectedSection}`;

            console.log('[Fetch Marks] ========== REQUEST DETAILS ==========');
            console.log('[Fetch Marks] selectedClass:', selectedClass);
            console.log('[Fetch Marks] selectedSection:', selectedSection || 'NULL');
            console.log('[Fetch Marks] selectedExam:', selectedExam);
            console.log('[Fetch Marks] selectedYear:', selectedYear);
            console.log('[Fetch Marks] Full URL:', url);
            console.log('[Fetch Marks] ==========================================');

            const res = await api.get(url);
            const existingMarks = {};

            console.log('[Fetch Marks] Received:', res.data?.length || 0, 'marks');
            console.log('[Fetch Marks] Raw data:', res.data);

            // Populate marks object from fetched data
            if (res.data && Array.isArray(res.data)) {
                res.data.forEach(mark => {
                    const key = `${mark.student_id}-${mark.subject_id}`;
                    console.log(`[Fetch Marks] Processing mark: student_id=${mark.student_id}, subject_id=${mark.subject_id}, marks=${mark.marks_obtained}`);
                    if (mark.component_scores && Object.keys(mark.component_scores).length > 0) {
                        existingMarks[key] = {
                            total: mark.marks_obtained,
                            components: mark.component_scores
                        };
                    } else {
                        existingMarks[key] = mark.marks_obtained;
                    }
                });
            }

            console.log('[Fetch Marks] Loaded into state:', Object.keys(existingMarks).length, 'marks');
            console.log('[Fetch Marks] State keys:', Object.keys(existingMarks));
            setMarks(existingMarks);
            toast.success(`Loaded ${Object.keys(existingMarks).length} marks`);
        } catch (error) {
            console.error('Error fetching marks:', error);
            toast.error('Failed to load marks');
        }
    };

    // ...

    // Helper functions for Exam Components
    const addComponent = () => {
        setNewExam({
            ...newExam,
            components: [...newExam.components, { name: '', max_marks: 0 }]
        });
    };

    const removeComponent = (index) => {
        const updated = newExam.components.filter((_, i) => i !== index);
        setNewExam({ ...newExam, components: updated });
    };

    const updateComponent = (index, field, value) => {
        const updated = [...newExam.components];
        updated[index][field] = value;
        setNewExam({ ...newExam, components: updated });
    };



    const handleCreateExamType = async () => {
        if (isSubmitting) return;

        if (!newExam.name) {
            toast.error('Please enter exam name');
            return;
        }

        // Validate components if present
        if (newExam.components.length > 0) {
            const totalComponentMarks = newExam.components.reduce((sum, c) => sum + parseInt(c.max_marks || 0), 0);
            if (totalComponentMarks !== parseInt(newExam.max_marks)) {
                toast.error(`Component marks must add up to ${newExam.max_marks}`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            await api.post('/marks/exam-types', newExam);
            toast.success('Exam type created!');
            setNewExam({ name: '', max_marks: 100, weightage: 0, start_month: new Date().getMonth() + 1, end_month: new Date().getMonth() + 1, components: [] });
            setShowExamModal(false);
            fetchExamTypes();
        } catch (error) {
            toast.error('Failed to create exam type');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMarkChange = (studentId, subjectId, value, componentName = null) => {
        const key = `${studentId}-${subjectId}`;
        const newMarks = { ...marks };

        // Find the schedule item for this subject to get max marks for validation
        const scheduleItem = examSchedule.find(s => s.subject_id === subjectId);
        const componentsConfig = scheduleItem?.components || [];

        if (componentName) {
            // Updating a component score
            const existing = newMarks[key] || { total: '', components: {} };
            const currentComponents = existing.components || {};

            // Validate component mark against its max_marks
            const componentMaxMarks = componentsConfig.find(c => c.name === componentName)?.max_marks || Infinity;
            if (parseFloat(value) > componentMaxMarks) {
                toast.error(`Marks for ${componentName} cannot exceed ${componentMaxMarks}`);
                return;
            }

            currentComponents[componentName] = value;

            // Calculate new total
            let total = 0;
            Object.values(currentComponents).forEach(v => total += (parseFloat(v) || 0));

            newMarks[key] = {
                total: total,
                components: currentComponents
            };
        } else {
            // Simple total mark update (no components for this subject)
            const subjectMaxMarks = scheduleItem?.max_marks || selectedExamType?.max_marks || 100;
            if (parseFloat(value) > subjectMaxMarks) {
                toast.error(`Marks cannot exceed ${subjectMaxMarks}`);
                return;
            }
            newMarks[key] = value;
        }
        setMarks(newMarks);
    };

    const handleViewMarksheet = async (student) => {
        if (!selectedExam) return;

        try {
            const studentMarks = [];
            let totalObtained = 0;
            let totalMax = 0;

            // Filter subjects for marksheet as well
            const scheduledSubjectIds = new Set(examSchedule?.map(s => s.subject_id) || []);
            const subjectsToDisplay = subjects.filter(sub => scheduledSubjectIds.has(sub.id));

            subjectsToDisplay.forEach(sub => {
                let subObtained = 0;
                let subMax = 0;
                let subMin = 0;
                let componentBreakdown = [];

                const key = `${student.id}-${sub.id}`;
                const markEntry = marks[key];
                const scheduleItem = examSchedule.find(s => s.subject_id === sub.id);
                let componentsConfig = scheduleItem?.components || [];
                // Handle if components is a JSON string
                if (typeof componentsConfig === 'string') {
                    try { componentsConfig = JSON.parse(componentsConfig); } catch (e) { componentsConfig = []; }
                }
                const hasComponentsForSubject = componentsConfig.length > 0;

                // Get min marks from schedule
                subMin = parseFloat(scheduleItem?.min_marks || selectedExamType?.min_marks || 35);

                if (hasComponentsForSubject) {
                    // Calculate max marks by summing components
                    subMax = componentsConfig.reduce((sum, comp) => sum + (parseFloat(comp.max_marks) || 0), 0);

                    if (markEntry && typeof markEntry === 'object' && markEntry.components) {
                        subObtained = parseFloat(markEntry.total) || 0;

                        // Build component breakdown
                        componentBreakdown = componentsConfig.map(comp => ({
                            name: comp.name,
                            max_marks: parseFloat(comp.max_marks) || 0,
                            min_marks: parseFloat(comp.min_marks) || 0,
                            marks_obtained: parseFloat(markEntry.components[comp.name]) || 0
                        }));
                    }
                } else {
                    subObtained = parseFloat(markEntry) || 0;
                    subMax = parseFloat(scheduleItem?.max_marks || selectedExamType?.max_marks || 100);
                }

                totalObtained += subObtained;
                totalMax += subMax;

                studentMarks.push({
                    id: sub.id,
                    subject_name: sub.name,
                    max_marks: subMax,
                    min_marks: subMin,
                    marks_obtained: subObtained,
                    exam_name: selectedExamType.name,
                    components: componentBreakdown,
                    hasComponents: hasComponentsForSubject
                });
            });

            const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(2) : 0;

            // Calculate Grade
            const grade = grades.find(g => parseFloat(percentage) >= parseFloat(g.min_percentage) && parseFloat(percentage) <= parseFloat(g.max_percentage));

            setMarksheetData({
                student: {
                    name: student.name,
                    roll_number: student.roll_number,
                    class_name: config.classes.find(c => c.class_id === parseInt(selectedClass))?.class_name,
                    section_name: sections.find(s => s.id === parseInt(selectedSection))?.name || 'N/A'
                },
                marks: studentMarks,
                summary: {
                    total_marks: totalObtained,
                    max_marks: totalMax,
                    percentage: percentage,
                    grade: grade ? grade.name : '-'
                }
            });

            setShowMarksheetModal(true);
        } catch (error) {
            console.error(error);
        }
    };

    const selectedExamType = examTypes.find(e => e.id === parseInt(selectedExam));
    // const hasComponents = selectedExamType?.components?.length > 0; // This is now dynamic per subject

    const handleSave = async () => {
        if (loading) return;
        if (!selectedExam) {
            toast.error('Please select an exam type');
            return;
        }

        const marksArray = [];
        const sectionIdVal = selectedSection ? parseInt(selectedSection) : null;

        Object.keys(marks).forEach(key => {
            const [studentId, subjectId] = key.split('-');
            const markData = marks[key];

            // Skip ONLY if completely empty (not 0, which is valid)
            if (markData === '' || markData === undefined || markData === null) return;

            // For object type (with components), check if total is empty string
            if (typeof markData === 'object' && markData !== null) {
                // If it's an object but total is empty string and no components, skip
                if (markData.total === '' && (!markData.components || Object.keys(markData.components).length === 0)) {
                    return;
                }
            }

            let finalMark = 0;
            let componentScores = {};

            if (typeof markData === 'object' && markData !== null && markData.total !== undefined) {
                finalMark = parseFloat(markData.total) || 0;
                componentScores = markData.components || {};
            } else {
                finalMark = parseFloat(markData) || 0;
            }

            marksArray.push({
                student_id: parseInt(studentId),
                class_id: parseInt(selectedClass),
                section_id: sectionIdVal,
                subject_id: parseInt(subjectId),
                exam_type_id: parseInt(selectedExam),
                marks_obtained: finalMark,
                component_scores: componentScores
            });
        });

        if (marksArray.length === 0) {
            toast.error('Please enter at least one mark');
            return;
        }

        console.log('Sending marks to backend:', marksArray);
        console.log(`Total marks to save: ${marksArray.length}`);

        setLoading(true);
        try {
            const response = await api.post('/marks/save', { marks: marksArray, year: selectedYear });
            toast.success(`Successfully saved ${marksArray.length} marks!`);
            fetchMarks(); // Reload marks to show saved data
        } catch (error) {
            toast.error('Failed to save marks');
            console.error('Save error:', error);
            console.error('Error response:', error.response?.data);
        } finally {
            setLoading(false);
        }
    };

    // ...

    const handlePrintAll = async () => {
        if (!selectedClass || !selectedExam) {
            toast.error('Please select class and exam type');
            return;
        }

        const hasSections = sections.length > 0;
        if (hasSections && !selectedSection) {
            toast.error('Please select a section');
            return;
        }

        try {
            let url = `/marks/marksheet/all?class_id=${selectedClass}&exam_type_id=${selectedExam}`;
            if (selectedSection) url += `&section_id=${selectedSection}`;

            const res = await api.get(url);
            console.log('All marksheets:', res.data);
            toast.success('Opening print preview...');
            setTimeout(() => window.print(), 500);
        } catch (error) {
            toast.error('Failed to generate marksheets');
            console.error(error);
        }
    };

    const handlePrintMarksheet = () => {
        window.print();
    };

    // Ensure we also show subjects that already have marks, even if the schedule was deleted.
    const scheduledSubjectIds = new Set(examSchedule?.map(s => parseInt(s.subject_id)) || []);
    
    // Add subjects from existing marks so columns don't disappear if schedule is deleted later
    Object.keys(marks).forEach(key => {
        const [studentId, subjectId] = key.split('-');
        if (subjectId) {
            scheduledSubjectIds.add(parseInt(subjectId));
        }
    });

    const displaySubjects = subjects.filter(sub => scheduledSubjectIds.has(parseInt(sub.id)));

    return (
        <div className="space-y-6 animate-in fade-in">


            {/* Header - Same as before */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl shadow-lg p-6 text-white print:hidden">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Award size={28} />
                    Marks Management
                </h2>
                <p className="text-amber-50 mt-1">Enter and manage student marks with component support</p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 print:hidden">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Class</label>
                        <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(''); setSelectedExam(''); }} className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm">
                            <option value="">Select Class</option>
                            {config?.classes
                                ?.slice()
                                .sort((a, b) => {
                                    const numA = parseInt(a.class_name.replace(/\D/g, '') || '0', 10);
                                    const numB = parseInt(b.class_name.replace(/\D/g, '') || '0', 10);
                                    return numA === numB ? a.class_name.localeCompare(b.class_name) : numA - numB;
                                })
                                .map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                        </select>
                    </div>

                    {sections.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Section</label>
                            <select value={selectedSection} onChange={(e) => { setSelectedSection(e.target.value); setSelectedExam(''); }} className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm" disabled={!selectedClass}>
                                <option value="">Select Section</option>
                                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div className="md:col-span-2 lg:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                            <span>Exam Type</span>
                        </label>
                        <select
                            value={selectedExam}
                            onChange={(e) => setSelectedExam(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm"
                            disabled={!selectedClass}
                        >
                            <option value="">{examTypes.length === 0 ? 'Loading...' : 'Select Exam'}</option>
                            {examTypes.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Dynamic Scheduled Period (Month/Year) */}
                    <div className="md:col-span-2 lg:col-span-1 bg-indigo-50 border border-indigo-100 rounded-lg p-2 flex flex-col justify-center">
                        <label className="block text-[10px] font-bold text-indigo-500 uppercase">Scheduled Period</label>
                        <div className="text-sm font-bold text-indigo-700">
                            {selectedExam ? (
                                scheduledPeriod || 'Loading...'
                            ) : (
                                <span className="text-slate-400 font-normal">-</span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-end gap-2">
                        <button onClick={handleSave} disabled={loading || !selectedExam} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 h-10 w-full justify-center">
                            <Save size={16} /> Save
                        </button>
                    </div>

                </div>
                <div className="flex gap-2 mt-4">
                    {/* Reduced buttons here as Save moved up or keep additional actions */}
                    <button onClick={fetchMarks} disabled={!selectedExam} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                        <Eye size={16} /> Reload Marks
                    </button>
                    <button onClick={handlePrintAll} disabled={!selectedExam} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                        <Printer size={16} /> Print All
                    </button>
                </div>
            </div>

            {/* Marks Entry Grid - ENHANCED FOR COMPONENTS */}
            {students.length > 0 && displaySubjects.length > 0 && selectedExam ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-amber-50">
                                <tr>
                                    <th className="border border-amber-200 p-3 font-bold text-amber-900 sticky left-0 bg-amber-50">Roll</th>
                                    <th className="border border-amber-200 p-3 font-bold text-amber-900">Student</th>
                                    {displaySubjects.map(subject => {
                                        // Check for Schedule Components
                                        const scheduleItem = examSchedule.find(s => s.subject_id === subject.id);
                                        let components = scheduleItem?.components || [];
                                        // Handle if components is a JSON string
                                        if (typeof components === 'string') {
                                            try { components = JSON.parse(components); } catch (e) { components = []; }
                                        }
                                        const hasComponents = Array.isArray(components) && components.length > 0;

                                        // If components exist, render a column for each component? No, render sub-columns or inputs in same cell.
                                        // Table Header is dynamic? No, we are mapping rows.
                                        // If we have varied components per subject, the table structure becomes complex if subjects are columns.
                                        // Here subjects are COLUMNS.
                                        // If Subject A has Theory/Practical, and Subject B has only Theory, alignment is tricky.

                                        // Solution: Render a mini-table or stacked inputs within the cell.

                                        return (
                                            <th key={subject.id} className="p-3 border-b border-l min-w-[120px]">
                                                <div className="flex flex-col">
                                                    <span>{subject.name}</span>
                                                    {hasComponents && (
                                                        <span className="text-[10px] text-slate-500 font-normal">
                                                            ({components.map(c => c.name).join(' + ')})
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                    <th className="border border-amber-200 p-3 font-bold text-amber-900">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50">
                                        <td className="border border-slate-200 p-3 text-center font-mono sticky left-0 bg-white">{student.roll_number}</td>
                                        <td className="border border-slate-200 p-3 font-medium">{student.name}</td>
                                        {displaySubjects.map(subject => {
                                            const key = `${student.id}-${subject.id}`;
                                            const scheduleItem = examSchedule.find(s => s.subject_id === subject.id);
                                            let components = scheduleItem?.components || [];
                                            // Handle if components is a JSON string
                                            if (typeof components === 'string') {
                                                try { components = JSON.parse(components); } catch (e) { components = []; }
                                            }
                                            const hasComponents = Array.isArray(components) && components.length > 0;

                                            const markValue = marks[key];
                                            // Handle display value
                                            // If complex object: markValue.components[name]

                                            return (
                                                <td key={subject.id} className="p-2 border-l text-center">
                                                    {hasComponents ? (
                                                        <div className="flex flex-col gap-1">
                                                            {components.map((comp, idx) => {
                                                                const val = markValue?.components?.[comp.name] ?? '';
                                                                return (
                                                                    <div key={idx} className="flex items-center gap-1">
                                                                        <span className="text-[10px] w-12 text-right truncate text-slate-500" title={comp.name}>{comp.name}</span>
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max={comp.max_marks}
                                                                            value={val}
                                                                            onChange={(e) => handleMarkChange(student.id, subject.id, e.target.value, comp.name)}
                                                                            className="w-16 border rounded px-1 text-center text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                                                                            placeholder={`/${comp.max_marks}`}
                                                                        />
                                                                    </div>
                                                                )
                                                            })}
                                                            <div className="border-t mt-1 pt-1 text-xs font-bold text-slate-700 text-right pr-2">
                                                                Total: {markValue?.total || 0}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={scheduleItem?.max_marks || selectedExamType?.max_marks || 100}
                                                            value={typeof markValue === 'object' ? markValue?.total : (markValue || '')}
                                                            onChange={(e) => handleMarkChange(student.id, subject.id, e.target.value)}
                                                            className="w-20 border rounded px-2 py-1 text-center focus:ring-2 focus:ring-amber-500 outline-none"
                                                            placeholder={`/${scheduleItem?.max_marks || selectedExamType?.max_marks || 100}`}
                                                        />
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="border border-slate-200 p-2 text-center">
                                            <button onClick={() => handleViewMarksheet(student)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 mx-auto">
                                                <Eye size={12} /> View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center print:hidden">
                    <Award size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 font-medium">Select filters to start entering marks</p>
                </div>
            )}

            {/* Create Exam Type Modal - ENHANCED FOR COMPONENTS */}
            {showExamModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200 bg-amber-50">
                            <h3 className="text-lg font-bold text-amber-900">Create Exam Type</h3>
                            <p className="text-xs text-amber-600 mt-1">Select exam period (can span two months) and add components for Internal/External marks</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100 mb-2">
                                    <label className="block text-xs font-bold text-blue-800 uppercase mb-2">Select from Scheduled Exams</label>
                                    <select
                                        onChange={(e) => handleSelectScheduledExam(e.target.value)}
                                        className="w-full px-4 py-2 border border-blue-200 rounded-lg text-sm bg-white text-blue-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">-- Choose from Schedule --</option>
                                        {scheduledExams.map(ex => (
                                            <option key={ex.id} value={ex.id}>{ex.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-blue-600 mt-2 italic">Selecting an exam here will switch to marks entry for that exam instantly.</p>
                                </div>

                                <div className="col-span-2 flex items-center gap-3 my-2">
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                    <span className="text-xs text-slate-400 font-bold uppercase">OR Create New</span>
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Exam Name</label>
                                    <input type="text" value={newExam.name} onChange={(e) => setNewExam({ ...newExam, name: e.target.value })} placeholder="e.g., Midterm, Final" className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Total Max Marks</label>
                                    <input type="number" value={newExam.max_marks} onChange={(e) => setNewExam({ ...newExam, max_marks: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Start Month</label>
                                    <select value={newExam.start_month} onChange={(e) => setNewExam({ ...newExam, start_month: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                                        {months.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">End Month</label>
                                    <select value={newExam.end_month} onChange={(e) => setNewExam({ ...newExam, end_month: parseInt(e.target.value) })} className="w-full px-4 py-2 border border-slate-300 rounded-lg">
                                        {months.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}
                                    </select>
                                </div>
                            </div>

                            {newExam.start_month !== newExam.end_month && (
                                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                                    <strong>Exam Period:</strong> {months[newExam.start_month - 1]} - {months[newExam.end_month - 1]}
                                </div>
                            )}

                            <div className="border-t border-slate-200 pt-4">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-sm font-bold text-slate-700">Components (Optional)</label>
                                    <button onClick={addComponent} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                                        <Plus size={14} /> Add Component
                                    </button>
                                </div>
                                {newExam.components.length > 0 && (
                                    <div className="space-y-2">
                                        {newExam.components.map((comp, idx) => (
                                            <div key={idx} className="flex gap-2 items-center bg-slate-50 p-3 rounded-lg">
                                                <input type="text" value={comp.name} onChange={(e) => updateComponent(idx, 'name', e.target.value)} placeholder="e.g., Internal" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                                <input type="number" value={comp.max_marks} onChange={(e) => updateComponent(idx, 'max_marks', parseInt(e.target.value))} placeholder="Max marks" className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                                                <button onClick={() => removeComponent(idx)} className="text-red-600 hover:text-red-700">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                                            <strong>Total:</strong> {newExam.components.reduce((sum, c) => sum + (parseInt(c.max_marks) || 0), 0)} / {newExam.max_marks} marks
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setShowExamModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100">
                                Cancel
                            </button>
                            <button onClick={handleCreateExamType} disabled={isSubmitting} className={`px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <Plus size={16} /> {isSubmitting ? 'Creating...' : 'Create Exam Type'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Marksheet Modal */}
            {showMarksheetModal && marksheetData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        {/* Print Header - School Name */}
                        <div className="hidden print:block text-center py-6 border-b-2 border-slate-300">
                            <h1 className="text-3xl font-bold text-slate-900">{config?.name || 'School Name'}</h1>
                            <p className="text-sm text-slate-600 mt-2">Student Marksheet</p>
                        </div>

                        {/* Modal Header - Hidden in Print */}
                        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex justify-between items-center print:hidden">
                            <h3 className="text-lg font-bold">Student Marksheet</h3>
                            <div className="flex gap-2">
                                <button onClick={handlePrintMarksheet} className="text-white hover:text-indigo-100">
                                    <Printer size={20} />
                                </button>
                                <button onClick={() => setShowMarksheetModal(false)} className="text-white hover:text-indigo-100">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {/* Student Info */}
                            <div className="mb-6 pb-4 border-b border-slate-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase font-bold">Student Name</div>
                                        <div className="text-lg font-bold text-slate-800">{marksheetData.student.name}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase font-bold">Roll Number</div>
                                        <div className="text-lg font-bold text-slate-800">{marksheetData.student.roll_number}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase font-bold">Class</div>
                                        <div className="font-medium text-slate-700">{marksheetData.student.class_name}{marksheetData.student.section_name ? ` - ${marksheetData.student.section_name}` : ''}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase font-bold">Exam</div>
                                        <div className="font-medium text-slate-700">{marksheetData.marks[0]?.exam_name || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Marks Table */}
                            <table className="w-full text-sm border-collapse mb-6">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="border border-slate-200 p-3 font-bold text-slate-700 text-left">Subject</th>
                                        <th className="border border-slate-200 p-3 font-bold text-slate-700 text-center">Min Marks</th>
                                        <th className="border border-slate-200 p-3 font-bold text-slate-700 text-center">Max Marks</th>
                                        <th className="border border-slate-200 p-3 font-bold text-slate-700 text-center">Marks Obtained</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {marksheetData.marks.map(mark => (
                                        <React.Fragment key={mark.id}>
                                            <tr className={mark.hasComponents ? 'bg-slate-50' : ''}>
                                                <td className="border border-slate-200 p-3 font-semibold">{mark.subject_name}</td>
                                                <td className="border border-slate-200 p-3 text-center">{mark.min_marks}</td>
                                                <td className="border border-slate-200 p-3 text-center">{mark.max_marks}</td>
                                                <td className={`border border-slate-200 p-3 text-center font-bold ${mark.marks_obtained < mark.min_marks ? 'text-red-600' : 'text-green-600'}`}>
                                                    {mark.marks_obtained}
                                                </td>
                                            </tr>
                                            {/* Component Breakdown */}
                                            {mark.hasComponents && mark.components.map((comp, idx) => (
                                                <tr key={`${mark.id}-${idx}`} className="bg-blue-50">
                                                    <td className="border border-slate-200 p-2 pl-8 text-xs text-slate-600">
                                                        ↳ {comp.name}
                                                    </td>
                                                    <td className="border border-slate-200 p-2 text-center text-xs text-slate-600">{comp.min_marks}</td>
                                                    <td className="border border-slate-200 p-2 text-center text-xs text-slate-600">{comp.max_marks}</td>
                                                    <td className={`border border-slate-200 p-2 text-center text-xs font-semibold ${comp.marks_obtained < comp.min_marks ? 'text-red-600' : 'text-slate-700'}`}>
                                                        {comp.marks_obtained}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                    <tr className="bg-amber-50">
                                        <td className="border border-amber-200 p-3 font-bold">Total</td>
                                        <td className="border border-amber-200 p-3 text-center font-bold">-</td>
                                        <td className="border border-amber-200 p-3 text-center font-bold">{marksheetData.summary.max_marks}</td>
                                        <td className="border border-amber-200 p-3 text-center font-bold">{marksheetData.summary.total_marks}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Percentage */}
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg mb-8 flex justify-between px-12">
                                <div className="text-center">
                                    <div className="text-sm text-slate-600 font-bold uppercase mb-1">Percentage</div>
                                    <div className="text-3xl font-bold text-emerald-600">{marksheetData.summary.percentage}%</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-sm text-slate-600 font-bold uppercase mb-1">Grade</div>
                                    <div className="text-3xl font-bold text-indigo-600">{marksheetData.summary.grade}</div>
                                </div>
                            </div>

                            {/* Signature Section */}
                            <div className="grid grid-cols-2 gap-8 mt-12 pt-8">
                                <div className="text-center">
                                    <div className="border-t-2 border-slate-400 pt-2 mt-16">
                                        <p className="text-sm font-bold text-slate-700">Class Teacher</p>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="border-t-2 border-slate-400 pt-2 mt-16">
                                        <p className="text-sm font-bold text-slate-700">Principal</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarksManagement;
