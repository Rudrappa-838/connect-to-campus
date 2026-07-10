import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import { useAuth } from '../../../context/AuthContext';
import { Save, Users, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

const ExamBatches = ({ config }) => {
    const { user } = useAuth();
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Original state for comparison during save
    const [originalBatches, setOriginalBatches] = useState({});
    const [currentBatches, setCurrentBatches] = useState({});
    const [selectedRows, setSelectedRows] = useState(new Set());

    const batchOptions = ['KCET', 'NEET', 'JEE', 'None'];

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        if (selectedClass) {
            fetchStudents();
        } else {
            setStudents([]);
            setCurrentBatches({});
            setOriginalBatches({});
            setSelectedRows(new Set());
        }
    }, [selectedClass]);

    const fetchClasses = async () => {
        try {
            const res = await api.get('/classes');
            setClasses(res.data);
            if (res.data.length > 0) setSelectedClass(res.data[0].id);
        } catch (err) {
            toast.error('Failed to fetch classes');
        }
    };

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/students?class_id=${selectedClass}`);
            const studentsList = res.data.data || res.data || [];
            setStudents(studentsList);
            
            const batches = {};
            studentsList.forEach(s => {
                batches[s.id] = s.exam_batch || 'None';
            });
            setCurrentBatches(batches);
            setOriginalBatches(batches);
            setSelectedRows(new Set());
        } catch (err) {
            toast.error('Failed to fetch students');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchChange = (studentId, batch) => {
        setCurrentBatches(prev => ({
            ...prev,
            [studentId]: batch
        }));
    };

    const handleBulkAssign = (batch) => {
        if (selectedRows.size === 0) return;
        setCurrentBatches(prev => {
            const next = { ...prev };
            selectedRows.forEach(id => next[id] = batch);
            return next;
        });
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedRows(new Set(students.map(s => s.id)));
        else setSelectedRows(new Set());
    };

    const handleSelectRow = (id, checked) => {
        const next = new Set(selectedRows);
        if (checked) next.add(id);
        else next.delete(id);
        setSelectedRows(next);
    };

    const handleSave = async () => {
        const updates = [];
        Object.keys(currentBatches).forEach(studentId => {
            if (currentBatches[studentId] !== originalBatches[studentId]) {
                updates.push({
                    id: parseInt(studentId),
                    exam_batch: currentBatches[studentId] === 'None' ? null : currentBatches[studentId]
                });
            }
        });

        if (updates.length === 0) {
            toast.success('No changes to save.');
            return;
        }

        setSaving(true);
        try {
            await api.put('/students/bulk-update-exam-batch', { updates });
            toast.success('Exam batches updated successfully!');
            setOriginalBatches(currentBatches);
        } catch (err) {
            console.error(err);
            toast.error('Failed to save exam batches');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-indigo-500" />
                            Competitive Exam Batches
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Assign students to KCET, NEET, or JEE batches for exam scheduling.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {selectedRows.size > 0 && (
                            <div className="flex gap-2 items-center bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                <span className="text-xs font-bold text-indigo-700 mr-2">Set Selected ({selectedRows.size}):</span>
                                {batchOptions.map(batch => (
                                    <button
                                        key={`bulk-${batch}`}
                                        onClick={() => handleBulkAssign(batch)}
                                        className="text-xs px-2 py-1 bg-white border border-indigo-200 rounded text-indigo-700 hover:bg-indigo-50 font-bold transition-colors"
                                    >
                                        {batch}
                                    </button>
                                ))}
                            </div>
                        )}
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="">Select Class</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                {loading ? (
                    <div className="text-center py-12 text-slate-500">Loading students...</div>
                ) : students.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                        <Users className="w-12 h-12 text-slate-300 mb-3" />
                        <p>No students found in this class.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="py-3 px-4 w-10 text-center">
                                        <input 
                                            type="checkbox"
                                            className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                                            checked={students.length > 0 && selectedRows.size === students.length}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Student Name</th>
                                    <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Competitive Batch</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student) => (
                                    <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                        <td className="py-3 px-4 text-center">
                                            <input 
                                                type="checkbox"
                                                className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                                                checked={selectedRows.has(student.id)}
                                                onChange={(e) => handleSelectRow(student.id, e.target.checked)}
                                            />
                                        </td>
                                        <td className="py-3 px-4 text-sm font-medium text-slate-800">{student.name}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex gap-2">
                                                {batchOptions.map(batch => (
                                                    <button
                                                        key={batch}
                                                        onClick={() => handleBatchChange(student.id, batch)}
                                                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                                                            currentBatches[student.id] === batch
                                                                ? batch === 'None' 
                                                                    ? 'bg-slate-200 border-slate-300 text-slate-700'
                                                                    : 'bg-indigo-100 border-indigo-200 text-indigo-700'
                                                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        {batch}
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExamBatches;
