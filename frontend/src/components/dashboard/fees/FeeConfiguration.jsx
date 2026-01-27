import React, { useState, useEffect } from 'react';
import { Plus, Trash2, IndianRupee, User, ChevronRight, CheckCircle, AlertCircle, Edit2, ArrowLeft } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const FeeConfiguration = ({ config }) => {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);

    // Submission Lock
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);

    // Student Detail / Edit Mode
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentFees, setStudentFees] = useState([]);
    const [formData, setFormData] = useState({ title: '', amount: '', due_date: '' });
    const [editMode, setEditMode] = useState(false);
    const [editingFeeId, setEditingFeeId] = useState(null);

    // Class Fee Modal State
    const [showClassFeeModal, setShowClassFeeModal] = useState(false);
    const [classFeeForm, setClassFeeForm] = useState({ title: '', amount: '', due_date: '' });

    const handleAddClassFee = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await api.post('/fees/structures', {
                class_id: selectedClass,
                title: classFeeForm.title,
                amount: classFeeForm.amount,
                due_date: classFeeForm.due_date,
                type: 'CLASS_DEFAULT'
            });
            toast.success('Class Fee Added Successfully');
            setShowClassFeeModal(false);
            setClassFeeForm({ title: '', amount: '', due_date: '' });
            fetchStudents(); // Refresh overview
        } catch (error) {
            console.error(error);
            toast.error('Failed to add class fee');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Computed
    const sections = config?.classes?.find(c => c.class_id === parseInt(selectedClass))?.sections || [];

    useEffect(() => {
        setSelectedStudent(null); // Clear form when class/section changes
        if (selectedClass) fetchStudents();
        else setStudents([]);
    }, [selectedClass, selectedSection]);

    useEffect(() => {
        if (selectedStudent) fetchStudentFees();
    }, [selectedStudent]);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/fees/overview?class_id=${selectedClass}&section_id=${selectedSection}`);
            setStudents(res.data.students || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchStudentFees = async () => {
        try {
            const res = await api.get(`/fees/student/${selectedStudent.id}`);
            setStudentFees(res.data);
        } catch (e) { console.error(e); }
    };

    const handleEditFee = (fee) => {
        setEditMode(true);
        setEditingFeeId(fee.fee_structure_id);
        setFormData({
            title: fee.title,
            amount: fee.total_amount,
            due_date: new Date(fee.due_date).toISOString().split('T')[0]
        });
    };

    const handleCancelEdit = () => {
        setEditMode(false);
        setEditingFeeId(null);
        setFormData({ title: '', amount: '', due_date: '' });
    };

    const handleAddFee = async (e) => {
        e.preventDefault();

        if (isSubmitting || isSubmittingRef.current) return;
        setIsSubmitting(true);
        isSubmittingRef.current = true;

        try {
            if (editMode) {
                // Update existing fee
                await api.put(`/fees/structures/${editingFeeId}`, {
                    ...formData,
                    student_id: selectedStudent.id
                });
                toast.success('Fee Updated Successfully');
                handleCancelEdit();
            } else {
                // Add new fee
                await api.post('/fees/student-structure', {
                    ...formData,
                    student_id: selectedStudent.id
                });
                toast.success('Fee Added to Student');
                setFormData({ title: '', amount: '', due_date: '' });
            }
            fetchStudentFees();
            fetchStudents(); // Refresh main list stats
        } catch (e) {
            toast.error(editMode ? 'Failed to update fee' : 'Failed to add fee');
        }
        finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const handleDeleteFee = async (id) => {
        if (!confirm('Delete this fee?')) return;

        if (isSubmitting || isSubmittingRef.current) return;
        setIsSubmitting(true);
        isSubmittingRef.current = true;

        try {
            await api.delete(`/fees/structures/${id}`);
            toast.success('Fee Removed');
            if (editMode && editingFeeId === id) {
                handleCancelEdit();
            }
            fetchStudentFees();
            fetchStudents();
        } catch (e) { toast.error('Delete failed'); }
        finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const formatCurrency = (amount) => {
        return parseFloat(amount || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    // Splitting Logic
    const configuredStudents = students.filter(s => s.total_fee > 0);
    const nonConfiguredStudents = students.filter(s => s.total_fee == 0);

    return (
        <div className="flex h-[calc(100vh-120px)] gap-6 animate-in fade-in">
            {/* Left Panel: Lists */}
            <div className="w-1/2 flex flex-col gap-4">
                {/* Header */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
                    <select className="input flex-1" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }}>
                        <option value="">Select Class</option>
                        {config?.classes
                            ?.slice()
                            .sort((a, b) => {
                                const numA = parseInt(a.class_name.replace(/\D/g, '') || '0', 10);
                                const numB = parseInt(b.class_name.replace(/\D/g, '') || '0', 10);
                                return numA === numB ? a.class_name.localeCompare(b.class_name) : numA - numB;
                            })
                            .map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                    </select>
                    {sections.length > 0 && (
                        <select className="input flex-1" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
                            <option value="">All Sections</option>
                            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                </div>

                {/* Lists Content */}
                <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                    {/* Configured List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-3 bg-green-50 border-b border-green-100 flex justify-between items-center">
                            <h3 className="font-bold text-green-800 flex items-center gap-2"><CheckCircle size={16} /> Configured Students</h3>
                            <span className="badge bg-green-200 text-green-800">{configuredStudents.length}</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {configuredStudents.map(s => (
                                <div key={s.id} onClick={() => setSelectedStudent(s)} className={`p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center ${selectedStudent?.id === s.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}>
                                    <div>
                                        <p className="font-bold text-gray-800">{s.name}</p>
                                        <p className="text-xs text-gray-500">{s.admission_no} • ₹{formatCurrency(s.total_fee)}</p>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-300" />
                                </div>
                            ))}
                            {configuredStudents.length === 0 && <p className="p-4 text-center text-gray-400 text-sm">No configured students</p>}
                        </div>
                    </div>

                    {/* Non-Configured List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2"><AlertCircle size={16} /> Non-Configured Students</h3>
                            <span className="badge bg-gray-200 text-gray-700">{nonConfiguredStudents.length}</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {nonConfiguredStudents.map(s => (
                                <div key={s.id} onClick={() => setSelectedStudent(s)} className={`p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center ${selectedStudent?.id === s.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}>
                                    <div>
                                        <p className="font-medium text-gray-800">{s.name}</p>
                                        <p className="text-xs text-gray-400">{s.admission_no}</p>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-300" />
                                </div>
                            ))}
                            {nonConfiguredStudents.length === 0 && <p className="p-4 text-center text-gray-400 text-sm">All students configured</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel: Editor */}
            <div className="w-1/2 bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">
                {selectedStudent ? (
                    <>
                        <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center gap-4">
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center"
                                title="Back to student list"
                            >
                                <ArrowLeft size={20} className="text-gray-600" />
                            </button>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-gray-800">{selectedStudent.name}</h2>
                                <p className="text-gray-500">{selectedStudent.admission_no}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Current Fees List */}
                            <div className="space-y-3">
                                <h3 className="font-bold text-sm text-gray-500 uppercase">Current Fees</h3>
                                {studentFees.map(f => (
                                    <div key={f.fee_structure_id} className={`flex justify-between items-center p-3 border rounded-lg shadow-sm ${editMode && editingFeeId === f.fee_structure_id ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'}`}>
                                        <div>
                                            <p className="font-bold text-gray-800">{f.title}</p>
                                            <p className="text-xs text-gray-500">Due: {new Date(f.due_date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right flex items-center gap-2">
                                            <span className="font-mono font-bold text-gray-700">₹{formatCurrency(f.total_amount)}</span>
                                            <button
                                                onClick={() => handleEditFee(f)}
                                                className="text-blue-400 hover:text-blue-600 disabled:text-gray-300 disabled:cursor-not-allowed p-1"
                                                disabled={isSubmitting || (editMode && editingFeeId !== f.fee_structure_id)}
                                                title="Edit Fee"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteFee(f.fee_structure_id)}
                                                className="text-red-400 hover:text-red-600 disabled:text-gray-300 disabled:cursor-not-allowed p-1"
                                                disabled={isSubmitting}
                                                title="Delete Fee"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {studentFees.length === 0 && <p className="text-center text-gray-400 italic">No fees assigned</p>}
                            </div>

                            {/* Add/Edit Fee Form */}
                            <div className={`p-5 rounded-xl border ${editMode ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-100'}`}>
                                <h3 className={`font-bold mb-4 flex items-center gap-2 ${editMode ? 'text-amber-900' : 'text-indigo-900'}`}>
                                    {editMode ? <Edit2 size={18} /> : <Plus size={18} />}
                                    {editMode ? `Edit Fee for ${selectedStudent.name.split(' ')[0]}` : `Add Fee for ${selectedStudent.name.split(' ')[0]}`}
                                </h3>
                                <form onSubmit={handleAddFee} className="space-y-4">
                                    <div>
                                        <label className={`label ${editMode ? 'text-amber-900' : 'text-indigo-900'}`}>Fee Title</label>
                                        <input className="input bg-white" placeholder="e.g. Tuition Fee" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={`label ${editMode ? 'text-amber-900' : 'text-indigo-900'}`}>Amount (₹)</label>
                                        <input
                                            className="input bg-white"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="Enter amount (e.g., 1500.00)"
                                            required
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className={`label ${editMode ? 'text-amber-900' : 'text-indigo-900'}`}>Due Date</label>
                                        <input
                                            type="date"
                                            className="input bg-white"
                                            min={new Date().toISOString().split('T')[0]}
                                            required
                                            value={formData.due_date}
                                            onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        {editMode && (
                                            <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                className="btn-secondary flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700"
                                                disabled={isSubmitting}
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            className={`btn-primary flex-1 ${editMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? (editMode ? 'Updating...' : 'Adding...') : (editMode ? 'Update Fee' : 'Add Fee to Student')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50/50">
                        <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                            <IndianRupee size={48} className="text-indigo-200" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-700 mb-2">Manage Fees</h3>
                        <p className="max-w-xs mx-auto mb-6">Select a student to manage individual fees, or assign fees to the entire class below.</p>

                        {selectedClass ? (
                            <button
                                onClick={() => setShowClassFeeModal(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                            >
                                <Plus size={20} /> Add Fee for Whole Class
                            </button>
                        ) : (
                            <p className="text-sm text-gray-400 font-medium bg-gray-100 px-4 py-2 rounded-lg">Please select a class first</p>
                        )}
                    </div>
                )}
            </div>

            {/* Class Fee Modal */}
            {showClassFeeModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="bg-indigo-600 p-6 text-white text-center">
                            <h3 className="text-xl font-bold">Add Class Fee</h3>
                            <p className="text-indigo-100 text-sm mt-1">
                                For {config?.classes?.find(c => c.class_id === parseInt(selectedClass))?.class_name}
                            </p>
                        </div>
                        <form onSubmit={handleAddClassFee} className="p-6 space-y-4">
                            <div>
                                <label className="label text-indigo-900">Fee Title</label>
                                <input
                                    className="input"
                                    placeholder="e.g. Annual Tuition Fee"
                                    required
                                    value={classFeeForm.title}
                                    onChange={e => setClassFeeForm({ ...classFeeForm, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label text-indigo-900">Amount (₹)</label>
                                <input
                                    className="input"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Enter amount"
                                    required
                                    value={classFeeForm.amount}
                                    onChange={e => setClassFeeForm({ ...classFeeForm, amount: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label text-indigo-900">Due Date</label>
                                <input
                                    type="date"
                                    className="input"
                                    min={new Date().toISOString().split('T')[0]}
                                    required
                                    value={classFeeForm.due_date}
                                    onChange={e => setClassFeeForm({ ...classFeeForm, due_date: e.target.value })}
                                />
                            </div>
                            <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-lg flex gap-2 items-start">
                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                <p>This fee will be automatically applied to ALL students currently in this class.</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowClassFeeModal(false)}
                                    className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
                                >
                                    {isSubmitting ? 'Adding...' : 'Add Class Fee'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeeConfiguration;
