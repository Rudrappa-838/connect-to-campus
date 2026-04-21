import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, Check } from 'lucide-react';
import api from '../../../../api/axios';
import toast from 'react-hot-toast';

const QuestionBankSelector = ({ onAddQuestions, academicConfig, subjectSelection, classSelection }) => {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [filters, setFilters] = useState({
        subject: subjectSelection || '',
        class_level: classSelection || '',
        chapter: '',
    });

    const [selectedIds, setSelectedIds] = useState(new Set());

    useEffect(() => {
        fetchQuestions();
    }, [page, filters]);

    // Keep filters synced with parent selection if needed
    useEffect(() => {
        if (subjectSelection) setFilters(f => ({ ...f, subject: subjectSelection }));
    }, [subjectSelection]);

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const res = await api.get('/question-bank/questions', {
                params: { ...filters, page, limit: 10 }
            });
            if (res.data.status === 'SUCCESS') {
                setQuestions(res.data.data);
                setTotalPages(res.data.pagination.totalPages);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load questions from bank");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (q) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(q.id)) {
            newSet.delete(q.id);
        } else {
            newSet.add(q.id);
        }
        setSelectedIds(newSet);
    };

    const handleAddSelected = () => {
        const selectedQuestions = questions.filter(q => selectedIds.has(q.id));
        if (selectedQuestions.length === 0) return toast.error("Select at least one question!");

        // Map database question format to UI format
        const mappedQuestions = selectedQuestions.map(q => ({
            id: q.id,
            question: q.question_text,
            type: 'MCQ',
            marks: q.difficulty_level === 'Hard' ? 4 : (q.difficulty_level === 'Medium' ? 3 : 2),
            answer: q.correct_option,
            options: [q.option_a, q.option_b, q.option_c, q.option_d],
            originalRecordId: q.id // keep track of the DB id!
        }));

        onAddQuestions(mappedQuestions);
        setSelectedIds(new Set());
        toast.success(`Added ${mappedQuestions.length} questions to the paper!`);
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-4 space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700">Database Question Bank</h3>
                <div className="text-sm font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg">
                    {selectedIds.size} Selected
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-3 gap-3">
                <select
                    className="p-2 border border-slate-200 rounded-lg text-sm outline-none"
                    value={filters.subject}
                    onChange={e => setFilters({ ...filters, subject: e.target.value, chapter: '', page: 1 })}
                >
                    <option value="">All Subjects</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Maths">Maths</option>
                    <option value="Biology">Biology</option>
                </select>
                <select
                    className="p-2 border border-slate-200 rounded-lg text-sm outline-none"
                    value={filters.class_level}
                    onChange={e => setFilters({ ...filters, class_level: e.target.value, page: 1 })}
                >
                    <option value="">All Classes</option>
                    <option value="PUC 1">PUC 1 / Class 11</option>
                    <option value="PUC 2">PUC 2 / Class 12</option>
                </select>
                <input
                    type="text"
                    placeholder="Search by Chapter..."
                    className="p-2 border border-slate-200 rounded-lg text-sm outline-none"
                    value={filters.chapter}
                    onChange={e => setFilters({ ...filters, chapter: e.target.value, page: 1 })}
                />
            </div>

            {/* Loading / List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden min-h-[300px] flex flex-col">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400">Loading DB...</div>
                ) : questions.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400 p-8 text-center">
                        No questions found matching your filters.<br />Run the Auto-Seeder script for "{filters.subject || 'Subject'}".
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto max-h-[400px] bg-slate-50">
                        {questions.map((q) => (
                            <div
                                key={q.id}
                                onClick={() => toggleSelection(q)}
                                className={`p-4 border-b border-slate-200 cursor-pointer transition-colors ${selectedIds.has(q.id) ? 'bg-indigo-50/80 border-l-4 border-l-indigo-500' : 'bg-white hover:bg-slate-50 border-l-4 border-l-transparent'}`}
                            >
                                <div className="flex gap-3">
                                    <div className="mt-1">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedIds.has(q.id) ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300'}`}>
                                            {selectedIds.has(q.id) && <Check size={14} />}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-800 text-sm mb-2">{q.question_text}</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                                            <div>A) {q.option_a}</div>
                                            <div>B) {q.option_b}</div>
                                            <div>C) {q.option_c}</div>
                                            <div>D) {q.option_d}</div>
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-600 px-2 py-0.5 rounded">{q.subject}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{q.chapter}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer / Pagination */}
            <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold disabled:opacity-50"
                    >
                        Prev
                    </button>
                    <span className="text-sm font-bold text-slate-500">Page {page} of {totalPages || 1}</span>
                    <button
                        disabled={page === totalPages || totalPages === 0}
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>

                <button
                    onClick={handleAddSelected}
                    disabled={selectedIds.size === 0}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-white transition-all ${selectedIds.size === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                    <Plus size={18} /> Add {selectedIds.size} Questions to Paper
                </button>
            </div>
        </div>
    );
};

export default QuestionBankSelector;
