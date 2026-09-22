import React, { useState, useEffect } from 'react';
import { X, BookOpen, ShieldCheck, Check, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const RenameSubjectModal = ({ isOpen, onClose, schoolId, onRenamed, initialSubject = null }) => {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [subjectsSummary, setSubjectsSummary] = useState([]);
    const [selectedSubjectName, setSelectedSubjectName] = useState('');
    const [newName, setNewName] = useState('');
    const [applyToAll, setApplyToAll] = useState(true);
    const [selectedClassIds, setSelectedClassIds] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchSummary();
        } else {
            resetForm();
        }
    }, [isOpen, schoolId]);

    const resetForm = () => {
        setSelectedSubjectName('');
        setNewName('');
        setApplyToAll(true);
        setSelectedClassIds([]);
    };

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const url = schoolId ? `/classes/school-subjects?schoolId=${schoolId}` : '/classes/school-subjects';
            const res = await api.get(url);
            setSubjectsSummary(res.data || []);

            if (initialSubject) {
                const match = (res.data || []).find(s => s.name.toLowerCase() === initialSubject.toLowerCase());
                if (match) {
                    selectSubject(match);
                }
            }
        } catch (error) {
            console.error('Failed to load subjects summary', error);
            toast.error('Failed to load existing subjects list');
        } finally {
            setLoading(false);
        }
    };

    const selectSubject = (sub) => {
        setSelectedSubjectName(sub.name);
        setNewName(sub.name);
        const allIds = (sub.class_details || []).map(cd => cd.class_id);
        setSelectedClassIds(allIds);
        setApplyToAll(true);
    };

    const activeSubject = subjectsSummary.find(s => s.name.toLowerCase() === selectedSubjectName.toLowerCase());

    const toggleClassSelection = (classId) => {
        if (selectedClassIds.includes(classId)) {
            setSelectedClassIds(selectedClassIds.filter(id => id !== classId));
            setApplyToAll(false);
        } else {
            const next = [...selectedClassIds, classId];
            setSelectedClassIds(next);
            if (activeSubject && next.length === (activeSubject.class_details || []).length) {
                setApplyToAll(true);
            }
        }
    };

    const handleSelectAllToggle = (checked) => {
        setApplyToAll(checked);
        if (checked && activeSubject) {
            setSelectedClassIds((activeSubject.class_details || []).map(cd => cd.class_id));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedSubjectName.trim()) {
            return toast.error('Please select a subject to rename.');
        }

        const trimmedNew = newName.trim();
        if (!trimmedNew) {
            return toast.error('Please enter the new subject name.');
        }

        if (trimmedNew.toLowerCase() === selectedSubjectName.trim().toLowerCase()) {
            return toast.error('New name must be different from current name.');
        }

        if (!applyToAll && selectedClassIds.length === 0) {
            return toast.error('Please select at least one class to apply the rename to.');
        }

        setSubmitting(true);
        try {
            const payload = {
                schoolId,
                oldName: selectedSubjectName.trim(),
                newName: trimmedNew,
                classIds: applyToAll ? [] : selectedClassIds
            };

            const res = await api.put('/classes/rename-subject', payload);

            toast.success(res.data.message || `Subject renamed to "${trimmedNew}"!`, { duration: 5000 });
            if (onRenamed) onRenamed(trimmedNew);
            onClose();
        } catch (error) {
            console.error('Rename subject error:', error);
            const msg = error.response?.data?.message || 'Failed to rename subject.';
            toast.error(msg, { duration: 5000 });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div
                className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl">
                            <BookOpen size={20} className="text-indigo-300" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">Rename Subject</h2>
                            <p className="text-xs text-slate-300">Renames subject across classes while keeping all entered marks safe</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-5">
                    {/* Safe Rename Notice */}
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-900">
                        <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-1">
                            <p className="font-bold text-emerald-800">100% Safe Academic Rename</p>
                            <p className="text-emerald-700">
                                Marks, exam schedules, and timetables already recorded for this subject will remain completely intact and will automatically display under the new name.
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                            <RefreshCw size={24} className="animate-spin text-indigo-500" />
                            <span className="text-sm">Loading existing subjects...</span>
                        </div>
                    ) : subjectsSummary.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            <BookOpen size={36} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-sm font-semibold">No subjects found for this school.</p>
                            <p className="text-xs text-slate-400 mt-1">Add subjects to classes first in Class Management.</p>
                        </div>
                    ) : (
                        <form id="renameSubjectForm" onSubmit={handleSubmit} className="space-y-4">
                            {/* Step 1: Select Subject */}
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                    1. Select Subject to Rename
                                </label>
                                <select
                                    value={selectedSubjectName}
                                    onChange={(e) => {
                                        const sub = subjectsSummary.find(s => s.name === e.target.value);
                                        if (sub) selectSubject(sub);
                                        else {
                                            setSelectedSubjectName('');
                                            setNewName('');
                                        }
                                    }}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                >
                                    <option value="">-- Choose a subject --</option>
                                    {subjectsSummary.map(s => (
                                        <option key={s.name} value={s.name}>
                                            {s.name} ({s.class_count} class{s.class_count !== 1 ? 'es' : ''}{s.marks_count > 0 ? `, ${s.marks_count} marks` : ''})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {activeSubject && (
                                <>
                                    {/* Active Subject Stats */}
                                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Configured in</span>
                                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                                {activeSubject.class_count} Class{activeSubject.class_count !== 1 ? 'es' : ''}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {(activeSubject.class_details || []).map(cd => (
                                                <span
                                                    key={cd.id}
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs"
                                                >
                                                    <Layers size={11} className="text-slate-400" />
                                                    {cd.class_name}
                                                    {cd.type && <span className="text-[10px] text-slate-400 font-normal">({cd.type})</span>}
                                                </span>
                                            ))}
                                        </div>

                                        {activeSubject.marks_count > 0 && (
                                            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                                                <span className="text-slate-500">Marks records linked:</span>
                                                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                                    {activeSubject.marks_count} mark entries preserved
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Step 2: New Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                                            2. New Subject Name
                                        </label>
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            placeholder="e.g. Computer"
                                            autoFocus
                                            className="w-full px-3.5 py-2.5 bg-white border border-indigo-300 rounded-xl text-slate-900 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all placeholder:font-normal"
                                        />
                                        {newName.trim() && newName.trim().toLowerCase() !== selectedSubjectName.toLowerCase() && (
                                            <p className="text-xs text-indigo-600 mt-1.5 flex items-center gap-1 font-medium">
                                                <span>Will rename:</span>
                                                <span className="line-through text-slate-400">{selectedSubjectName}</span>
                                                <span>→</span>
                                                <span className="font-bold text-indigo-700">{newName.trim()}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* Step 3: Target Classes */}
                                    <div className="space-y-2 pt-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                                3. Apply To
                                            </label>
                                            <label className="flex items-center gap-1.5 text-xs text-indigo-600 font-semibold cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={applyToAll}
                                                    onChange={(e) => handleSelectAllToggle(e.target.checked)}
                                                    className="rounded text-indigo-600 focus:ring-0"
                                                />
                                                <span>All classes in school ({activeSubject.class_count})</span>
                                            </label>
                                        </div>

                                        {!applyToAll && (
                                            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
                                                {(activeSubject.class_details || []).map(cd => (
                                                    <label
                                                        key={cd.class_id}
                                                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                                                            selectedClassIds.includes(cd.class_id)
                                                                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedClassIds.includes(cd.class_id)}
                                                            onChange={() => toggleClassSelection(cd.class_id)}
                                                            className="rounded text-indigo-600 focus:ring-0"
                                                        />
                                                        <span className="truncate">{cd.class_name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-5 py-2.5 text-slate-600 hover:text-slate-800 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        form="renameSubjectForm"
                        type="submit"
                        disabled={submitting || !activeSubject || !newName.trim() || newName.trim().toLowerCase() === selectedSubjectName.toLowerCase()}
                        className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" />
                                <span>Renaming...</span>
                            </>
                        ) : (
                            <>
                                <Check size={16} />
                                <span>Save & Rename Subject</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RenameSubjectModal;
