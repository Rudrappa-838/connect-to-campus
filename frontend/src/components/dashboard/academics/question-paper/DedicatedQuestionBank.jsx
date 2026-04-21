import React, { useState } from 'react';
import { Database, Download, BookOpen, Layers, Target, CheckCircle2, ChevronRight, X, AlertCircle } from 'lucide-react';
import QuestionBankSelector from './QuestionBankSelector';
import api from '../../../../api/axios';
import toast from 'react-hot-toast';

const DedicatedQuestionBank = ({ config: academicConfig }) => {
    const [questions, setQuestions] = useState([]);
    const [paperConfig, setPaperConfig] = useState({
        classId: '',
        sectionId: '',
        subject: '',
        examName: '',
        examDate: ''
    });

    const availableSections = paperConfig.classId
        ? academicConfig?.classes?.find(c => c.class_id.toString() === paperConfig.classId)?.sections || []
        : [];

    const availableSubjects = paperConfig.classId
        ? academicConfig?.classes?.find(c => c.class_id.toString() === paperConfig.classId)?.subjects || []
        : [];

    const handleSaveAndGeneratePDFs = async () => {
        if (questions.length === 0) return toast.error("Please add questions from the bank first!");
        if (!paperConfig.classId || !paperConfig.subject || !paperConfig.examName) {
            return toast.error("Please fill in Class, Subject, and Exam Name.");
        }

        const loader = toast.loading("Generating your Master PDF Pack...", { icon: '🚀' });
        try {
            const payload = {
                title: paperConfig.examName,
                school_name: academicConfig?.name || 'School Name',
                exam_date: paperConfig.examDate || new Date().toISOString().split('T')[0],
                subject: paperConfig.subject,
                class_level: academicConfig?.classes?.find(c => c.class_id.toString() === paperConfig.classId)?.class_name || 'Grade 10',
                question_ids: questions.filter(q => q.originalRecordId).map(q => q.originalRecordId)
            };

            const res = await api.post('/question-bank/generate-paper', payload);
            if (res.data.status === 'SUCCESS') {
                toast.success("PDFs Generated Successfully!", { id: loader, duration: 4000 });
                // Open PDFs in new tabs
                if (res.data.data.mainUrl) window.open(api.defaults.baseURL.replace('/api', '') + res.data.data.mainUrl, '_blank');
                if (res.data.data.solutionsUrl) window.open(api.defaults.baseURL.replace('/api', '') + res.data.data.solutionsUrl, '_blank');
                if (res.data.data.keyUrl) window.open(api.defaults.baseURL.replace('/api', '') + res.data.data.keyUrl, '_blank');
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate PDFs on server.", { id: loader });
        }
    };

    const removeQuestion = (indexToRemove) => {
        setQuestions(questions.filter((_, idx) => idx !== indexToRemove));
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Hero Banner Header */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-800 to-indigo-900 text-white shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4"></div>

                <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
                                <Database className="text-blue-300 w-8 h-8" />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight drop-shadow-md">
                                NEET & JEE Master Bank
                            </h1>
                        </div>
                        <p className="text-blue-100 max-w-xl text-sm md:text-base leading-relaxed opacity-90 mt-2">
                            Access over 80,000 curriculum-aligned questions. Pick topics, build your paper, and instantly export high-quality, mathjax-rendered PDF sets containing the Main Paper, Solutions, and Answer Key.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 bg-white/5 p-4 rounded-2xl backdrop-blur-md border border-white/10">
                        <div className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">Current Selection</div>
                        <div className="text-4xl font-black text-white flex items-end gap-2">
                            {questions.length} <span className="text-base font-bold text-blue-300 mb-1">Questions</span>
                        </div>
                        <div className="h-2 w-full bg-black/20 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 transition-all duration-500" style={{ width: `${Math.min(100, (questions.length / 50) * 100)}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Panel: Configuration & Selector */}
                <div className="lg:col-span-7 space-y-6">

                    {/* Paper Configuration */}
                    <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                        <div className="flex items-center gap-2 mb-6 text-slate-800">
                            <Layers className="text-indigo-500 w-5 h-5" />
                            <h2 className="text-lg font-bold">Paper Configuration</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Class Level</label>
                                <select
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    value={paperConfig.classId}
                                    onChange={(e) => setPaperConfig({ ...paperConfig, classId: e.target.value, sectionId: '', subject: '' })}
                                >
                                    <option value="">Select Class</option>
                                    {academicConfig?.classes?.map(c => (
                                        <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Subject Selection</label>
                                <select
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    value={paperConfig.subject}
                                    onChange={(e) => setPaperConfig({ ...paperConfig, subject: e.target.value })}
                                >
                                    <option value="">Select Subject</option>
                                    {availableSubjects.map((sub, i) => (
                                        <option key={i} value={sub}>{sub}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Exam Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g. NEET Mock Test 1"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    value={paperConfig.examName}
                                    onChange={(e) => setPaperConfig({ ...paperConfig, examName: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Exam Date</label>
                                <input
                                    type="date"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    value={paperConfig.examDate}
                                    onChange={(e) => setPaperConfig({ ...paperConfig, examDate: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Question Bank Explorer */}
                    <div className="animate-in slide-in-from-bottom-4 duration-500 fade-in">
                        <div className="flex items-center gap-2 mb-4 px-2">
                            <Target className="text-indigo-500 w-5 h-5" />
                            <h2 className="text-lg font-bold text-slate-800">Browse Library</h2>
                        </div>
                        <QuestionBankSelector
                            onAddQuestions={(newQs) => setQuestions(prev => [...prev, ...newQs])}
                            academicConfig={academicConfig}
                            subjectSelection={paperConfig.subject}
                            classSelection={'PUC ' + (academicConfig?.classes?.find(c => c.class_id.toString() === paperConfig.classId)?.class_name || '')}
                        />
                    </div>
                </div>

                {/* Right Panel: Selected Questions & Export */}
                <div className="lg:col-span-5 relative">
                    <div className="sticky top-28 bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 flex flex-col h-[calc(100vh-140px)]">

                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <BookOpen className="text-emerald-500" /> Paper Preview
                            </h2>
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full text-sm">
                                {questions.length} Items
                            </span>
                        </div>

                        {/* Question List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 rounded-2xl border border-slate-100 p-2 space-y-2 mb-6">
                            {questions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400">
                                        <Database size={24} />
                                    </div>
                                    <p className="font-bold text-slate-700 mb-1">Cart is Empty</p>
                                    <p className="text-sm text-slate-500">Add questions from the bank to start building your PDF.</p>
                                </div>
                            ) : (
                                questions.map((q, i) => (
                                    <div key={i} className="group flex gap-3 p-4 bg-white rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all">
                                        <div className="shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-xs group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-800 text-sm mb-2 line-clamp-2">{q.question}</p>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                                    Ans: {q.answer}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeQuestion(i)}
                                            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors self-start opacity-0 group-hover:opacity-100"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Export Action */}
                        <div className="shrink-0">
                            {(!paperConfig.classId || !paperConfig.subject || !paperConfig.examName) && questions.length > 0 && (
                                <div className="flex items-start gap-2 text-amber-600 bg-amber-50 p-3 rounded-xl text-xs font-bold mb-4 border border-amber-200/50">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                    <p>Please complete Class, Subject, and Exam Title configuration before generating PDFs.</p>
                                </div>
                            )}

                            <button
                                onClick={handleSaveAndGeneratePDFs}
                                disabled={questions.length === 0}
                                className={`w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-xl ${questions.length === 0
                                        ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:scale-[1.02] hover:shadow-emerald-500/25 active:scale-95'
                                    }`}
                            >
                                <Download size={22} className={questions.length > 0 ? "animate-bounce" : ""} />
                                GENERATE MASTER PDF PACK
                            </button>
                            <p className="text-center text-[10px] text-slate-400 font-bold tracking-wider uppercase mt-3">
                                Creates 3 distinct files locally (Paper, Solutions, Key)
                            </p>
                        </div>

                    </div>
                </div>
            </div>

        </div>
    );
};

export default DedicatedQuestionBank;
