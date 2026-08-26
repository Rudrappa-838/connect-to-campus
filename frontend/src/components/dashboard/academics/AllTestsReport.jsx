import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { 
    Printer, FileText, Search, Sparkles, RefreshCw, AlertCircle, User, GraduationCap
} from 'lucide-react';

// Clean Roman PUC Class Name Formatter (e.g. "NEET 1 PUC", "1 PUC 1", "NEET 12" -> "I PUC" / "II PUC")
const formatClassName = (className) => {
    if (!className) return 'I PUC';
    const str = String(className).toUpperCase().trim();

    // Check for 2nd PUC / 12th / 2 PUC / 2 PUCT / NEET 2 / 2nd
    if (str.includes('2 PUC') || str.includes('2PUC') || str.includes('2ND') || str.includes('12') || str.includes('II PUC')) {
        return 'II PUC';
    }
    // Check for 1st PUC / 11th / 1 PUC / 1 PUCT / NEET 1 / 1st
    if (str.includes('1 PUC') || str.includes('1PUC') || str.includes('1ST') || str.includes('11') || str.includes('I PUC')) {
        return 'I PUC';
    }

    return str.includes('PUC') ? str : `${str} PUC`;
};

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
        const defaultData = { marks: 'NA', max: 100, date: null };
        if (!exam || !exam.subjects) return defaultData;

        const subMatch = exam.subjects.find(s => s.subject === subjectName);
        if (subMatch) {
            const obtained = subMatch.marks;
            const isAbsent = obtained === null || obtained === undefined || obtained === '' || obtained === 'ABSENT' || obtained === 'AB' || obtained === 'N/A' || obtained === 'NA';
            return {
                marks: isAbsent ? 'NA' : obtained,
                max: subMatch.max || 100,
                date: subMatch.exam_date || null
            };
        }
        return defaultData;
    };

    // Helper: format Date to DD-MM-YYYY (pure string parsing to prevent timezone offset bugs)
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            const str = String(dateStr).split('T')[0].trim();
            const parts = str.split('-');
            if (parts.length === 3) {
                const [y, m, d] = parts;
                return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
            }
            return dateStr;
        } catch {
            return dateStr;
        }
    };

    // Collect unique dates for an exam across all subjects (show only once if same date, stack if different)
    const getExamDates = (exam) => {
        if (!exam || !exam.subjects) return [];
        const dateSet = new Set();
        exam.subjects.forEach(s => {
            if (s.exam_date) {
                const formatted = formatDate(s.exam_date).trim();
                if (formatted) {
                    dateSet.add(formatted);
                }
            }
        });
        return Array.from(dateSet);
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

    // Filter and group exams into separate categories (JEE, NEET, KCET, Theory)
    const groupedExams = React.useMemo(() => {
        if (!result || !result.exams) return { jeeExams: [], neetExams: [], kcetExams: [], theoryExams: [] };
        
        const jeeExams = [];
        const neetExams = [];
        const kcetExams = [];
        const theoryExams = [];
        
        result.exams.forEach(exam => {
            const name = exam.exam_name.toUpperCase();
            if (name.includes('JEE')) {
                jeeExams.push(exam);
            } else if (name.includes('NEET')) {
                neetExams.push(exam);
            } else if (name.includes('KCET') || name.includes('CET')) {
                kcetExams.push(exam);
            } else {
                theoryExams.push(exam);
            }
        });
        
        return { jeeExams, neetExams, kcetExams, theoryExams };
    }, [result]);

    // Find unique subjects for a subset of exams (includes all subjects present in the exams)
    const getTableSubjects = (examsList) => {
        const subjectsMap = {};
        examsList.forEach(exam => {
            if (exam.subjects && Array.isArray(exam.subjects)) {
                exam.subjects.forEach(sub => {
                    if (sub && sub.subject) {
                        const name = sub.subject;
                        if (!subjectsMap[name]) {
                            subjectsMap[name] = {
                                name: name,
                                code: sub.subject_code || ''
                            };
                        }
                    }
                });
            }
        });
        return Object.values(subjectsMap).sort((a, b) => a.name.localeCompare(b.name));
    };

    const jeeSubjects = React.useMemo(() => getTableSubjects(groupedExams.jeeExams), [groupedExams.jeeExams]);
    const neetSubjects = React.useMemo(() => getTableSubjects(groupedExams.neetExams), [groupedExams.neetExams]);
    const kcetSubjects = React.useMemo(() => getTableSubjects(groupedExams.kcetExams), [groupedExams.kcetExams]);
    const theorySubjects = React.useMemo(() => getTableSubjects(groupedExams.theoryExams), [groupedExams.theoryExams]);

    // Calculate row total (numeric sum or 'NA' if all are absent)
    const getRowTotal = (exam, subjectsList) => {
        let allAbsent = true;
        let sum = 0;
        subjectsList.forEach(subject => {
            const subData = getSubjectExamData(exam, subject.name);
            if (subData.marks !== 'NA' && subData.marks !== 'N/A' && subData.marks !== 'ABSENT') {
                allAbsent = false;
                sum += parseFloat(subData.marks) || 0;
            }
        });
        return allAbsent ? 'NA' : sum;
    };

    const handlePrint = () => {
        window.print();
    };

    const schoolName = school?.name || 'SHRAMA PU SCIENCE COLLEGE.';
    const schoolLocation = school?.address || 'VIDYAGIRI, BAGALKOT.';

    return (
        <div className="space-y-6 h-full flex flex-col font-sans">
            {/* Header section - hidden on print */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden no-print-area">
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
                <div className="flex justify-end bg-white p-4 rounded-xl border border-slate-100 shadow-sm print:hidden no-print-area">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-slate-900/10"
                    >
                        <Printer size={15} /> Print Marksheet
                    </button>
                </div>
            )}

            {/* Main Area */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[300px] print:border-none print:shadow-none print:overflow-visible">
                {loading && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                        <RefreshCw className="animate-spin text-violet-600 w-8 h-8" />
                        <p className="text-sm font-semibold">Fetching and aggregating marks history...</p>
                    </div>
                )}

                {!loading && !result && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-2 print:hidden no-print-area">
                        <FileText size={48} className="text-slate-300 stroke-[1.5]" />
                        <p className="text-sm font-medium">Enter student admission number above to fetch results</p>
                    </div>
                )}

                {/* Display Student Marksheet */}
                {!loading && result && (
                    <div className="flex-1 overflow-auto p-4 md:p-6 print:p-0 print:overflow-visible">
                        <div 
                            className="all-tests-printable-marksheet bg-white border-2 border-slate-800 rounded-2xl p-6 md:p-8 max-w-2xl mx-auto shadow-md print:shadow-none print:border-2 print:border-black print:my-0 print:p-4 text-slate-900"
                            style={{ 
                                fontFamily: '"Times New Roman", Times, serif', 
                                pageBreakInside: 'avoid',
                                breakInside: 'avoid'
                            }}
                        >
                            {/* Institution Title Header with Left Corner College Logo */}
                            <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-slate-900 gap-3">
                                {/* Left Corner College Logo */}
                                <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center">
                                    {school?.logo || school?.logo_url ? (
                                        <img 
                                            src={school.logo || school.logo_url} 
                                            alt="College Logo" 
                                            className="college-logo-img max-h-20 max-w-20 object-contain"
                                            style={{ width: '70px', height: '70px', maxWidth: '70px', maxHeight: '70px', objectFit: 'contain' }}
                                            onError={(e) => { 
                                                e.target.style.display = 'none'; 
                                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; 
                                            }}
                                        />
                                    ) : null}
                                    <div 
                                        className="w-16 h-16 rounded-full border-2 border-slate-900 flex flex-col items-center justify-center bg-slate-50 text-center p-1"
                                        style={{ display: (school?.logo || school?.logo_url) ? 'none' : 'flex', width: '64px', height: '64px' }}
                                    >
                                        <GraduationCap size={20} className="text-slate-900" />
                                        <span className="text-[7.5px] font-extrabold text-slate-900 uppercase leading-tight mt-0.5" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            COLLEGE<br/>LOGO
                                        </span>
                                    </div>
                                </div>

                                {/* Center College Title Header */}
                                <div className="text-center flex-1">
                                    <h1 className="text-2xl font-black uppercase tracking-wide text-slate-900 leading-tight" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                        {schoolName}
                                    </h1>
                                    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800 mt-1" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                        {schoolLocation}
                                    </h2>
                                </div>

                                {/* Right Spacer for Symmetry */}
                                <div className="w-20 flex-shrink-0"></div>
                            </div>

                            {/* Student Profile Info */}
                            <div 
                                className="border-b-2 border-slate-900 pb-3 mb-6 grid grid-cols-3 gap-2 text-left text-xs uppercase font-extrabold tracking-wide"
                                style={{ fontFamily: '"Times New Roman", Times, serif' }}
                            >
                                <div>
                                    CLASS : <span className="text-slate-900 font-bold">{result.student.class_name || '-'}</span>
                                </div>
                                <div></div>
                                <div className="text-right">
                                    ROLL NO : <span className="text-slate-900 font-bold">{result.student.custom_roll_number || result.student.roll_number || result.student.admission_no || '-'}</span>
                                </div>
                                <div className="col-span-3 mt-1">
                                    STUDENT NAME : <span className="text-slate-900 font-bold">{result.student.name}</span>
                                </div>
                            </div>

                            {/* Fallback if no marks exist for student */}
                            {groupedExams.jeeExams.length === 0 && 
                             groupedExams.neetExams.length === 0 && 
                             groupedExams.kcetExams.length === 0 && 
                             groupedExams.theoryExams.length === 0 && (
                                <div className="py-12 text-center text-slate-600 font-extrabold text-sm uppercase tracking-wider my-4 border border-dashed border-slate-400 rounded-xl" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                    NO EXAM MARKS RECORDED YET FOR THIS STUDENT
                                </div>
                            )}

                            {/* TABLE 1: JEE EXAMS */}
                            {groupedExams.jeeExams.length > 0 && (
                                <div className="mb-6">
                                    <div className="text-center mb-2">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            JEE EXAMS MARKS CARD (MAX MARKS – 300)
                                        </h3>
                                        <p className="text-[11px] font-black uppercase text-slate-800 tracking-widest decoration-dotted underline underline-offset-2" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            COMPETITIVE TEST RESULTS
                                        </p>
                                    </div>

                                    <div className="border border-slate-900 rounded overflow-hidden">
                                        <table className="w-full text-xs text-left border-collapse text-slate-900" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            <thead className="bg-slate-100 text-slate-900 font-extrabold uppercase border-b border-slate-900 text-center">
                                                <tr>
                                                    <th className="p-1.5 border-r border-slate-900 w-14">SL NO</th>
                                                    <th className="p-1.5 border-r border-slate-900 w-28">TEST DATE</th>
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
                                                                const displayVal = (subData.marks === 'ABSENT' || subData.marks === 'N/A' || subData.marks === 'NA' || subData.marks === null || subData.marks === undefined || subData.marks === '') ? 'NA' : subData.marks;
                                                                return (
                                                                    <td key={sub.name} className="p-1.5 border-r border-slate-900 font-bold">
                                                                        {displayVal}
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

                            {/* TABLE 2: NEET EXAMS */}
                            {groupedExams.neetExams.length > 0 && (
                                <div className="mb-6">
                                    <div className="text-center mb-2">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            NEET EXAMS MARKS CARD (MAX MARKS – 720)
                                        </h3>
                                        <p className="text-[11px] font-black uppercase text-slate-800 tracking-widest decoration-dotted underline underline-offset-2" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            COMPETITIVE TEST RESULTS
                                        </p>
                                    </div>

                                    <div className="border border-slate-900 rounded overflow-hidden">
                                        <table className="w-full text-xs text-left border-collapse text-slate-900" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            <thead className="bg-slate-100 text-slate-900 font-extrabold uppercase border-b border-slate-900 text-center">
                                                <tr>
                                                    <th className="p-1.5 border-r border-slate-900 w-14">SL NO</th>
                                                    <th className="p-1.5 border-r border-slate-900 w-28">TEST DATE</th>
                                                    {neetSubjects.map(sub => (
                                                        <th key={sub.name} className="p-1.5 border-r border-slate-900">
                                                            {abbreviateSubject(sub.name)}
                                                        </th>
                                                    ))}
                                                    <th className="p-1.5 w-20">TOTAL</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-900 text-center">
                                                {groupedExams.neetExams.map((exam, index) => {
                                                    const dates = getExamDates(exam);
                                                    const total = getRowTotal(exam, neetSubjects);

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
                                                            {neetSubjects.map(sub => {
                                                                const subData = getSubjectExamData(exam, sub.name);
                                                                const displayVal = (subData.marks === 'ABSENT' || subData.marks === 'N/A' || subData.marks === 'NA' || subData.marks === null || subData.marks === undefined || subData.marks === '') ? 'NA' : subData.marks;
                                                                return (
                                                                    <td key={sub.name} className="p-1.5 border-r border-slate-900 font-bold">
                                                                        {displayVal}
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

                            {/* TABLE 3: KCET / CET EXAMS */}
                            {groupedExams.kcetExams.length > 0 && (
                                <div className="mb-6">
                                    <div className="text-center mb-2">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            KCET / CET EXAMS MARKS CARD (MAX MARKS – 180)
                                        </h3>
                                        <p className="text-[11px] font-black uppercase text-slate-800 tracking-widest decoration-dotted underline underline-offset-2" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            COMPETITIVE TEST RESULTS
                                        </p>
                                    </div>

                                    <div className="border border-slate-900 rounded overflow-hidden">
                                        <table className="w-full text-xs text-left border-collapse text-slate-900" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            <thead className="bg-slate-100 text-slate-900 font-extrabold uppercase border-b border-slate-900 text-center">
                                                <tr>
                                                    <th className="p-1.5 border-r border-slate-900 w-14">SL NO</th>
                                                    <th className="p-1.5 border-r border-slate-900 w-28">TEST DATE</th>
                                                    {kcetSubjects.map(sub => (
                                                        <th key={sub.name} className="p-1.5 border-r border-slate-900">
                                                            {abbreviateSubject(sub.name)}
                                                        </th>
                                                    ))}
                                                    <th className="p-1.5 w-20">TOTAL</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-900 text-center">
                                                {groupedExams.kcetExams.map((exam, index) => {
                                                    const dates = getExamDates(exam);
                                                    const total = getRowTotal(exam, kcetSubjects);

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
                                                            {kcetSubjects.map(sub => {
                                                                const subData = getSubjectExamData(exam, sub.name);
                                                                const displayVal = (subData.marks === 'ABSENT' || subData.marks === 'N/A' || subData.marks === 'NA' || subData.marks === null || subData.marks === undefined || subData.marks === '') ? 'NA' : subData.marks;
                                                                return (
                                                                    <td key={sub.name} className="p-1.5 border-r border-slate-900 font-bold">
                                                                        {displayVal}
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

                            {/* TABLE 4: THEORY UNIT TEST */}
                            {groupedExams.theoryExams.length > 0 && (
                                <div className="mb-6">
                                    <div className="text-center mb-2">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            THEORY UNIT TEST MARKS LIST
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-700" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                            (MAX MARKS – 25)
                                        </p>
                                    </div>

                                    <div className="border border-slate-900 rounded overflow-hidden">
                                        <table className="w-full text-xs text-left border-collapse text-slate-900" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
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
                                                                const displayVal = (subData.marks === 'ABSENT' || subData.marks === 'N/A' || subData.marks === 'NA' || subData.marks === null || subData.marks === undefined || subData.marks === '') ? 'NA' : subData.marks;
                                                                return (
                                                                    <td key={sub.name} className="p-1.5 border-r border-slate-900 font-bold">
                                                                        {displayVal}
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

                            {/* Report Card Footer Signs: Parent & Principal Only */}
                            <div 
                                className="flex justify-between items-center pt-16 px-6 text-center text-xs font-extrabold text-slate-800 tracking-wider uppercase"
                                style={{ fontFamily: '"Times New Roman", Times, serif' }}
                            >
                                <div className="w-44">
                                    <div className="border-t-2 border-dashed border-slate-700 pt-2">
                                        Parent Signature
                                    </div>
                                </div>
                                <div className="w-44">
                                    <div className="border-t-2 border-dashed border-slate-700 pt-2 text-slate-900 font-black">
                                        Principal Signature
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Embed print styles - overrides outer overflow-hidden wrappers on print */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm;
                    }
                    html, body, #root, #root > div, main {
                        background: white !important;
                        color: black !important;
                        font-family: 'Times New Roman', Times, serif !important;
                        height: auto !important;
                        min-height: 0 !important;
                        max-height: none !important;
                        overflow: visible !important;
                        overflow-y: visible !important;
                        overflow-x: visible !important;
                        position: static !important;
                        float: none !important;
                        flex: none !important;
                        box-shadow: none !important;
                    }
                    header, aside, nav, footer, button, select, input, form, .no-print-area, .no-print {
                        display: none !important;
                    }
                    .all-tests-printable-marksheet {
                        display: block !important;
                        visibility: visible !important;
                        position: relative !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 auto !important;
                        padding: 12px !important;
                        border: 2px solid black !important;
                        box-shadow: none !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .college-logo-img {
                        width: 70px !important;
                        height: 70px !important;
                        max-width: 70px !important;
                        max-height: 70px !important;
                        object-fit: contain !important;
                        display: block !important;
                    }
                }
            `}} />
        </div>
    );
};

export default AllTestsReport;

