import React, { useState } from 'react';
import {
    Wand2, Image as ImageIcon, FileText, Download, RefreshCw,
    Plus, Trash2, CheckCircle, BrainCircuit, Type, Layers,
    Edit2, Eye, EyeOff, X, Database
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../api/axios';
import QuestionBankSelector from './QuestionBankSelector';

const QuestionPaperGenerator = ({ config: academicConfig }) => {
    const [mode, setMode] = useState('text'); // 'text' or 'image'
    const [generating, setGenerating] = useState(false);
    const [questions, setQuestions] = useState([]);

    // New State for Editing and Answers
    const [showAnswers, setShowAnswers] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [editingSettings, setEditingSettings] = useState(false); // For editing paper config

    // Configuration State
    const [paperConfig, setPaperConfig] = useState({
        topic: '',
        classId: '', // Store ID instead of name
        sectionId: '',
        subject: '',
        difficulty: 'medium', // easy, medium, hard
        questionCount: 5,
        type: 'mixed', // mcq, descriptive, mixed
        examName: 'Final Examination', // NEW: Editable exam name
        examDate: new Date().toISOString().split('T')[0] // NEW: Exam date
    });

    // NEW: State for adding custom questions
    const [showAddQuestion, setShowAddQuestion] = useState(false);
    const [newQuestion, setNewQuestion] = useState({
        question: '',
        type: 'Descriptive',
        marks: '5',
        answer: '',
        options: ['', '', '', '']
    });

    const [files, setFiles] = useState([]);

    // Get Sections for selected class
    const availableSections = React.useMemo(() => {
        if (!academicConfig?.classes || !paperConfig.classId) return [];
        const selectedClass = academicConfig.classes.find(c => c.class_id.toString() === paperConfig.classId.toString());
        return selectedClass?.sections || [];
    }, [academicConfig, paperConfig.classId]);

    // Get Subjects for selected class
    const availableSubjects = React.useMemo(() => {
        if (!academicConfig?.classes || !paperConfig.classId) return ['General'];
        const selectedClass = academicConfig.classes.find(c => c.class_id.toString() === paperConfig.classId.toString());
        return selectedClass?.subjects?.map(s => s.name) || ['General Knowledge', 'Science', 'Math'];
    }, [academicConfig, paperConfig.classId]);

    // Real AI Generation Logic
    const handleGenerate = async () => {
        if (mode === 'text' && !paperConfig.topic) return toast.error("Please enter instructions and topic");
        if (mode === 'image' && files.length === 0) return toast.error("Please upload an image for analysis");

        setGenerating(true);
        setQuestions([]); // Clear previous
        setShowAnswers(false);

        try {
            // resolve class name
            const selectedClass = academicConfig?.classes?.find(c => c.class_id.toString() === paperConfig.classId.toString());
            const className = selectedClass ? selectedClass.class_name : 'Grade 10';

            if (mode === 'text') {
                // New Prompt-Based Generation
                const res = await api.post('/ai/generate-paper', {
                    prompt: paperConfig.topic,
                    subject: paperConfig.subject,
                    class_level: className
                });

                if (res.data.sections) {
                    // Flatten sections to questions with section metadata
                    const flatQuestions = res.data.sections.flatMap((sec, sIdx) =>
                        sec.questions.map((q, qIdx) => ({
                            ...q,
                            id: `ai-${sIdx}-${qIdx}-${Date.now()}`,
                            question: q.text || q.question, // Robust mapping
                            section: sec.name,
                            type: q.type || (q.options ? 'MCQ' : 'Descriptive')
                        }))
                    );
                    setQuestions(flatQuestions);

                    if (res.data.title) {
                        setPaperConfig(prev => ({ ...prev, examName: res.data.title }));
                    }
                    toast.success("Paper Generated Successfully!");
                } else {
                    toast.error("Invalid AI Response format");
                }

            } else {
                // Image Based Generation (Legacy/Existing Route)
                const formData = new FormData();
                formData.append('topic', '');
                formData.append('subject', paperConfig.subject);
                formData.append('classLevel', className);

                files.forEach(file => {
                    formData.append('files', file);
                });

                const res = await api.post('/ai/generate-questions', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (res.data.questions) {
                    setQuestions(res.data.questions);
                    toast.success("Questions Generated Successfully!");
                }
            }

        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || "Failed to generate paper");
        } finally {
            setGenerating(false);
        }
    };

    const handleDeleteQuestion = (id) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const handleEditQuestion = (question) => {
        setEditingId(question.id);
        setEditForm({ ...question });
    };

    const handleSaveEdit = () => {
        setQuestions(questions.map(q => q.id === editingId ? editForm : q));
        setEditingId(null);
        setEditForm(null);
        toast.success("Question updated");
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditForm(null);
    };

    // NEW: Add custom question manually
    const handleAddQuestion = () => {
        if (!newQuestion.question.trim()) {
            return toast.error('Please enter a question');
        }

        const customQuestion = {
            id: Date.now(),
            question: newQuestion.question,
            type: newQuestion.type,
            marks: newQuestion.marks,
            answer: newQuestion.answer,
            options: newQuestion.type === 'MCQ' ? newQuestion.options : undefined
        };

        setQuestions([...questions, customQuestion]);
        setShowAddQuestion(false);
        setNewQuestion({
            question: '',
            type: 'Descriptive',
            marks: '5',
            answer: '',
            options: ['', '', '', '']
        });
        toast.success('Question added successfully!');
    };

    const handleFileUpload = (e) => {
        const fileList = Array.from(e.target.files);
        setFiles(fileList);
        toast.success(`${fileList.length} images uploaded`);
    };

    const handlePrint = (type = 'both') => {
        // Warning: Data not saved
        toast('⚠️ Note: This paper is not saved. Print/download now!', {
            duration: 3000,
            icon: '📄',
            style: {
                background: '#FEF3C7',
                color: '#92400E',
                fontWeight: 'bold'
            }
        });

        const printWindow = window.open('', '', 'width=800,height=600');

        let content = ``;

        // Add Header
        content += `
            <html>
            <head>
                <title></title>
                <style>
                    body { font-family: 'Arial', sans-serif; padding: 40px; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
                    .meta { display: flex; justify-content: space-between; margin-top: 10px; font-weight: bold; }
                    .question { margin-bottom: 20px; page-break-inside: avoid; }
                    .q-text { font-weight: bold; margin-bottom: 10px; display: block; }
                    .options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-left: 20px; }
                    .blanks { border-bottom: 1px dashed #000; display: inline-block; width: 100px; }
                    .match-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 10px; }
                    .answer-key { margin-top: 0px; padding-top: 20px; }
                    .answer-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
                </style>
            </head>
            <body>
        `;

        // Add Paper Content if requested
        if (type === 'paper' || type === 'both') {
            content += `
                <div class="header">
                    <h1>${paperConfig.examName || 'Final Examination'}</h1>
                    <div class="meta">
                        <span>Subject: ${paperConfig.subject || 'General'}</span>
                        <span>Class: ${academicConfig?.classes?.find(c => c.class_id.toString() === paperConfig.classId)?.class_name || 'Grade 10'}</span>
                        <span>Date: ${paperConfig.examDate || new Date().toLocaleDateString()}</span>
                        <span>Time: 2 Hours</span>
                        <span>Marks: ${questions.reduce((a, b) => a + (parseInt(b.marks) || 0), 0)}</span>
                    </div>
                </div>

                <div class="questions">
                    ${questions.map((q, i) => `
                        <div class="question">
                            <span class="q-text">Q${i + 1}. ${q.question} <span style="float:right">[${q.marks}]</span></span>
                            
                            ${q.type === 'MCQ' ? `
                                <div class="options">
                                    ${q.options?.map((opt, idx) => `<div>(${String.fromCharCode(65 + idx)}) ${opt}</div>`).join('')}
                                </div>
                            ` : ''}

                            ${q.type === 'MatchTheFollowing' ? `
                                <div class="match-grid">
                                    <div>
                                        <strong>Column A</strong>
                                        ${q.pairs?.map((p, idx) => `<div>${idx + 1}. ${p.left}</div>`).join('')}
                                    </div>
                                    <div>
                                        <strong>Column B</strong>
                                        ${q.pairs?.map((p, idx) => `<div>${String.fromCharCode(65 + idx)}. ${p.right}</div>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${q.type === 'Descriptive' ? '<div style="height: 100px;"></div>' : ''}
                            
                            ${q.type === 'FillInBlanks' ? '<div style="height: 20px;"></div>' : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if ((type === 'paper' || type === 'both') && (type === 'key' || type === 'both')) {
            content += `<div style="page-break-before: always;"></div>`;
        }

        // Add Key Content if requested
        if (type === 'key' || type === 'both') {
            content += `
                <div class="answer-key">
                    <h2 style="text-align: center; margin-bottom: 20px;">Answer Key</h2>
                    <div style="text-align: center; font-weight: bold; margin-bottom: 20px;">
                        ${paperConfig.subject || 'Subject'} - ${academicConfig?.classes?.find(c => c.class_id.toString() === paperConfig.classId)?.class_name || 'Grade 10'}
                    </div>
                    ${questions.map((q, i) => `
                        <div class="answer-item">
                            <span><strong>Q${i + 1}</strong> (${q.type})</span>
                            <span style="font-weight: bold; color: #166534;">${q.answer}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        content += `</body></html>`;

        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
    };

    const handleSaveAndGeneratePDFs = async () => {
        if (questions.length === 0) return toast.error("Please add questions first!");

        const loader = toast.loading("Connecting to PDF Generator Server...");
        try {
            const payload = {
                title: paperConfig.examName || 'Final Examination',
                school_name: academicConfig?.name || 'School Name',
                exam_date: paperConfig.examDate || new Date().toISOString().split('T')[0],
                subject: paperConfig.subject || 'General',
                class_level: academicConfig?.classes?.find(c => c.class_id.toString() === paperConfig.classId)?.class_name || 'Grade 10',
                question_ids: questions.filter(q => q.originalRecordId).map(q => q.originalRecordId)
            };

            // Warning if not all questions were from DB
            if (payload.question_ids.length !== questions.length) {
                toast.error("Note: Only questions selected from the Question Bank will be exported via API.");
            }

            const res = await api.post('/question-bank/generate-paper', payload);
            if (res.data.status === 'SUCCESS') {
                toast.success("PDFs Generated Successfully!", { id: loader });
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


    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BrainCircuit className="text-indigo-600" /> AI Question Paper Generator
                    </h1>
                    <p className="text-slate-500 text-sm">Generate exam papers instantly from Topics or Images using AI</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex bg-slate-200 rounded-lg overflow-hidden border border-slate-300">
                        <button
                            onClick={() => handlePrint('paper')}
                            className="flex items-center gap-2 px-4 py-2 text-slate-700 font-bold hover:bg-slate-300 transition-colors border-r border-slate-300"
                        >
                            Html Print
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Panel: Configuration */}
                <div className="lg:col-span-4 space-y-6">

                    {/* Mode Selection */}
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-2">
                        <button
                            onClick={() => setMode('text')}
                            className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${mode === 'text' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Type size={18} /> Topic AI
                        </button>
                        <button
                            onClick={() => setMode('image')}
                            className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${mode === 'image' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <ImageIcon size={18} /> Image AI
                        </button>
                    </div>

                    {/* Inputs */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">

                        {mode === 'text' ? (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Instructions & Content</label>
                                <textarea
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-400 font-medium leading-relaxed"
                                    rows="8"
                                    placeholder={`Describe the structure and topic in detail.
Example:
"Create a Science test on Light and Reflection.
- 5 Multiple Choice Questions
- 3 Short Answer Questions
- 2 Long Answer Questions (5 marks each)"`}
                                    value={paperConfig.topic}
                                    onChange={(e) => setPaperConfig({ ...paperConfig, topic: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-400 mt-2 text-right">The AI will follow your exact instructions for counts and marks.</p>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Upload Source Material</label>
                                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative">
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                                            <ImageIcon size={24} />
                                        </div>
                                        <p className="font-bold text-slate-600">Click or Drag images here</p>
                                        <p className="text-xs text-slate-400">Scan of textbook page, handwritten notes, etc.</p>
                                    </div>
                                </div>
                                {files.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        {files.map((f, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded-lg">
                                                <CheckCircle size={14} className="text-emerald-500" />
                                                <span className="truncate">{f.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Class</label>
                                <select
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium"
                                    value={paperConfig.classId}
                                    onChange={(e) => setPaperConfig({ ...paperConfig, classId: e.target.value, sectionId: '', subject: '' })}
                                >
                                    <option value="">Select Class</option>
                                    {academicConfig?.classes?.map(c => (
                                        <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                                    ))}
                                </select>
                            </div>
                            {availableSections.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Section</label>
                                    <select
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium"
                                        value={paperConfig.sectionId}
                                        onChange={(e) => setPaperConfig({ ...paperConfig, sectionId: e.target.value })}
                                        disabled={!paperConfig.classId}
                                    >
                                        <option value="">All Sections</option>
                                        {availableSections.map(sec => (
                                            <option key={sec.id} value={sec.id}>{sec.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Subject</label>
                                <select
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-medium"
                                    value={paperConfig.subject}
                                    onChange={(e) => setPaperConfig({ ...paperConfig, subject: e.target.value })}
                                >
                                    <option value="">Select Subject</option>
                                    {availableSubjects.map((sub, i) => (
                                        <option key={i} value={sub}>{sub}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Difficulty and Count REMOVED - Controlled by Prompt now */}

                        <button
                            onClick={handleGenerate}
                            disabled={generating}
                            className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2 transition-all ${generating ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white hover:scale-[1.02]'}`}
                        >
                            {generating ? (
                                <>
                                    <RefreshCw className="animate-spin" /> Processing AI...
                                </>
                            ) : (
                                <>
                                    <Wand2 /> Generate Paper
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Panel: Preview */}
                <div className="lg:col-span-8">
                    <div className="bg-white min-h-[600px] rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText className="text-slate-400" /> Generated Preview
                            </h3>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setShowAnswers(!showAnswers)}
                                    className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${showAnswers ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    {showAnswers ? <EyeOff size={14} /> : <Eye size={14} />}
                                    {showAnswers ? 'Hide Answers' : 'Show Answer Key'}
                                </button>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    {questions.length} Questions
                                </span>
                            </div>
                        </div>

                        {/* Permanent Warning Note */}
                        {questions.length > 0 && (
                            <div className="mx-6 mt-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <div className="text-amber-600 mt-0.5">⚠️</div>
                                    <div>
                                        <p className="font-bold text-amber-900 text-sm">Important: Paper Not Saved</p>
                                        <p className="text-amber-800 text-xs mt-1">
                                            This question paper is NOT saved to the database. Please download or print immediately after finalizing.
                                            Refreshing the page will lose all changes.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 p-8 space-y-6">
                            {questions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4 min-h-[400px]">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                                        <Wand2 size={32} className="opacity-50" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-lg text-slate-400">Your paper is empty</p>
                                        <p className="text-sm">Configure settings and click Generate</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                                    {/* Paper Header */}
                                    <div className="text-center border-b-2 border-slate-800 pb-6 mb-8 relative">
                                        {/* Edit Settings Button */}
                                        {!editingSettings && questions.length > 0 && (
                                            <button
                                                onClick={() => setEditingSettings(true)}
                                                className="absolute right-0 top-0 flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Edit Paper Settings"
                                            >
                                                <Edit2 size={14} /> Edit Settings
                                            </button>
                                        )}

                                        <h2 className="text-2xl font-bold uppercase tracking-widest text-slate-900 mb-4">{paperConfig.examName}</h2>

                                        {editingSettings ? (
                                            /* Edit Mode for Settings */
                                            <div className="space-y-4 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="text-left">
                                                        <label className="block text-xs font-bold text-slate-600 mb-1">Class</label>
                                                        <select
                                                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                                                            value={paperConfig.classId}
                                                            onChange={(e) => setPaperConfig({ ...paperConfig, classId: e.target.value })}
                                                        >
                                                            <option value="">Select Class</option>
                                                            {academicConfig?.classes?.map(c => (
                                                                <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {availableSections.length > 0 && (
                                                        <div className="text-left">
                                                            <label className="block text-xs font-bold text-slate-600 mb-1">Section</label>
                                                            <select
                                                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                                                                value={paperConfig.sectionId}
                                                                onChange={(e) => setPaperConfig({ ...paperConfig, sectionId: e.target.value })}
                                                                disabled={!paperConfig.classId}
                                                            >
                                                                <option value="">All Sections</option>
                                                                {availableSections.map(sec => (
                                                                    <option key={sec.id} value={sec.id}>{sec.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                    <div className="text-left">
                                                        <label className="block text-xs font-bold text-slate-600 mb-1">Subject</label>
                                                        <select
                                                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                                                            value={paperConfig.subject}
                                                            onChange={(e) => setPaperConfig({ ...paperConfig, subject: e.target.value })}
                                                        >
                                                            <option value="">Select Subject</option>
                                                            {availableSubjects.map((sub, i) => (
                                                                <option key={i} value={sub}>{sub}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 mt-3">
                                                    <div className="text-left">
                                                        <label className="block text-xs font-bold text-slate-600 mb-1">Examination Name</label>
                                                        <input
                                                            type="text"
                                                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                                                            value={paperConfig.examName}
                                                            onChange={(e) => setPaperConfig({ ...paperConfig, examName: e.target.value })}
                                                            placeholder="e.g., Final Examination, Mid-Term Test"
                                                        />
                                                    </div>
                                                    <div className="text-left">
                                                        <label className="block text-xs font-bold text-slate-600 mb-1">Exam Date</label>
                                                        <input
                                                            type="date"
                                                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                                                            value={paperConfig.examDate}
                                                            onChange={(e) => setPaperConfig({ ...paperConfig, examDate: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setEditingSettings(false)}
                                                        className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-white rounded-lg transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingSettings(false);
                                                            toast.success('Settings updated!');
                                                        }}
                                                        className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                                    >
                                                        Save Changes
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* View Mode for Settings */
                                            <div className="flex justify-between mt-4 text-sm font-bold text-slate-600">
                                                <span>Subject: {paperConfig.subject || 'General'}</span>
                                                {/* Find class Name from ID */}
                                                <span>Class: {academicConfig?.classes?.find(c => c.class_id.toString() === paperConfig.classId)?.class_name || 'Grade 10'}</span>
                                                <span>Date: {new Date(paperConfig.examDate).toLocaleDateString()}</span>
                                                <span>Time: 2 Hours</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Questions */}
                                    {questions.map((q, idx) => (
                                        <div key={q.id}>
                                            {/* Section Header */}
                                            {(idx === 0 || (q.section && q.section !== questions[idx - 1].section)) && (
                                                <div className="mt-6 mb-3 pb-1 border-b-2 border-slate-200">
                                                    <h3 className="font-bold text-slate-700 uppercase tracking-widest text-sm">{q.section || 'Questions'}</h3>
                                                </div>
                                            )}

                                            <div className={`group relative pl-4 pr-20 hover:bg-slate-50 rounded-lg p-4 -mx-4 transition-colors ${editingId === q.id ? 'bg-indigo-50/50 ring-2 ring-indigo-500/20' : ''}`}>

                                                {/* Action Buttons */}
                                                {editingId !== q.id && (
                                                    <div className="absolute right-2 top-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-sm">
                                                        <button
                                                            onClick={() => handleEditQuestion(q)}
                                                            className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 border border-transparent hover:border-indigo-200"
                                                            title="Edit Question"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteQuestion(q.id)}
                                                            className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 border border-transparent hover:border-rose-200"
                                                            title="Delete Question"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}

                                                <div className="flex gap-4">
                                                    <span className="font-bold text-slate-800 min-w-[24px] pt-1">Q{idx + 1}.</span>
                                                    <div className="flex-1">

                                                        {/* Edit Mode */}
                                                        {editingId === q.id ? (
                                                            <div className="space-y-3">
                                                                <textarea
                                                                    className="w-full p-3 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium"
                                                                    value={editForm.question}
                                                                    onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                                                                    rows={3}
                                                                />

                                                                <div className="flex gap-4">
                                                                    <div className="flex-1">
                                                                        <label className="text-xs font-bold text-slate-500 uppercase">Marks</label>
                                                                        <input
                                                                            type="number"
                                                                            className="w-full p-2 border border-slate-200 rounded-lg mt-1"
                                                                            value={editForm.marks}
                                                                            onChange={(e) => setEditForm({ ...editForm, marks: e.target.value })}
                                                                        />
                                                                    </div>
                                                                    <div className="flex-[3]">
                                                                        <label className="text-xs font-bold text-slate-500 uppercase">Answer Key</label>
                                                                        <input
                                                                            type="text"
                                                                            className="w-full p-2 border border-slate-200 rounded-lg mt-1"
                                                                            value={editForm.answer}
                                                                            onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Options Editing for MCQ */}
                                                                {editForm.type === 'MCQ' && (
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        {editForm.options.map((opt, i) => (
                                                                            <input
                                                                                key={i}
                                                                                className="p-2 border border-slate-200 rounded-lg text-sm"
                                                                                value={opt}
                                                                                onChange={(e) => {
                                                                                    const newOpts = [...editForm.options];
                                                                                    newOpts[i] = e.target.value;
                                                                                    setEditForm({ ...editForm, options: newOpts });
                                                                                }}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Pairs Editing for MatchTheFollowing */}
                                                                {editForm.type === 'MatchTheFollowing' && (
                                                                    <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                                                                        <p className="text-xs font-bold text-slate-500 uppercase">Pairs (Left - Right)</p>
                                                                        {editForm.pairs?.map((pair, i) => (
                                                                            <div key={i} className="flex gap-2">
                                                                                <input
                                                                                    className="flex-1 p-2 border border-slate-200 rounded-lg text-sm"
                                                                                    value={pair.left}
                                                                                    onChange={(e) => {
                                                                                        const newPairs = [...editForm.pairs];
                                                                                        newPairs[i].left = e.target.value;
                                                                                        setEditForm({ ...editForm, pairs: newPairs });
                                                                                    }}
                                                                                    placeholder="Left Side"
                                                                                />
                                                                                <input
                                                                                    className="flex-1 p-2 border border-slate-200 rounded-lg text-sm"
                                                                                    value={pair.right}
                                                                                    onChange={(e) => {
                                                                                        const newPairs = [...editForm.pairs];
                                                                                        newPairs[i].right = e.target.value;
                                                                                        setEditForm({ ...editForm, pairs: newPairs });
                                                                                    }}
                                                                                    placeholder="Right Match"
                                                                                />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                <div className="flex justify-end gap-2 mt-2">
                                                                    <button onClick={handleCancelEdit} className="px-3 py-1.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                                                                    <button onClick={handleSaveEdit} className="px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Changes</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            /* View Mode */
                                                            <>
                                                                <p className="text-slate-800 font-medium mb-3">{q.question}</p>

                                                                {q.type === 'MCQ' && (
                                                                    <div className="grid grid-cols-2 gap-3 pl-2">
                                                                        {q.options.map((opt, i) => (
                                                                            <div key={i} className="flex items-center gap-2">
                                                                                <div className="w-4 h-4 rounded-full border border-slate-300"></div>
                                                                                <span className="text-sm text-slate-600">{opt}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {q.type === 'Descriptive' && (
                                                                    <div className="w-full h-20 border-b border-slate-200 border-dotted mt-2"></div>
                                                                )}

                                                                {q.type === 'FillInBlanks' && (
                                                                    <div className="h-6 w-full border-b border-slate-300 border-dashed opacity-50 mt-1"></div>
                                                                )}

                                                                {q.type === 'MatchTheFollowing' && (
                                                                    <div className="bg-white border border-slate-200 rounded-lg p-4 mt-2 mr-20">
                                                                        <div className="grid grid-cols-2 gap-6 relative">
                                                                            {/* Divider Line */}
                                                                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 -translate-x-1/2"></div>

                                                                            <div className="space-y-3 pr-4">
                                                                                <h4 className="font-bold text-xs uppercase text-slate-400 mb-2">Column A</h4>
                                                                                {q.pairs?.map((pair, i) => (
                                                                                    <div key={i} className="flex items-start gap-2 min-h-[32px]">
                                                                                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0 mt-0.5">{i + 1}</span>
                                                                                        <span className="text-sm text-slate-700 break-words flex-1">{pair.left}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>

                                                                            <div className="space-y-3 pl-4">
                                                                                <h4 className="font-bold text-xs uppercase text-slate-400 mb-2">Column B</h4>
                                                                                {q.pairs?.map((pair, i) => (
                                                                                    <div key={i} className="flex items-start gap-2 min-h-[32px]">
                                                                                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0 mt-0.5">{String.fromCharCode(65 + i)}</span>
                                                                                        <span className="text-sm text-slate-700 break-words flex-1">{pair.right}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Answer Key Display */}
                                                                {showAnswers && (
                                                                    <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-start gap-2">
                                                                        <CheckCircle size={16} className="text-emerald-600 mt-0.5" />
                                                                        <div>
                                                                            <span className="text-xs font-bold text-emerald-600 uppercase">Answer Key:</span>
                                                                            <p className="text-sm text-emerald-800 font-medium">{q.answer}</p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>

                                                    {editingId !== q.id && (
                                                        <div className="text-xs font-bold text-slate-400">
                                                            [{q.marks} Marks]
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add Question Button */}
                                    {questions.length > 0 && (
                                        <button
                                            onClick={() => setShowAddQuestion(true)}
                                            className="w-full py-4 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-600 font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Plus size={20} /> Add Custom Question
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Question Modal */}
            {
                showAddQuestion && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
                                <h3 className="text-xl font-bold text-slate-800">Add Custom Question</h3>
                                <button
                                    onClick={() => setShowAddQuestion(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Question Type */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-2">Question Type</label>
                                    <select
                                        className="w-full p-3 border border-slate-200 rounded-lg font-medium"
                                        value={newQuestion.type}
                                        onChange={(e) => setNewQuestion({ ...newQuestion, type: e.target.value })}
                                    >
                                        <option value="Descriptive">Descriptive</option>
                                        <option value="MCQ">Multiple Choice (MCQ)</option>
                                        <option value="FillInBlanks">Fill in the Blanks</option>
                                        <option value="TrueFalse">True/False</option>
                                    </select>
                                </div>

                                {/* Question Text */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-2">Question</label>
                                    <textarea
                                        className="w-full p-3 border border-slate-200 rounded-lg font-medium"
                                        rows="3"
                                        value={newQuestion.question}
                                        onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                                        placeholder="Enter your question here..."
                                    />
                                </div>

                                {/* MCQ Options */}
                                {newQuestion.type === 'MCQ' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-2">Options</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {newQuestion.options.map((opt, i) => (
                                                <input
                                                    key={i}
                                                    type="text"
                                                    className="p-2 border border-slate-200 rounded-lg text-sm"
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const newOpts = [...newQuestion.options];
                                                        newOpts[i] = e.target.value;
                                                        setNewQuestion({ ...newQuestion, options: newOpts });
                                                    }}
                                                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Marks and Answer */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-2">Marks</label>
                                        <input
                                            type="number"
                                            className="w-full p-3 border border-slate-200 rounded-lg font-medium"
                                            value={newQuestion.marks}
                                            onChange={(e) => setNewQuestion({ ...newQuestion, marks: e.target.value })}
                                            min="1"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-600 mb-2">Answer Key</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 border border-slate-200 rounded-lg font-medium"
                                            value={newQuestion.answer}
                                            onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value })}
                                            placeholder={newQuestion.type === 'MCQ' ? 'e.g., A or Option A' : 'Correct answer'}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                                <button
                                    onClick={() => setShowAddQuestion(false)}
                                    className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddQuestion}
                                    className="px-6 py-2.5 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Add Question
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default QuestionPaperGenerator;
