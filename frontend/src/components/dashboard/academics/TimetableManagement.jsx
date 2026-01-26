import React, { useState, useEffect } from 'react';
import { Calendar, Download, RefreshCw, Edit2, Printer, Plus, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

const TimetableManagement = ({ config }) => {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [timetable, setTimetable] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAutoGenModal, setShowAutoGenModal] = useState(false);
    const [showManualEditModal, setShowManualEditModal] = useState(false);
    const [editingSlot, setEditingSlot] = useState(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [pendingChanges, setPendingChanges] = useState([]);

    // Auto-gen configuration
    const [autoGenConfig, setAutoGenConfig] = useState({
        subjects: [],
        periods: [
            { number: 1, start: '08:00', end: '08:45' },
            { number: 2, start: '08:45', end: '09:30' },
            { number: 3, start: '09:30', end: '10:15' },
            { number: 4, start: '10:30', end: '11:15' },
            { number: 5, start: '11:15', end: '12:00' },
            { number: 6, start: '12:00', end: '12:45' },
            { number: 7, start: '13:30', end: '14:15' }
        ]
    });

    const [teachers, setTeachers] = useState([]);

    const sections = config?.classes?.find(c => c.class_id === parseInt(selectedClass))?.sections || [];
    const classSubjects = config?.classes?.find(c => c.class_id === parseInt(selectedClass))?.subjects || [];

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    useEffect(() => {
        fetchTeachers();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            // If class has sections, wait for section selection.
            // If no sections, fetch immediately (section will be null/undefined)
            if (sections.length > 0 && !selectedSection) return;
            fetchTimetable();
        }
    }, [selectedClass, selectedSection]);

    const fetchTeachers = async () => {
        try {
            const res = await api.get('/teachers');
            setTeachers(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchTimetable = async () => {
        setLoading(true);
        try {
            let url = `/timetable?class_id=${selectedClass}`;
            if (selectedSection) url += `&section_id=${selectedSection}`;
            // If no section selected (and validly so), backend expects missing param => IS NULL check

            const res = await api.get(url);
            setTimetable(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAutoGen = () => {
        // Initialize with class subjects and their teachers
        const initialSubjects = classSubjects.map(sub => {
            const teacher = teachers.find(t => t.subject_specialization === sub.name);
            return {
                subject_id: sub.id,
                subject_name: sub.name,
                teacher_id: teacher?.id || null,
                teacher_name: teacher?.name || 'Unassigned',
                enabled: true
            };
        });
        setAutoGenConfig({ ...autoGenConfig, subjects: initialSubjects });
        setShowAutoGenModal(true);
    };

    const handleAutoGenerate = async () => {
        if (loading) return;
        if (!selectedClass) {
            toast.error('Please select class');
            return;
        }
        if (sections.length > 0 && !selectedSection) {
            toast.error('Please select section');
            return;
        }

        setLoading(true);
        try {
            await api.post('/timetable/generate', {
                class_id: selectedClass,
                section_id: selectedSection || null,
                subjects: autoGenConfig.subjects.filter(s => s.enabled),
                periods: autoGenConfig.periods
            });
            toast.success('Timetable generated successfully!');
            fetchTimetable();
            setShowAutoGenModal(false);
        } catch (error) {
            toast.error('Failed to generate timetable');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleManualCreate = () => {
        setShowManualEditModal(true);
        setEditingSlot({
            day_of_week: 1,
            period_number: 1,
            subject_id: '',
            teacher_id: '',
            start_time: '08:00',
            end_time: '08:45'
        });
    };

    const handleEditSlot = (slot) => {
        setEditingSlot(slot);
        setShowManualEditModal(true);
    };

    const handleSaveSlot = async () => {
        if (!editingSlot.id) {
            toast.info('Creating new slots is done via auto-generate');
            setShowManualEditModal(false);
            return;
        }

        // Get subject and teacher names for display
        const subject = classSubjects.find(s => s.id === editingSlot.subject_id);
        const teacher = teachers.find(t => t.id === editingSlot.teacher_id);

        const updatedSlot = {
            ...editingSlot,
            subject_name: subject?.name || 'Unknown',
            teacher_name: teacher?.name || 'Unassigned'
        };

        // Add to pending changes instead of immediately saving
        const existingIndex = pendingChanges.findIndex(c => c.id === updatedSlot.id);
        if (existingIndex >= 0) {
            const updated = [...pendingChanges];
            updated[existingIndex] = updatedSlot;
            setPendingChanges(updated);
        } else {
            setPendingChanges([...pendingChanges, updatedSlot]);
        }

        // Update local timetable display
        const updatedTimetable = timetable.map(slot =>
            slot.id === updatedSlot.id ? updatedSlot : slot
        );
        setTimetable(updatedTimetable);

        setHasUnsavedChanges(true);
        setShowManualEditModal(false);
        toast.success('Change recorded. Click "Save Changes" to apply.');
    };

    const handleSaveAll = async () => {
        if (loading) return;
        if (pendingChanges.length === 0) return;

        setLoading(true);
        try {
            // Save all pending changes
            for (const change of pendingChanges) {
                console.log('🚀 Sending Update Payload:', {
                    id: change.id,
                    subject_id: change.subject_id,
                    teacher_id: change.teacher_id,
                    start_time: change.start_time,
                    end_time: change.end_time
                }); // DEBUG LOG
                await api.put(`/timetable/${change.id}`, {
                    subject_id: change.subject_id,
                    teacher_id: change.teacher_id,
                    start_time: change.start_time,
                    end_time: change.end_time
                });
            }

            toast.success(`${pendingChanges.length} change(s) saved successfully!`);
            setPendingChanges([]);
            setHasUnsavedChanges(false);
            fetchTimetable(); // Refresh to get latest data
        } catch (error) {
            console.error('🔥 SAVE ERROR (DETAILS):', error.response?.data); // DEBUG LOG
            toast.error(error.response?.data?.message || 'Failed to save changes');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getSlot = (day, period) => {
        const dayIndex = days.indexOf(day) + 1;
        return timetable.find(t => t.day_of_week === dayIndex && t.period_number === period);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl shadow-lg p-6 text-white print:hidden">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Calendar size={28} />
                            Timetable Management
                        </h2>
                        <p className="text-purple-50 mt-1">Generate and manage class timetables</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 print:hidden">
                <div className="flex flex-wrap gap-4 items-center">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Class</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(''); }}
                            className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                            <option value="">Select Class</option>
                            {config?.classes
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

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Section</label>
                        <select
                            value={selectedSection}
                            onChange={(e) => setSelectedSection(e.target.value)}
                            className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            disabled={!selectedClass}
                        >
                            <option value="">{sections.length === 0 && selectedClass ? 'No Sections' : 'Select Section'}</option>
                            {sections.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="ml-auto flex gap-2">
                        <button
                            onClick={handleOpenAutoGen}
                            disabled={!selectedClass || (sections.length > 0 && !selectedSection) || loading}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Auto Generate
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={timetable.length === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                        >
                            <Printer size={16} />
                            Print
                        </button>
                    </div>
                </div>
            </div>

            {/* Timetable Grid */}
            {timetable.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-purple-50">
                                <tr>
                                    <th className="border border-purple-200 p-3 font-bold text-purple-900">Day / Period</th>
                                    {autoGenConfig.periods.map(p => (
                                        <th key={p.number} className="border border-purple-200 p-3 font-bold text-purple-900">
                                            <div>P{p.number}</div>
                                            <div className="text-[10px] text-purple-600 font-normal">{p.start}-{p.end}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {days.map(day => (
                                    <tr key={day} className="hover:bg-slate-50">
                                        <td className="border border-slate-200 p-3 font-bold text-slate-700 bg-slate-50">{day}</td>
                                        {autoGenConfig.periods.map(period => {
                                            const slot = getSlot(day, period.number);
                                            return (
                                                <td key={period.number} className="border border-slate-200 p-2 print:p-1">
                                                    {slot ? (
                                                        <div className="text-center relative group">
                                                            <div className="font-bold text-slate-800 text-xs">{slot.subject_name}</div>
                                                            <div className="text-[10px] text-slate-500 mt-1">
                                                                {slot.teacher_name || 'Unassigned'}
                                                            </div>
                                                            <button
                                                                onClick={() => handleEditSlot(slot)}
                                                                className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 bg-indigo-500 text-white p-1 rounded print:hidden"
                                                            >
                                                                <Edit2 size={10} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-slate-400 text-xs">-</div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center print:hidden">
                    <Calendar size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500 font-medium mb-4">
                        {selectedClass && selectedSection
                            ? 'No timetable found. Generate a new one.'
                            : 'Select a class and section to view/generate timetable'}
                    </p>
                </div>
            )}

            {/* Auto-Generate Configuration Modal */}
            {showAutoGenModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-purple-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-purple-900">Configure Auto-Generation</h3>
                                <p className="text-xs text-purple-600 mt-1">Set periods, timings, subjects & teachers before generating</p>
                            </div>
                            <button onClick={() => setShowAutoGenModal(false)} className="text-slate-500 hover:text-slate-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                            <div className="space-y-6">
                                {/* Period Timings */}
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-bold text-slate-700">Period Timings</h4>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    const newPeriod = {
                                                        number: autoGenConfig.periods.length + 1,
                                                        start: '14:00',
                                                        end: '14:45'
                                                    };
                                                    setAutoGenConfig({
                                                        ...autoGenConfig,
                                                        periods: [...autoGenConfig.periods, newPeriod]
                                                    });
                                                }}
                                                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                                            >
                                                <Plus size={14} />
                                                Add Period
                                            </button>
                                            {autoGenConfig.periods.length > 1 && (
                                                <button
                                                    onClick={() => {
                                                        setAutoGenConfig({
                                                            ...autoGenConfig,
                                                            periods: autoGenConfig.periods.slice(0, -1)
                                                        });
                                                    }}
                                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1"
                                                >
                                                    <X size={14} />
                                                    Remove Last
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg mb-3">
                                        <div className="text-sm text-slate-600">
                                            <strong>Total Periods:</strong> {autoGenConfig.periods.length}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {autoGenConfig.periods.map((period, idx) => (
                                            <div key={period.number} className="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-lg">
                                                <span className="font-medium text-slate-600 text-sm w-12">P{period.number}</span>
                                                <input
                                                    type="time"
                                                    value={period.start}
                                                    onChange={(e) => {
                                                        const updated = [...autoGenConfig.periods];
                                                        updated[idx].start = e.target.value;
                                                        setAutoGenConfig({ ...autoGenConfig, periods: updated });
                                                    }}
                                                    className="px-2 py-1 border border-slate-300 rounded text-sm flex-1"
                                                />
                                                <span className="text-slate-400">-</span>
                                                <input
                                                    type="time"
                                                    value={period.end}
                                                    onChange={(e) => {
                                                        const updated = [...autoGenConfig.periods];
                                                        updated[idx].end = e.target.value;
                                                        setAutoGenConfig({ ...autoGenConfig, periods: updated });
                                                    }}
                                                    className="px-2 py-1 border border-slate-300 rounded text-sm flex-1"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Subjects & Teachers */}
                                <div>
                                    <h4 className="font-bold text-slate-700 mb-3">Subjects & Teachers</h4>
                                    <div className="bg-slate-50 p-3 rounded-lg mb-3">
                                        <div className="text-sm text-slate-600">
                                            Select subjects to include in timetable and assign teachers. Uncheck subjects to exclude them.
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {autoGenConfig.subjects.map((sub, idx) => (
                                            <div key={sub.subject_id} className="flex items-center gap-4 bg-white border border-slate-200 p-3 rounded-lg">
                                                <input
                                                    type="checkbox"
                                                    checked={sub.enabled}
                                                    onChange={(e) => {
                                                        const updated = [...autoGenConfig.subjects];
                                                        updated[idx].enabled = e.target.checked;
                                                        setAutoGenConfig({ ...autoGenConfig, subjects: updated });
                                                    }}
                                                    className="w-4 h-4"
                                                />
                                                <div className="flex-1">
                                                    <div className="font-medium text-slate-700">{sub.subject_name}</div>
                                                </div>
                                                <select
                                                    value={sub.teacher_id || ''}
                                                    onChange={(e) => {
                                                        const updated = [...autoGenConfig.subjects];
                                                        updated[idx].teacher_id = e.target.value ? parseInt(e.target.value) : null;
                                                        const teacher = teachers.find(t => t.id === parseInt(e.target.value));
                                                        updated[idx].teacher_name = teacher?.name || 'Unassigned';
                                                        setAutoGenConfig({ ...autoGenConfig, subjects: updated });
                                                    }}
                                                    className="px-3 py-1 border border-slate-300 rounded-lg text-sm w-48"
                                                    disabled={!sub.enabled}
                                                >
                                                    <option value="">Select Teacher</option>
                                                    {teachers
                                                        .filter(t => t.subject_specialization && t.subject_specialization.toLowerCase() === sub.subject_name.toLowerCase())
                                                        .map(t => (
                                                            <option key={t.id} value={t.id}>{t.name}</option>
                                                        ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowAutoGenModal(false)}
                                className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAutoGenerate}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-2"
                            >
                                <RefreshCw size={16} />
                                Generate Timetable
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Edit Modal */}
            {showManualEditModal && editingSlot && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-gray-200 bg-indigo-50">
                            <h3 className="text-lg font-bold text-indigo-900">Edit Timetable Slot</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Subject</label>
                                <select
                                    value={editingSlot.subject_id}
                                    onChange={(e) => setEditingSlot({ ...editingSlot, subject_id: parseInt(e.target.value) })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                                >
                                    <option value="">Select Subject</option>
                                    {classSubjects.map(sub => (
                                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Teacher</label>
                                <select
                                    value={editingSlot.teacher_id || ''}
                                    onChange={(e) => setEditingSlot({ ...editingSlot, teacher_id: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                                >
                                    <option value="">Unassigned</option>
                                    {teachers
                                        .filter(t => {
                                            const currentSubject = classSubjects.find(s => s.id === editingSlot.subject_id);
                                            return currentSubject && t.subject_specialization && t.subject_specialization.toLowerCase() === currentSubject.name.toLowerCase();
                                        })
                                        .map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                </select>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-200 bg-slate-50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowManualEditModal(false)}
                                className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveSlot}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-2"
                            >
                                <Save size={16} />
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Save Button */}
            {hasUnsavedChanges && (
                <div className="fixed bottom-8 right-8 z-40 animate-in slide-in-from-bottom print:hidden">
                    <button
                        onClick={handleSaveAll}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 transition-all hover:scale-105"
                    >
                        <Save size={20} />
                        Save Changes ({pendingChanges.length})
                    </button>
                </div>
            )}
        </div>
    );
};

export default TimetableManagement;
