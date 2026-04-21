import React, { useState, useEffect } from 'react';
import { Layers, Plus, Edit2, Trash2, X, ChevronDown, ChevronRight, Save, BookOpen } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const SectionManager = ({ classId }) => {
    const [sections, setSections] = useState([]);
    const [secLoading, setSecLoading] = useState(true);
    const [sectionName, setSectionName] = useState('');
    const [editingSection, setEditingSection] = useState(null);

    useEffect(() => {
        fetchSections();
    }, [classId]);

    const fetchSections = async () => {
        try {
            const res = await api.get(`/classes/${classId}/sections`);
            setSections(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setSecLoading(false);
        }
    };

    const handleAddSection = async (e) => {
        e.preventDefault();
        if (!sectionName.trim()) return;

        try {
            await api.post(`/classes/${classId}/sections`, { name: sectionName });
            toast.success('Section added');
            setSectionName('');
            fetchSections();
        } catch (error) {
            toast.error('Failed to add section');
        }
    };

    const handleUpdateSection = async () => {
        if (!editingSection || !editingSection.name.trim()) return;

        try {
            await api.put(`/classes/${classId}/sections/${editingSection.id}`, { name: editingSection.name });
            toast.success('Section updated');
            setEditingSection(null);
            fetchSections();
        } catch (error) {
            toast.error('Failed to update section');
        }
    };

    const handleDeleteSection = async (secId) => {
        if (!window.confirm('Delete this section?')) return;
        try {
            await api.delete(`/classes/${classId}/sections/${secId}`);
            toast.success('Section deleted');
            fetchSections();
        } catch (error) {
            toast.error('Failed to delete section');
        }
    };

    if (secLoading) return <div className="p-4 text-xs text-slate-400">Loading sections...</div>;

    return (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2 h-full">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                <Layers size={14} /> Manage Sections
            </h4>

            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {sections.map(sec => (
                    <div key={sec.id} className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-between shadow-sm">
                        {editingSection?.id === sec.id ? (
                            <div className="flex items-center gap-2 w-full">
                                <input
                                    autoFocus
                                    type="text"
                                    value={editingSection.name}
                                    onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })}
                                    className="border border-indigo-300 rounded px-2 py-1 text-sm flex-1 outline-none"
                                />
                                <button onClick={handleUpdateSection} className="text-green-600 hover:text-green-800"><Save size={14} /></button>
                                <button onClick={() => setEditingSection(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                            </div>
                        ) : (
                            <>
                                <span>{sec.name}</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setEditingSection(sec)}
                                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSection(sec.id)}
                                        className="text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                {sections.length === 0 && <span className="text-xs text-slate-400 italic py-1">No sections added yet</span>}
            </div>

            <form onSubmit={handleAddSection} className="flex gap-2">
                <input
                    type="text"
                    id="section-name"
                    name="name"
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    placeholder="New Section"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 outline-none focus:border-indigo-500"
                />
                <button
                    type="submit"
                    disabled={!sectionName.trim()}
                    className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-indigo-700"
                >
                    <Plus size={16} />
                </button>
            </form>
        </div>
    );
};

const SubjectManager = ({ classId }) => {
    const [subjects, setSubjects] = useState([]);
    const [subLoading, setSubLoading] = useState(true);
    const [editingSubject, setEditingSubject] = useState(null);

    // Form inputs
    const [subName, setSubName] = useState('');
    const [subCode, setSubCode] = useState('');
    const [subType, setSubType] = useState('Theory');

    useEffect(() => {
        fetchSubjects();
    }, [classId]);

    const fetchSubjects = async () => {
        try {
            const res = await api.get(`/classes/${classId}/subjects`);
            setSubjects(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setSubLoading(false);
        }
    };

    const handleAddSubject = async (e) => {
        e.preventDefault();
        if (!subName.trim()) return;

        try {
            await api.post(`/classes/${classId}/subjects`, {
                name: subName,
                code: subCode,
                type: subType
            });
            toast.success('Subject added');
            setSubName('');
            setSubCode('');
            setSubType('Theory');
            fetchSubjects();
        } catch (error) {
            toast.error('Failed to add subject');
        }
    };

    const handleUpdateSubject = async () => {
        if (!editingSubject || !editingSubject.name.trim()) return;

        try {
            await api.put(`/classes/${classId}/subjects/${editingSubject.id}`, {
                name: editingSubject.name,
                code: editingSubject.code,
                type: editingSubject.type
            });
            toast.success('Subject updated');
            setEditingSubject(null);
            fetchSubjects();
        } catch (error) {
            toast.error('Failed to update subject');
        }
    };

    const handleDeleteSubject = async (subId) => {
        if (!window.confirm('Delete this subject?')) return;
        try {
            await api.delete(`/classes/${classId}/subjects/${subId}`);
            toast.success('Subject deleted');
            fetchSubjects();
        } catch (error) {
            toast.error('Failed to delete subject');
        }
    };

    if (subLoading) return <div className="p-4 text-xs text-slate-400">Loading subjects...</div>;

    return (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2 h-full">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                <BookOpen size={14} /> Manage Subjects
            </h4>

            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {subjects.map(sub => (
                    <div key={sub.id} className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-sm font-medium flex flex-col gap-2 shadow-sm">
                        {editingSubject?.id === sub.id ? (
                            <div className="space-y-2 w-full">
                                <div className="flex gap-2">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={editingSubject.name}
                                        onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                                        className="border border-indigo-300 rounded px-2 py-1 text-sm flex-1 outline-none"
                                        placeholder="Name"
                                    />
                                    <select
                                        value={editingSubject.type}
                                        onChange={(e) => setEditingSubject({ ...editingSubject, type: e.target.value })}
                                        className="border border-indigo-300 rounded px-2 py-1 text-xs outline-none"
                                    >
                                        <option value="Theory">Theory</option>
                                        <option value="Practical">Practical</option>
                                    </select>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={editingSubject.code || ''}
                                        onChange={(e) => setEditingSubject({ ...editingSubject, code: e.target.value })}
                                        className="border border-indigo-300 rounded px-2 py-1 text-xs flex-1 outline-none"
                                        placeholder="Code (opt)"
                                    />
                                    <button onClick={handleUpdateSubject} className="text-green-600 hover:text-green-800"><Save size={16} /></button>
                                    <button onClick={() => setEditingSubject(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center w-full">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-800">{sub.name}</span>
                                        {sub.code && <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{sub.code}</span>}
                                    </div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">{sub.type}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setEditingSubject(sub)}
                                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSubject(sub.id)}
                                        className="text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {subjects.length === 0 && <span className="text-xs text-slate-400 italic py-1">No subjects added yet</span>}
            </div>

            <form onSubmit={handleAddSubject} className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <input
                        type="text"
                        id="subject-name"
                        name="name"
                        value={subName}
                        onChange={(e) => setSubName(e.target.value)}
                        placeholder="Subject Name"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 outline-none focus:border-indigo-500"
                    />
                    <select
                        value={subType}
                        onChange={(e) => setSubType(e.target.value)}
                        className="px-2 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-indigo-500 bg-white"
                    >
                        <option value="Theory">Theory</option>
                        <option value="Practical">Practical</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        id="subject-code"
                        name="code"
                        value={subCode}
                        onChange={(e) => setSubCode(e.target.value)}
                        placeholder="Code (opt)"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 outline-none focus:border-indigo-500"
                    />
                    <button
                        type="submit"
                        disabled={!subName.trim()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-indigo-700"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </form>
        </div>
    );
};

const ClassManagement = ({ schoolId }) => {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedClass, setExpandedClass] = useState(null);
    const [editingClass, setEditingClass] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);

    // Form States
    const [newClassName, setNewClassName] = useState('');

    useEffect(() => {
        fetchClasses();
    }, [schoolId]);

    const fetchClasses = async () => {
        setLoading(true);
        try {
            // Pass schoolId query param if prop is provided (Super Admin mode)
            const url = schoolId ? `/classes?schoolId=${schoolId}` : '/classes';
            const res = await api.get(url);
            setClasses(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load classes');
        } finally {
            setLoading(false);
        }
    };

    const handleAddClass = async (e) => {
        e.preventDefault();
        if (!newClassName.trim()) return;

        try {
            await api.post('/classes', {
                name: newClassName,
                schoolId: schoolId // Pass schoolId if in Super Admin mode
            });
            toast.success('Class added successfully');
            setNewClassName('');
            setShowAddModal(false);
            fetchClasses();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add class');
        }
    };

    const handleUpdateClass = async () => {
        if (!editingClass || !editingClass.name.trim()) return;

        try {
            await api.put(`/classes/${editingClass.id}`, { name: editingClass.name });
            toast.success('Class updated');
            setEditingClass(null);
            fetchClasses();
        } catch (error) {
            toast.error('Failed to update class');
        }
    };

    const handleDeleteClass = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete "${name}"? This requires the class to be empty (no students).`)) return;

        try {
            await api.delete(`/classes/${id}`);
            toast.success('Class deleted');
            fetchClasses();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete class');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                            <Layers className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black">Class Management</h2>
                            <p className="text-indigo-100 text-sm">Create and organize classes, sections, and subjects</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-white text-indigo-600 hover:bg-indigo-50 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                    >
                        <Plus size={20} />
                        New Class
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-3">
                {classes
                    .slice()
                    .sort((a, b) => {
                        const numA = parseInt(a.name.replace(/\D/g, '') || '0', 10);
                        const numB = parseInt(b.name.replace(/\D/g, '') || '0', 10);
                        return numA === numB ? a.name.localeCompare(b.name) : numA - numB;
                    })
                    .map(cls => (
                        <div key={cls.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50" onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}>
                                <div className="flex items-center gap-4">
                                    <button
                                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        {expandedClass === cls.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </button>

                                    {editingClass?.id === cls.id ? (
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                autoFocus
                                                type="text"
                                                value={editingClass.name}
                                                onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                                                className="border border-indigo-300 rounded px-2 py-1 text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
                                            />
                                            <button onClick={handleUpdateClass} className="bg-green-100 text-green-700 p-1.5 rounded hover:bg-green-200"><Save size={16} /></button>
                                            <button onClick={() => setEditingClass(null)} className="bg-slate-100 text-slate-600 p-1.5 rounded hover:bg-slate-200"><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <h3 className="text-lg font-bold text-slate-800">{cls.name}</h3>
                                    )}
                                </div>

                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => setEditingClass(cls)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClass(cls.id, cls.name)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Expandable Section Area */}
                            {expandedClass === cls.id && (
                                <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50/50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <SectionManager classId={cls.id} />
                                        <SubjectManager classId={cls.id} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                {classes.length === 0 && !loading && (
                    <div className="text-center p-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        No classes found. Add one to get started.
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-slate-800">Add New Class</h3>
                            <button onClick={() => setShowAddModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <form onSubmit={handleAddClass} className="p-6">
                            <label className="block text-sm font-bold text-slate-600 mb-2">Class Name</label>
                            <input
                                type="text"
                                id="new-class-name"
                                name="name"
                                placeholder="e.g. 10, 11th JEE, 12th Commerce"
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none mb-4"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={!newClassName.trim()}
                                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                Create Class
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClassManagement;
