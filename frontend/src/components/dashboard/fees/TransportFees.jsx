import React, { useState, useEffect } from 'react';
import { Search, Bus, Check, X, ChevronRight, MapPin, IndianRupee } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const TransportFees = ({ config }) => {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

    const [routes, setRoutes] = useState([]);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignForm, setAssignForm] = useState({ route_id: '', amount: '', due_date: new Date().toISOString().split('T')[0] });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch Routes on Mount
    useEffect(() => {
        const fetchRoutes = async () => {
            try {
                const res = await api.get('/transport/routes');
                setRoutes(res.data || []);
            } catch (e) { console.error(e); }
        };
        fetchRoutes();
    }, []);

    // Fetch Students when Class/Section changes
    useEffect(() => {
        if (selectedClass) {
            fetchStudents();
        } else {
            setStudents([]);
        }
        setSelectedStudentIds(new Set()); // Reset selection
    }, [selectedClass, selectedSection]);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            // Using students endpoint to get raw list
            const res = await api.get(`/students?class_id=${selectedClass}&section_id=${selectedSection}&limit=1000`);
            setStudents(res.data.data || []);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStudent = (id) => {
        const newSet = new Set(selectedStudentIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedStudentIds(newSet);
    };

    const handleSelectAll = () => {
        if (selectedStudentIds.size === students.length) {
            setSelectedStudentIds(new Set());
        } else {
            setSelectedStudentIds(new Set(students.map(s => s.id)));
        }
    };

    const handleAssignSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!assignForm.route_id) {
            toast.error('Please select a route');
            return;
        }

        const selectedRoute = routes.find(r => r.id == assignForm.route_id);
        const routeName = selectedRoute ? selectedRoute.route_name : 'Unknown Route';

        setIsSubmitting(true);
        try {
            // Loop through selected students and assign fee
            // Ideally backend should support bulk, but loop is fine for now (usually < 50 students/class)
            const promises = Array.from(selectedStudentIds).map(student_id => {
                return api.post('/fees/student-structure', {
                    student_id,
                    title: `Transport Fee - ${routeName}`,
                    amount: assignForm.amount,
                    due_date: assignForm.due_date,
                    type: 'TRANSPORT'
                });
            });

            await Promise.all(promises);

            toast.success(`Transport Fee Assigned to ${selectedStudentIds.size} Students`);
            setShowAssignModal(false);
            setAssignForm({ route_id: '', amount: '', due_date: new Date().toISOString().split('T')[0] });
            setSelectedStudentIds(new Set()); // Clear selection
        } catch (e) {
            console.error(e);
            toast.error('Failed to assign fees. Some might have failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.admission_no.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sections = config?.classes?.find(c => c.class_id === parseInt(selectedClass))?.sections || [];

    return (
        <div className="flex h-[calc(100vh-120px)] gap-6 animate-in fade-in">
            {/* Left Panel: Filter & List */}
            <div className="w-full md:w-2/3 flex flex-col gap-4">
                {/* Header Controls */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <select className="input w-full" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }}>
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
                    </div>
                    {sections.length > 0 && (
                        <div className="flex-1">
                            <select className="input w-full" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
                                <option value="">All Sections</option>
                                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex-1 relative">
                        <input
                            className="input w-full"
                            placeholder="Search Student..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex justify-between items-center px-2">
                    <p className="text-sm font-bold text-gray-500">
                        {filteredStudents.length} Students Found • {selectedStudentIds.size} Selected
                    </p>
                    {students.length > 0 && (
                        <div className="flex gap-2">
                            <button onClick={handleSelectAll} className="px-3 py-1.5 text-xs font-bold bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                                {selectedStudentIds.size === students.length ? 'Deselect All' : 'Select All'}
                            </button>
                            <button
                                onClick={() => setShowAssignModal(true)}
                                disabled={selectedStudentIds.size === 0}
                                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Bus size={14} /> Assign Transport Fee
                            </button>
                        </div>
                    )}
                </div>

                {/* List */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="overflow-y-auto flex-1 p-2 space-y-2">
                        {loading ? (
                            <div className="p-8 text-center text-gray-400">Loading students...</div>
                        ) : filteredStudents.length > 0 ? (
                            filteredStudents.map(s => (
                                <div key={s.id}
                                    onClick={() => handleToggleStudent(s.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${selectedStudentIds.has(s.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-100'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedStudentIds.has(s.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                                            {selectedStudentIds.has(s.id) && <Check size={12} className="text-white" />}
                                        </div>
                                        <div>
                                            <p className={`font-bold ${selectedStudentIds.has(s.id) ? 'text-indigo-900' : 'text-gray-700'}`}>{s.name}</p>
                                            <p className="text-xs text-gray-400">#{s.admission_no} • {s.section_name || 'No Section'}</p>
                                        </div>
                                    </div>
                                    {/* Placeholder for Route info if we had it */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ChevronRight size={16} className="text-gray-300" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Search size={48} className="mb-4 opacity-20" />
                                <p>No students found</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Panel: Info / Selection Summary */}
            <div className="hidden md:flex w-1/3 flex-col gap-4">
                <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                    <Bus className="absolute -right-4 -bottom-4 opacity-10 w-32 h-32" />
                    <h2 className="text-xl font-bold mb-2">Transport Management</h2>
                    <p className="text-indigo-100 text-sm mb-6">Select students from the list to assign transport routes and fees effectively.</p>

                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">Selected</span>
                            <span className="bg-white text-indigo-600 px-2 py-0.5 rounded text-xs font-bold">{selectedStudentIds.size}</span>
                        </div>
                        <div className="h-1 w-full bg-indigo-900/50 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${Math.min((selectedStudentIds.size / (students.length || 1)) * 100, 100)}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <MapPin size={18} className="text-gray-400" /> Available Routes
                    </h3>
                    <div className="space-y-3 overflow-y-auto max-h-[400px]">
                        {routes.map(r => (
                            <div key={r.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="flex justify-between items-start">
                                    <p className="font-bold text-gray-700">{r.route_name}</p>
                                    <span className="font-mono text-sm font-bold text-green-600">₹{r.monthly_fee || '0'}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{r.vehicle_number ? `Bus: ${r.vehicle_number}` : 'No Vehicle Assigned'}</p>
                            </div>
                        ))}
                        {routes.length === 0 && <p className="text-center text-gray-400 text-sm italic">No routes configured</p>}
                    </div>
                </div>
            </div>

            {/* Assign Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800">Assign Transport Fee</h3>
                            <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAssignSubmit} className="p-6 space-y-4">
                            <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">
                                Assigning fee to <b>{selectedStudentIds.size}</b> selected students.
                            </div>

                            <div>
                                <label className="label">Select Route</label>
                                <select
                                    className="input"
                                    required
                                    value={assignForm.route_id}
                                    onChange={e => {
                                        const r = routes.find(x => x.id == e.target.value);
                                        setAssignForm({
                                            ...assignForm,
                                            route_id: e.target.value,
                                            amount: r ? (r.monthly_fee || '') : ''
                                        });
                                    }}
                                >
                                    <option value="">-- Choose Route --</option>
                                    {routes.map(r => (
                                        <option key={r.id} value={r.id}>{r.route_name} {r.vehicle_number ? `(${r.vehicle_number})` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Fee Amount (Decimal allowed)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="input"
                                        placeholder="0.00"
                                        min="0"
                                        required
                                        value={assignForm.amount}
                                        onChange={e => setAssignForm({ ...assignForm, amount: e.target.value })}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">This amount will be added to the student's dues.</p>
                            </div>

                            <div>
                                <label className="label">Due Date</label>
                                <input
                                    type="date"
                                    className="input"
                                    required
                                    value={assignForm.due_date}
                                    onChange={e => setAssignForm({ ...assignForm, due_date: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="btn-primary w-full py-3 bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                            >
                                {isSubmitting ? 'Assigning...' : 'Confirm Assignment'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransportFees;
