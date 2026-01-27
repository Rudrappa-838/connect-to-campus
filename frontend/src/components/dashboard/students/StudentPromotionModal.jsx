import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Users, GraduationCap, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

const StudentPromotionModal = ({ isOpen, onClose, selectedStudents, config, onSuccess }) => {
    const [toClassId, setToClassId] = useState('');
    const [toSectionId, setToSectionId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [academicYear, setAcademicYear] = useState('');
    const [notes, setNotes] = useState('');
    const [targetStudentCount, setTargetStudentCount] = useState(null);
    const [checkingVacancy, setCheckingVacancy] = useState(false);
    const [confirmMerge, setConfirmMerge] = useState(false); // User must confirm if not empty
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get available sections for selected class
    const availableSections = config.classes?.find(c => c.class_id === parseInt(toClassId))?.sections || [];

    useEffect(() => {
        // Set default dates when modal opens
        if (isOpen) {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1; // 1-12

            // Academic year typically starts in April (month 4)
            let startYear, endYear;
            if (currentMonth >= 4) {
                startYear = currentYear;
                endYear = currentYear + 1;
            } else {
                startYear = currentYear - 1;
                endYear = currentYear;
            }

            // Set default start date (April 1st of start year)
            setStartDate(`${startYear}-04-01`);
            // Set default end date (March 31st of end year)
            setEndDate(`${endYear}-03-31`);
        }
    }, [isOpen]);

    // Check Target Variance
    useEffect(() => {
        const checkVacancy = async () => {
            if (toClassId && toSectionId) {
                setCheckingVacancy(true);
                setConfirmMerge(false); // Reset confirmation
                try {
                    const res = await api.get('/students', {
                        params: {
                            class_id: toClassId,
                            section_id: toSectionId,
                            limit: 1 // We only need the total count
                        }
                    });
                    setTargetStudentCount(res.data.pagination?.total || 0);
                } catch (error) {
                    console.error("Failed to check vacancy", error);
                    setTargetStudentCount(null);
                } finally {
                    setCheckingVacancy(false);
                }
            } else {
                setTargetStudentCount(null);
            }
        };

        const timeoutId = setTimeout(checkVacancy, 300); // 300ms debounce
        return () => clearTimeout(timeoutId);
    }, [toClassId, toSectionId]);

    // Auto-generate academic year when dates change
    useEffect(() => {
        if (startDate && endDate) {
            const startYear = new Date(startDate).getFullYear();
            const endYear = new Date(endDate).getFullYear();
            setAcademicYear(`${startYear}-${endYear}`);
        }
    }, [startDate, endDate]);

    const handlePromote = async () => {
        if (isSubmitting) return;
        if (!toClassId) {
            return toast.error('Please select a target class');
        }

        if (!startDate || !endDate) {
            return toast.error('Please select academic year start and end dates');
        }

        if (!academicYear) {
            return toast.error('Academic year is required');
        }

        setIsSubmitting(true);

        try {
            const payload = {
                student_ids: selectedStudents.map(s => s.id),
                to_class_id: parseInt(toClassId),
                to_section_id: toSectionId ? parseInt(toSectionId) : null,
                to_academic_year: academicYear,
                notes: notes.trim()
            };

            const res = await api.post('/students/promote', payload);

            toast.success(res.data.message);

            if (res.data.errors && res.data.errors.length > 0) {
                toast.error(`${res.data.errors.length} student(s) failed to promote`);
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Promotion error:', error);
            toast.error(error.response?.data?.message || 'Failed to promote students');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
                            <GraduationCap size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Promote Students</h2>
                            <p className="text-sm text-slate-500">Move students to next class/academic year</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-lg transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Selected Students Count */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
                                    <Users size={24} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg">Selected Students</h3>
                                    <p className="text-sm text-slate-500">Ready for promotion</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-4xl font-bold text-indigo-600">{selectedStudents.length}</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider">Students</div>
                            </div>
                        </div>
                    </div>

                    {/* Promotion Details */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Target Class <span className="text-red-500">*</span>
                            </label>
                            <select
                                className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                value={toClassId}
                                onChange={e => {
                                    setToClassId(e.target.value);
                                    setToSectionId(''); // Reset section
                                }}
                                required
                            >
                                <option value="">Select Class</option>
                                {config.classes
                                    ?.slice()
                                    .sort((a, b) => {
                                        const numA = parseInt(a.class_name.replace(/\D/g, '') || '0', 10);
                                        const numB = parseInt(b.class_name.replace(/\D/g, '') || '0', 10);
                                        return numA === numB ? a.class_name.localeCompare(b.class_name) : numA - numB;
                                    })
                                    .map(c => (
                                        <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                                    ))}
                            </select>
                        </div>

                        {availableSections.length > 0 && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">
                                    Target Section <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                                    value={toSectionId}
                                    onChange={e => setToSectionId(e.target.value)}
                                    disabled={!toClassId}
                                    required
                                >
                                    <option value="">Select Section</option>
                                    {availableSections.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Vacancy Check Warning */}
                    {toClassId && toSectionId && !checkingVacancy && targetStudentCount !== null && (
                        <div className={`mt-2 p-3 rounded-lg border ${targetStudentCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                            <div className="flex items-start gap-3">
                                {targetStudentCount > 0 ? (
                                    <>
                                        <div className="mt-0.5 font-bold text-lg">⚠️</div>
                                        <div>
                                            <p className="font-bold text-sm">Target Class is NOT Vacant ({targetStudentCount} students)</p>
                                            <p className="text-xs mt-1">
                                                Ideally, you should promote the existing students of this class to the next level before promoting new students into it, to avoid mixing batches.
                                            </p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="confirmMerge"
                                                    className="w-4 h-4 rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
                                                    checked={confirmMerge}
                                                    onChange={e => setConfirmMerge(e.target.checked)}
                                                />
                                                <label htmlFor="confirmMerge" className="text-xs font-bold cursor-pointer select-none">
                                                    Yes, merge with existing {targetStudentCount} students
                                                </label>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="mt-0.5 font-bold text-lg">✓</div>
                                        <div>
                                            <p className="font-bold text-sm">Target Class is Vacant</p>
                                            <p className="text-xs opacity-80">Ready to accept new students.</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Academic Year Date Selection */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                        <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <Calendar size={16} className="text-indigo-600" />
                            Academic Year Period <span className="text-red-500">*</span>
                        </label>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Date</label>
                                <input
                                    type="date"
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">End Date</label>
                                <input
                                    type="date"
                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    min={startDate}
                                    required
                                />
                            </div>
                        </div>

                        {/* Auto-generated Academic Year Display */}
                        {academicYear && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-indigo-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-slate-600">Academic Year:</span>
                                    <span className="text-sm font-bold text-indigo-600">{academicYear}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                            Notes (Optional)
                        </label>
                        <textarea
                            className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                            rows="3"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Add any notes about this promotion..."
                        ></textarea>
                    </div>

                    {/* Warning */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-sm text-amber-800">
                            <strong>Note:</strong> All historical data (attendance, marks, fees) will be preserved and linked to the previous academic year.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-slate-600 font-bold text-sm hover:bg-slate-200 rounded-xl transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handlePromote}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSubmitting || !toClassId || !startDate || !endDate || !academicYear || (targetStudentCount > 0 && !confirmMerge)}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Promoting...
                            </>
                        ) : (
                            <>
                                <ArrowRight size={18} />
                                Promote {selectedStudents.length} Student{selectedStudents.length > 1 ? 's' : ''}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentPromotionModal;
