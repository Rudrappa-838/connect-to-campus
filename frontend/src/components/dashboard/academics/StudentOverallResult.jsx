import React, { useState, useCallback } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { Search, User, FileText, GraduationCap, Calendar, Award, Printer, AlertCircle, Info, CheckSquare, Square, BookOpen, X, Download } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import ProfessionalMarksheet from './ProfessionalMarksheet';

const StudentOverallResult = () => {
    const [admissionNo, setAdmissionNo] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [selectedExams, setSelectedExams] = useState([]);
    const [printPUC, setPrintPUC] = useState(false);
    const [wordTemplates, setWordTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState('STANDARD');
    const [previewBlob, setPreviewBlob] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const previewContainerRef = React.useRef(null);
    const [school, setSchool] = useState(() => {
        try { return JSON.parse(localStorage.getItem('school') || '{}'); } catch { return {}; }
    });

    React.useEffect(() => {
        // Fetch fresh school configuration and custom templates
        const loadSettings = async () => {
            try {
                const schoolRes = await api.get('/schools/my-school');
                if (schoolRes.data) {
                    const s = schoolRes.data.data || schoolRes.data;
                    setSchool(s);
                    setSelectedTemplate(s.marksheet_template || 'STANDARD');
                }

                const templatesRes = await api.get('/schools/my-school/word-templates').catch(() => null);
                if (templatesRes && templatesRes.data) {
                    setWordTemplates(templatesRes.data);
                }
            } catch (error) {
                console.error('Error loading print settings:', error);
            }
        };
        loadSettings();
    }, []);

    const handlePrint = () => {
        window.print();
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!admissionNo.trim()) {
            toast.error('Please enter an Admission Number');
            return;
        }

        setLoading(true);
        setResult(null);
        setSearched(true);
        setErrorMessage('');
        setSelectedExams([]);

        try {
            const res = await api.get('/marks/student-all', {
                params: { admission_no: admissionNo }
            });

            if (res.data) {
                setResult(res.data);
                setErrorMessage('');
                // Select all exams by default
                setSelectedExams(res.data.exams.map((_, index) => index));
                // Show success toast only for active students
                if (res.data.student.status === 'Active') {
                    toast.success('Student records found');
                }
            }
        } catch (error) {
            console.error('Error fetching student result:', error);
            const msg = error.response?.data?.message || 'Failed to fetch results';
            const note = error.response?.data?.note || '';
            setErrorMessage(msg + (note ? ` - ${note}` : ''));
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const toggleExamSelection = (index) => {
        setSelectedExams(prev => {
            if (prev.includes(index)) {
                return prev.filter(i => i !== index);
            } else {
                return [...prev, index];
            }
        });
    };

    const toggleSelectAll = () => {
        if (selectedExams.length === result.exams.length) {
            setSelectedExams([]);
        } else {
            setSelectedExams(result.exams.map((_, index) => index));
        }
    };

    const handlePrintSelected = () => {
        if (selectedExams.length === 0) {
            toast.error('Please select at least one marksheet to print');
            return;
        }
        window.print();
    };

    const handlePrintPUC = useCallback(() => {
        if (!result || selectedExams.length === 0) {
            toast.error('Please select at least one exam to print');
            return;
        }
        setPrintPUC(true);
        setTimeout(() => {
            window.print();
            setTimeout(() => setPrintPUC(false), 500);
        }, 200);
    }, [result, selectedExams]);

    const handleDownloadWord = async () => {
        if (!result) return;

        // Extract template ID from selectedTemplate (e.g., "WORD_1" -> "1")
        let templateId = selectedTemplate.startsWith('WORD_') ? selectedTemplate.split('_')[1] : null;
        if (!templateId) {
            toast.error('Please select a custom Word template from the dropdown first');
            return;
        }

        // Must have at least one exam selected
        if (selectedExams.length === 0) {
            toast.error('Please select an exam first to generate the marksheet');
            return;
        }

        // Pass the ID of the first selected exam to the API for filtering
        const examId = result.exams[selectedExams[0]]?.id;
        if (!examId) {
            toast.error('Could not determine exam ID. Please try again.');
            return;
        }

        toast.loading('Preparing Preview...', { id: 'word-gen' });
        try {
            const response = await api.get(`/marks/marksheet/word/${templateId}`, {
                params: {
                    admission_no: result.student.admission_no,
                    selected_exam_id: examId,
                    year: result.year
                },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            setPreviewBlob(blob);
            setShowPreview(true);
            toast.success('Preview Ready!', { id: 'word-gen' });
        } catch (error) {
            console.error('Word Generation Error:', error);
            toast.error('Failed to generate marksheet', { id: 'word-gen' });
        }
    };

    const handleDownloadActual = () => {
        if (!previewBlob) return;
        const url = window.URL.createObjectURL(previewBlob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${result.student.name}_Marksheet.docx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    React.useEffect(() => {
        if (showPreview && previewBlob && previewContainerRef.current) {
            // Clear previous content
            previewContainerRef.current.innerHTML = '';
            renderAsync(previewBlob, previewContainerRef.current)
                .then(() => console.log("docx rendered"))
                .catch(err => {
                    console.error("docx render error", err);
                    toast.error('Failed to render preview. You can still download the file.');
                });
        }
    }, [showPreview, previewBlob]);

    // ── PUC Marksheet Print View ─────────────────────
    if (printPUC && result) {
        const selectedExamData = result.exams.filter((_, i) => selectedExams.includes(i));
        return (
            <div className="puc-print-wrapper">
                <style>{`
                    @media print {
                        body * { visibility: hidden; }
                        .puc-print-wrapper, .puc-print-wrapper * { visibility: visible; }
                        .puc-print-wrapper { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
                        /* Ensure no extra pages are generated */
                        html, body {
                            height: 100vh; 
                            margin: 0 !important; 
                            padding: 0 !important;
                            overflow: hidden;
                        }
                    }
                    /* This margin: 0 removes the browser's default headers (date, title) and footers (localhost URL, page number) */
                    @page { 
                        size: A4 portrait; 
                        margin: 0mm; 
                    }
                `}</style>
                {selectedExamData.map((exam, i) => {
                    const marks = (exam.subjects || []).map(s => ({
                        subject_name: s.subject,
                        subject_code: s.subject_code || null,
                        marks_obtained: s.marks,
                        max_marks: s.max,
                    }));
                    return (
                        <ProfessionalMarksheet
                            key={i}
                            student={result.student}
                            exam={{ exam_name: exam.exam_name, exam_date: null, marks }}
                            school={school}
                        />
                    );
                })}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-6 text-white shadow-xl print:hidden">
                <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                        <GraduationCap className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black">Student Overall Result</h2>
                        <p className="text-blue-100 text-sm">View complete academic history for a student</p>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-2xl shadow-lg p-6 print:hidden">
                <form onSubmit={handleSearch} className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Student Admission Number</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                value={admissionNo}
                                onChange={(e) => setAdmissionNo(e.target.value)}
                                placeholder="Enter Admission No (e.g. ST-2024-001)"
                                className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 placeholder:font-normal"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-[50px]"
                    >
                        {loading ? 'Searching...' : 'Search'}
                        {!loading && <Search className="w-4 h-4" />}
                    </button>
                </form>
            </div>

            {/* Error Message - Below Search Bar */}
            {errorMessage && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4 flex items-start gap-3 print:hidden">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    <div>
                        <h4 className="font-bold text-red-800 mb-1">No Records Found</h4>
                        <p className="text-sm text-red-700">{errorMessage}</p>
                    </div>
                </div>
            )}

            {/* Deleted Student Notice */}
            {result && result.note && (
                <div className="bg-amber-50 border-l-4 border-amber-500 rounded-xl p-4 flex items-start gap-3 print:hidden">
                    <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                        <h4 className="font-bold text-amber-800 mb-1">Deleted Student Record</h4>
                        <p className="text-sm text-amber-700">{result.note}</p>
                    </div>
                </div>
            )}

            {/* Results */}
            {result ? (
                <div className="space-y-6">
                    {/* Student Profile */}
                    <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col md:flex-row justify-between items-center gap-6 border-l-4 border-blue-500 print:shadow-none print:border-0">
                        <div className="flex items-center gap-6 w-full">
                            <div className="bg-blue-50 p-4 rounded-full print:hidden">
                                <User className="w-10 h-10 text-blue-600" />
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-2xl font-black text-slate-800 uppercase">{result.student.name}</h3>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2 text-sm text-slate-600 font-bold">
                                    <span className="bg-slate-100 px-3 py-1 rounded-lg print:bg-transparent print:p-0">ID: {result.student.admission_no}</span>
                                    {result.student.roll_number && <span className="bg-slate-100 px-3 py-1 rounded-lg print:bg-transparent print:p-0">Roll: {result.student.roll_number}</span>}
                                    {result.student.class_id && <span className="bg-slate-100 px-3 py-1 rounded-lg print:bg-transparent print:p-0">Class ID: {result.student.class_id}</span>}
                                    {result.student.status && (
                                        <span className={`px-3 py-1 rounded-lg font-bold ${result.student.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {result.student.status}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 print:hidden shrink-0">
                            <div className="flex items-center gap-2 mr-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Template:</label>
                                <select
                                    value={selectedTemplate}
                                    onChange={(e) => setSelectedTemplate(e.target.value)}
                                    className="p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none min-w-[180px]"
                                >
                                    <optgroup label="System Layouts">
                                        <option value="STANDARD">Standard Layout</option>
                                        <option value="PUC_KARNATAKA">PUC Karnataka</option>
                                    </optgroup>
                                    {wordTemplates.length > 0 && (
                                        <optgroup label="Custom Word Templates">
                                            {wordTemplates.map(t => (
                                                <option key={t.id} value={`WORD_${t.id}`}>{t.name}</option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>

                            <button
                                onClick={toggleSelectAll}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
                            >
                                {selectedExams.length === result.exams.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                {selectedExams.length === result.exams.length ? 'Deselect All' : 'Select All'}
                            </button>

                            {selectedTemplate === 'PUC_KARNATAKA' ? (
                                <button
                                    onClick={handlePrintPUC}
                                    className="bg-green-700 hover:bg-green-800 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2"
                                >
                                    <BookOpen className="w-4 h-4" />
                                    Print PUC ({selectedExams.length})
                                </button>
                            ) : selectedTemplate.startsWith('WORD_') ? (
                                <button
                                    onClick={handleDownloadWord}
                                    className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    View Marksheet
                                </button>
                            ) : (
                                <button
                                    onClick={handlePrintSelected}
                                    className="bg-slate-700 hover:bg-slate-800 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2"
                                >
                                    <Printer className="w-4 h-4" />
                                    Print Standard ({selectedExams.length})
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Exams List */}
                    <div className="grid grid-cols-1 gap-6">
                        {result.exams.length > 0 ? (
                            result.exams.map((exam, index) => {
                                const isSelected = selectedExams.includes(index);
                                const shouldPrint = isSelected;

                                return (
                                    <div
                                        key={index}
                                        className={`bg-white rounded-2xl shadow-lg overflow-hidden transition-all hover:shadow-xl border-2 ${isSelected ? 'border-blue-500' : 'border-slate-100'
                                            } ${isSelected ? '' : 'hidden'}`}
                                    >
                                        {/* Exam Header */}
                                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                {/* Checkbox for selection */}
                                                <button
                                                    onClick={() => toggleExamSelection(index)}
                                                    className="print:hidden hover:bg-slate-200 p-2 rounded-lg transition-colors"
                                                >
                                                    {isSelected ? (
                                                        <CheckSquare className="w-5 h-5 text-blue-600" />
                                                    ) : (
                                                        <Square className="w-5 h-5 text-slate-400" />
                                                    )}
                                                </button>
                                                <div className="bg-blue-100 p-2 rounded-lg">
                                                    <FileText className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <h4 className="font-bold text-lg text-slate-800">{exam.exam_name}</h4>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => {
                                                        setSelectedExams([index]);
                                                        // Use a short timeout to ensure state update if needed, though handleDownloadWord uses result
                                                        setTimeout(() => handleDownloadWord(), 100);
                                                    }}
                                                    className="print:hidden bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border border-blue-200 transition-all shadow-sm"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    View Marksheet
                                                </button>
                                                <div className="text-right ml-2">
                                                    <div className="text-xs font-bold text-slate-500 uppercase">Total</div>
                                                    <div className="font-black text-slate-800">{exam.total_obtained} / {exam.total_max}</div>
                                                </div>
                                                <div className={`px-4 py-2 rounded-xl font-bold text-white shadow-md ${parseFloat(exam.percentage) >= 90 ? 'bg-green-500' :
                                                    parseFloat(exam.percentage) >= 75 ? 'bg-blue-500' :
                                                        parseFloat(exam.percentage) >= 60 ? 'bg-indigo-500' :
                                                            parseFloat(exam.percentage) >= 40 ? 'bg-orange-500' : 'bg-red-500'
                                                    }`}>
                                                    {exam.percentage}%
                                                </div>
                                            </div>
                                        </div>

                                        {/* Subjects Table */}
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left">Subject</th>
                                                        <th className="px-6 py-3 text-center">Max Marks</th>
                                                        <th className="px-6 py-3 text-center">Obtained</th>
                                                        <th className="px-6 py-3 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 text-sm">
                                                    {exam.subjects.map((sub, idx) => {
                                                        const pass = (sub.marks / sub.max) * 100 >= 35; // Assuming 35% pass
                                                        return (
                                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-6 py-3 font-semibold text-slate-700">{sub.subject}</td>
                                                                <td className="px-6 py-3 text-center text-slate-500">{sub.max}</td>
                                                                <td className="px-6 py-3 text-center font-bold text-slate-800">{sub.marks}</td>
                                                                <td className="px-6 py-3 text-center">
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${pass ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                                                        {pass ? 'PASS' : 'FAIL'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No exam records found for this student.</p>
                            </div>
                        )}
                    </div>

                    {/* Word Preview Modal */}
                    {showPreview && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 p-2 rounded-xl">
                                            <FileText className="text-blue-600 w-6 h-6" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-800">Marksheet Preview</h2>
                                            <p className="text-xs text-slate-500">Document generated from your Word template</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleDownloadActual}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold text-sm shadow-md"
                                        >
                                            <Download className="w-4 h-4" /> Download
                                        </button>
                                        <button
                                            onClick={() => setShowPreview(false)}
                                            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-200">
                                    <div
                                        ref={previewContainerRef}
                                        className="bg-white shadow-lg mx-auto min-h-screen docx-preview-container p-4 md:p-10"
                                        style={{ maxWidth: '850px' }}
                                    >
                                        <div className="flex items-center justify-center p-20">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 border-t border-slate-100 flex justify-center bg-slate-50">
                                    <p className="text-xs text-slate-500 font-medium">✨ This is a live preview. Click Download to save the official .docx file.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
};

export default StudentOverallResult;
