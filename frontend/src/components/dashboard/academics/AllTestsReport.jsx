import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { 
    Printer, FileText, Search, Sparkles, RefreshCw, AlertCircle, User
} from 'lucide-react';

const AllTestsReport = () => {
    const [admissionNo, setAdmissionNo] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [school, setSchool] = useState(() => {
        try { return JSON.parse(localStorage.getItem('school') || '{}'); } catch { return {}; }
    });

    // Fetch fresh school details on mount
    useEffect(() => {
        const fetchSchoolDetails = async () => {
            try {
                const res = await api.get('/schools/my-school');
                if (res.data) {
                    setSchool(res.data.data || res.data);
                }
            } catch (error) {
                console.error('Error fetching school details:', error);
            }
        };
        fetchSchoolDetails();
    }, []);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!admissionNo.trim()) {
            toast.error('Please enter an Admission Number');
            return;
        }

        setLoading(true);
        setResult(null);
        try {
            const res = await api.get('/marks/student-all', {
                params: { admission_no: admissionNo.trim() }
            });
            
            if (res.data) {
                setResult(res.data);
                toast.success('Student records found');
            }
        } catch (error) {
            console.error('Error fetching student result:', error);
            const msg = error.response?.data?.message || 'Failed to fetch results';
            const note = error.response?.data?.note || '';
            toast.error(msg + (note ? ` - ${note}` : ''));
        } finally {
            setLoading(false);
        }
    };

    // Helper: get mark and date for a subject in a specific exam
    const getSubjectExamData = (exam, subjectName) => {
        const defaultData = { marks: 'ABSENT', max: 100, date: null };
        if (!exam || !exam.subjects) return defaultData;

        const subMatch = exam.subjects.find(s => s.subject === subjectName);
        if (subMatch) {
            const obtained = subMatch.marks;
            const isAbsent = obtained === null || obtained === undefined || obtained === '' || obtained === 'ABSENT';
            return {
                marks: isAbsent ? 'ABSENT' : obtained,
                max: subMatch.max || 100,
                date: subMatch.exam_date || null
            };
        }
        return defaultData;
    };

    // Helper: format Date to DD-MM-YYYY
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        } catch {
            return dateStr;
        }
    };

    // Collect unique dates for an exam across all subjects
    const getExamDates = (exam) => {
        if (!exam || !exam.subjects) return [];
        const dates = exam.subjects
            .map(s => s.exam_date)
            .filter(d => d)
            .map(d => formatDate(d));
        return [...new Set(dates)];
    };

    // Subject abbreviation helper
    const abbreviateSubject = (name) => {
        const upper = name.toUpperCase();
        if (upper.includes('PHYSICS')) return 'PHY';
        if (upper.includes('CHEMISTRY')) return 'CHE';
        if (upper.includes('MATHEMATICS') || upper.includes('MATH')) return 'MATHS';
        if (upper.includes('COMPUTER SCIENCE')) return 'CS';
        if (upper.includes('BIOLOGY')) return 'BIO';
        if (upper.includes('ENGLISH')) return 'ENG';
        if (upper.includes('KANNADA')) return 'KAN';
        if (upper.includes('HINDI')) return 'HIN';
        return name.length > 5 ? name.substring(0, 4).toUpperCase() : name.toUpperCase();
    };

    // Filter and group exams (JEE vs Theory)
    const groupedExams = React.useMemo(() => {
        if (!result || !result.exams) return { jeeExams: [], theoryExams: [] };
        
        const jeeExams = [];
        const theoryExams = [];
        
        result.exams.forEach(exam => {
            const name = exam.exam_name.toUpperCase();
            if (name.includes('JEE') || name.includes('CET') || name.includes('KCET') || name.includes('NEET') || name.includes('COMPETITIVE')) {
                jeeExams.push(exam);
            } else {
                theoryExams.push(exam);
            }
        });
        
        return { jeeExams, theoryExams };
    }, [result]);

    // Find unique subjects for a subset of exams
    const getTableSubjects = (examsList) => {
        const subjectsMap = {};
        examsList.forEach(exam => {
            if (exam.subjects) {
                exam.subjects.forEach(sub => {
                    const name = sub.subject;
                    if (!subjectsMap[name]) {
                        subjectsMap[name] = {
                            name: name,
                            code: sub.subject_code || ''
                        };
                    }
                });
            }
        });
        return Object.values(subjectsMap).sort((a, b) => a.name.localeCompare(b.name));
    };

    const jeeSubjects = React.useMemo(() => getTableSubjects(groupedExams.jeeExams), [groupedExams.jeeExams]);
    const theorySubjects = React.useMemo(() => getTableSubjects(groupedExams.theoryExams), [groupedExams.theoryExams]);

    // Calculate row total (numeric sum or 'AB' if all are absent)
    const getRowTotal = (exam, subjectsList) => {
        let allAbsent = true;
        let sum = 0;
        subjectsList.forEach(subject => {
            const subData = getSubjectExamData(exam, subject.name);
            if (subData.marks !== 'ABSENT') {
                allAbsent = false;
                sum += parseFloat(subData.marks) || 0;
            }
        });
        return allAbsent ? 'AB' : sum;
    };

    const handlePrint = () => {
        window.print();
    };

    const schoolName = school?.name || 'SHRAMA PU SCIENCE COLLEGE.';
    const schoolLocation = school?.address || 'VIDYAGIRI, BAGALKOT.';

    return (
        <div className="space-y-6 h-full flex flex-col font-sans">
            {/* Header section - hidden on print */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="text-violet-600 w-5 h-5" /> Consolidated Exams Sheet
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Search student admission number to view and print complete progress card with exam dates
                    </p>
                </div>

                {/* Search controls */}
                <form onSubmit={handleSearch} className="flex items-center gap-3">
                    <div className="relative w-64">
                        <input
                            type="text"
                            value={admissionNo}
                            onChange={e => setAdmissionNo(e.target.value)}
                            placeholder="Enter Admission Number"
                            className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none font-medium text-slate-700 bg-slate-50"
                        />
                        <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !admissionNo.trim()}
                        className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-md shadow-violet-600/10 flex items-center gap-1.5"
                    >
                        {loading ? <RefreshCw className="animate-spin w-3.5 h-3.5" /> : <Search size={14} />}
                        Search Student
                    </button>
                </form>
            </div>

            {/* Print toolbar - hidden on print */}
            {result && (
                <div className="flex justify-end bg-white p-4 rounded-xl border border-slate-100 shadow-sm print:hidden">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-slate-900/10"
                    >
                        <Printer size={15} /> Print Marksheet
                    </button>
                </div>
            )}

            {/* Main Area */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[300px] print:border-none print:shadow-none">
                {loading && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                        <RefreshCw className="animate-spin text-violet-600 w-8 h-8" />
                        <p className="text-sm font-semibold">Fetching and aggregating marks history...</p>
                    </div>
                )}

                {!loading && !result && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-2 print:hidden">
                        <FileText size={48} className="text-slate-300 stroke-[1.5]" />
                        <p className="text-sm font-medium">Enter student admission number above to fetch results</p>
                    </div>
                )}

                {/* Display Student Marksheet */}
                {!loading && result && (
                    <div className="flex-1 overflow-auto p-4 md:p-6 print:p-0">
                        <div 
                            className="bg-white border-2 border-slate-800 rounded-2xl p-6 md:p-8 max-w-2xl mx-auto shadow-md print:shadow-none print:border-2 print:border-black print:my-0 print:p-4 print:page-break font-serif text-slate-900"
                            style={{ pageBreakAfter: 'always', pageBreakInside: 'avoid' }}
                        >
                            {/* Institution Title Header */}
                            <div className="text-center mb-6">
                                <h1 className="text-2xl font-black uppercase tracking-wide font-serif text-slate-900 leading-tight">
                                    {schoolName}
                                </h1>
                                <h2 className="text-md font-bold uppercase tracking-wide text-slate-700 mt-0.5">
                                    {schoolLocation}
                                </h2>
                                
                                {/* Student Profile Info */}
                                <div className="border-t-2 border-b-2 border-slate-900 py-3 mt-4 grid grid-cols-3 gap-2 text-left text-xs uppercase font-extrabold tracking-wide">
                                    <div>
                                        CLASS : <span className="text-slate-700 font-bold">{result.student.class_name || 'II PUC'}</span>
                                    </div>
                                    <div></div>
                                    <div className="text-right">
                                        ROLL NO : <span className="text-slate-700 font-bold">{result.student.roll_number || result.student.admission_no || '-'}</span>
                                    </div>
                                    <div className="col-span-3 mt-1">
                                        STUDENT NAME : <span className="text-slate-700 font-bold">{result.student.name}</span>
                                    </div>
                                </div>
                            </div>

                            {/* TABLE 1: JEE EXAMS */}
                            {groupedExams.jeeExams.length > 0 && (
                                <div className="mb-6">
                                    <div className="text-center mb-2">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                                            JEE MAX MARKS – 300
                                        </h3>
                                        <p className="text-[11px] font-black uppercase text-slate-800 tracking-widest decoration-dotted underline underline-offset-2">
                                            MARKS CARD
                                        </p>
                                    </div>

                                    <div className="border border-slate-900 rounded overflow-hidden">
                                        <table className="w-full text-xs text-left border-collapse font-serif text-slate-900">
                                            <thead className="bg-slate-100 text-slate-900 font-extrabold uppercase border-b border-slate-900 text-center">
                                                <tr>
                                                    <th className="p-1.5 border-r border-slate-900 w-14">SL NO</th>
                                                    <th className="p-1.5 border-r border-slate-900 w-28">W.E.TEST DATE</th>
                                                    {jeeSubjects.map(sub => (
                                                        <th key={sub.name} className="p-1.5 border-r border-slate-900">
                                                            {abbreviateSubject(sub.name)}
                                                        </th>
                                                    ))}
                                                    <th className="p-1.5 w-20">TOTAL</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-900 text-center">
                                                {groupedExams.jeeExams.map((exam, index) => {
                                                    const dates = getExamDates(exam);
                                                    const total = getRowTotal(exam, jeeSubjects);

                                                    return (
                                                        <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-1.5 border-r border-slate-900 font-bold">
                                                                {String(index + 1).padStart(2, '0')}
                                                            </td>
                                                            <td className="p-1.5 border-r border-slate-900">
                                                                <div className="flex flex-col">
                                                                    {dates.length > 0 ? dates.map((d, i) => <span key={i}>{d}</span>) : <span>-</span>}
                                                                </div>
                                                            </td>
                                                            {jeeSubjects.map(sub => {
                                                                const subData = getSubjectExamData(exam, sub.name);
                                                                return (
                                                                    <td key={sub.name} className="p-1.5 border-r border-slate-900 font-bold">
                                                                        {subData.marks === 'ABSENT' ? 'AB' : subData.marks}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="p-1.5 font-bold">
                                                                {total}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TABLE 2: THEORY UNIT TEST */}
                            {groupedExams.theoryExams.length > 0 && (
                                <div className="mb-6">
                                    <div className="text-center mb-2">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                                            THEORY UNIT TEST MARKS LIST
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-700">
                                            (MAX MARKS – 25)
                                        </p>
                                    </div>

                                    <div className="border border-slate-900 rounded overflow-hidden">
                                        <table className="w-full text-xs text-left border-collapse font-serif text-slate-900">
                                            <thead className="bg-slate-100 text-slate-900 font-extrabold uppercase border-b border-slate-900 text-center">
                                                <tr>
                                                    <th className="p-1.5 border-r border-slate-900 w-14">SL NO</th>
                                                    <th className="p-1.5 border-r border-slate-900 w-28">U. T. DATE</th>
                                                    {theorySubjects.map(sub => (
                                                        <th key={sub.name} className="p-1.5 border-r border-slate-900">
                                                            {abbreviateSubject(sub.name)}
                                                        </th>
                                                    ))}
                                                    <th className="p-1.5 w-20">TOTAL</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-900 text-center">
                                                {groupedExams.theoryExams.map((exam, index) => {
                                                    const dates = getExamDates(exam);
                                                    const total = getRowTotal(exam, theorySubjects);

                                                    return (
                                                        <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-1.5 border-r border-slate-900 font-bold">
                                                                {String(index + 1).padStart(2, '0')}
                                                            </td>
                                                            <td className="p-1.5 border-r border-slate-900">
                                                                <div className="flex flex-col">
                                                                    {dates.length > 0 ? dates.map((d, i) => <span key={i}>{d}</span>) : <span>-</span>}
                                                                </div>
                                                            </td>
                                                            {theorySubjects.map(sub => {
                                                                const subData = getSubjectExamData(exam, sub.name);
                                                                return (
                                                                    <td key={sub.name} className="p-1.5 border-r border-slate-900 font-bold">
                                                                        {subData.marks === 'ABSENT' ? 'AB' : subData.marks}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="p-1.5 font-bold">
                                                                {total}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Report Card Footer Signs */}
                            <div className="grid grid-cols-4 gap-4 pt-16 text-center text-[10px] font-bold text-slate-700 tracking-wide uppercase">
                                <div>
                                    <div className="border-t border-dashed border-slate-400 pt-1.5 mx-2">
                                        Parent Signature
                                    </div>
                                </div>
                                <div>
                                    <div className="border-t border-dashed border-slate-400 pt-1.5 mx-2">
                                        Class Teacher
                                    </div>
                                </div>
                                <div>
                                    <div className="border-t border-dashed border-slate-400 pt-1.5 mx-2">
                                        Exam In-charge
                                    </div>
                                </div>
                                <div>
                                    <div className="border-t border-dashed border-slate-400 pt-1.5 mx-2 text-slate-900 font-black">
                                        Principal
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Embed print styles */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body {
                        background: white !important;
                        color: black !important;
                    }
                    /* Hide sidebar, dashboard header, toolbar, everything except main print content */
                    header, aside, .print\\:hidden, button, select, input, nav, footer, .no-print {
                        display: none !important;
                    }
                    main {
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        height: auto !important;
                    }
                    .print\\:border-none {
                        border: none !important;
                    }
                    .print\\:shadow-none {
                        box-shadow: none !important;
                    }
                    .print\\:my-0 {
                        margin-top: 0 !important;
                        margin-bottom: 0 !important;
                    }
                    .print\\:p-4 {
                        padding: 16px !important;
                    }
                    .print\\:border-2 {
                        border-width: 2px !important;
                    }
                    .print\\:border-black {
                        border-color: black !important;
                    }
                    .print\\:page-break {
                        page-break-after: always !important;
                        page-break-inside: avoid !important;
                        margin-bottom: 0 !important;
                    }
                }
            `}} />
        </div>
    );
};

export default AllTestsReport;
