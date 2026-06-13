import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Users, Check, Filter, Save, RefreshCw, Search, CheckSquare, Square, Tag, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

const CURRENT_YEAR = new Date().getFullYear();
const ACADEMIC_YEAR = `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`;

const SubjectCombination = ({ config }) => {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [searchStudent, setSearchStudent] = useState('');
    const [academicYear] = useState(ACADEMIC_YEAR);

    const [groups, setGroups] = useState([]);
    const [legacySubjects, setLegacySubjects] = useState([]); // from old subjects table
    const [students, setStudents] = useState([]);
    const [assignments, setAssignments] = useState({}); // { student_id: { group_id, chosen_subjects } }
    
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Mode: 'group' (preconfigured combinations) or 'custom' (build on the fly)
    const [allocationMode, setAllocationMode] = useState('group'); 

    // Selections
    const [activeGroupId, setActiveGroupId] = useState(null);
    const [activeSubjectIds, setActiveSubjectIds] = useState(new Set()); // Custom subjects
    const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

    const sortedClasses = React.useMemo(() => {
        return [...(config?.classes || [])].sort((a, b) => {
            const numA = parseInt(a.class_name.replace(/\D/g, '') || '0', 10);
            const numB = parseInt(b.class_name.replace(/\D/g, '') || '0', 10);
            return numA === numB ? a.class_name.localeCompare(b.class_name) : numA - numB;
        });
    }, [config?.classes]);

    const sections = sortedClasses.find(c => c.class_id === parseInt(selectedClass))?.sections || [];

    const filteredStudents = students.filter(s =>
        !searchStudent || s.name.toLowerCase().includes(searchStudent.toLowerCase()) || (s.admission_no || '').toLowerCase().includes(searchStudent.toLowerCase())
    );

    const fetchConfiguredData = useCallback(async (classId) => {
        if (!classId) return;
        try {
            // Fetch Groups
            const grpRes = await api.get('/subject-groups/groups', { params: { class_id: classId } });
            setGroups(Array.isArray(grpRes.data) ? grpRes.data : []);
            
            // Fetch Legacy Subjects for custom ad-hoc combinations
            const subRes = await api.get(`/classes/${classId}/subjects`);
            setLegacySubjects(Array.isArray(subRes.data) ? subRes.data : []);
        } catch (err) {
            console.error('Error fetching combinations/subjects:', err);
        }
    }, []);

    const fetchStudentsAndAssignments = useCallback(async (classId, sectionId) => {
        if (!classId) { setStudents([]); setAssignments({}); return; }
        setLoading(true);
        try {
            const params = { class_id: classId, limit: 200 };
            if (sectionId) params.section_id = sectionId;
            const stuRes = await api.get('/students', { params });
            setStudents(stuRes.data?.data || stuRes.data || []);

            const asnRes = await api.get('/subject-groups/assignments/class', {
                params: { class_id: classId, academic_year: academicYear }
            });
            const map = {};
            (asnRes.data || []).forEach(row => {
                map[row.id] = { group_id: row.group_id, chosen_subjects: row.chosen_subjects || [] };
            });
            setAssignments(map);
        } catch (err) {
            console.error('Error fetching students:', err);
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    }, [academicYear]);

    useEffect(() => {
        if (selectedClass) {
            fetchConfiguredData(selectedClass);
            fetchStudentsAndAssignments(selectedClass, selectedSection);
            setActiveGroupId(null);
            setActiveSubjectIds(new Set());
            setSelectedStudentIds(new Set());
        } else {
            setGroups([]);
            setLegacySubjects([]);
            setStudents([]);
            setAssignments({});
        }
    }, [selectedClass, selectedSection]);

    // Auto-select students matching currently selected group or exact custom combo
    useEffect(() => {
        if (allocationMode === 'group' && activeGroupId) {
            const ids = new Set(students.filter(s => assignments[s.id]?.group_id === activeGroupId).map(s => s.id));
            setSelectedStudentIds(ids);
        } else if (allocationMode === 'custom' && activeSubjectIds.size > 0) {
            // Exact match for custom subjects
            const customArr = [...activeSubjectIds].sort().join(',');
            const ids = new Set(students.filter(s => {
                const ast = assignments[s.id];
                if (!ast || ast.group_id) return false;
                const stuSubs = [...(ast.chosen_subjects || [])].sort().join(',');
                return stuSubs === customArr;
            }).map(s => s.id));
            setSelectedStudentIds(ids);
        } else {
            setSelectedStudentIds(new Set());
        }
    }, [activeGroupId, activeSubjectIds, allocationMode]);

    const toggleStudent = (id) => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSubject = (id) => {
        const subject = legacySubjects.find(s => s.id === id);
        if (!subject) return;
        const subName = subject.name.toLowerCase();

        const currentClass = sortedClasses.find(c => c.class_id === parseInt(selectedClass));
        const className = (currentClass?.class_name || '').toLowerCase().trim();
        const isPUC = className === 'class 1' || 
                      className === 'class 2' || 
                      className.includes('11') || 
                      className.includes('12') || 
                      className.includes('puc') || 
                      className === '1' || 
                      className === '2';

        setActiveSubjectIds(prev => {
            const next = new Set(prev);
            
            if (next.has(id)) {
                next.delete(id);
                return next;
            }

            // Mutual exclusion for 11/12/PUC
            if (isPUC) {
                // Rule 1: Computer vs Biology
                if (subName.includes('computer')) {
                    const bio = legacySubjects.find(s => next.has(s.id) && s.name.toLowerCase().includes('biology'));
                    if (bio) {
                        next.delete(bio.id);
                        toast('Biology removed (Cannot take with Computer)', { icon: '⚠️' });
                    }
                } else if (subName.includes('biology')) {
                    const comp = legacySubjects.find(s => next.has(s.id) && s.name.toLowerCase().includes('computer'));
                    if (comp) {
                        next.delete(comp.id);
                        toast('Computer removed (Cannot take with Biology)', { icon: '⚠️' });
                    }
                }

                // Rule 2: Hindi vs Kannada
                if (subName.includes('hindi')) {
                    const kan = legacySubjects.find(s => next.has(s.id) && s.name.toLowerCase().includes('kannada'));
                    if (kan) {
                        next.delete(kan.id);
                        toast('Kannada removed (Cannot take with Hindi)', { icon: '⚠️' });
                    }
                } else if (subName.includes('kannada')) {
                    const hin = legacySubjects.find(s => next.has(s.id) && s.name.toLowerCase().includes('hindi'));
                    if (hin) {
                        next.delete(hin.id);
                        toast('Hindi removed (Cannot take with Kannada)', { icon: '⚠️' });
                    }
                }
            }

            next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        if (allocationMode === 'group' && !activeGroupId) { toast.error('Select a group'); return; }
        if (allocationMode === 'custom' && activeSubjectIds.size === 0) { toast.error('Select at least one subject'); return; }
        if (selectedStudentIds.size === 0) { toast.error('Select at least one student'); return; }

        setSaving(true);
        try {
            await api.post('/subject-groups/assignments/bulk', {
                student_ids: [...selectedStudentIds],
                group_id: allocationMode === 'group' ? activeGroupId : null,
                chosen_subjects: allocationMode === 'custom' ? [...activeSubjectIds] : [],
                class_id: parseInt(selectedClass),
                academic_year: academicYear,
            });
            toast.success(`Allocated to ${selectedStudentIds.size} student(s)!`);
            fetchStudentsAndAssignments(selectedClass, selectedSection);
        } catch (err) {
            console.error(err);
            toast.error('Failed to save assignments');
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async () => {
        if (selectedStudentIds.size === 0) return;
        setSaving(true);
        try {
            await api.post('/subject-groups/assignments/clear', {
                student_ids: [...selectedStudentIds],
                class_id: parseInt(selectedClass),
                academic_year: academicYear,
            });
            toast.success(`Cleared allocation for ${selectedStudentIds.size} student(s)`);
            fetchStudentsAndAssignments(selectedClass, selectedSection);
            setSelectedStudentIds(new Set());
        } catch (err) {
            console.error(err);
            toast.error('Failed to clear assignments');
        } finally {
            setSaving(false);
        }
    };

    const assignedCount = students.filter(s => assignments[s.id]?.group_id || assignments[s.id]?.chosen_subjects?.length > 0).length;

    const renderAssignmentBadge = (assignment) => {
        if (!assignment) return <span className="text-xs text-slate-400 italic">Unassigned</span>;
        
        if (assignment.group_id) {
            const g = groups.find(g => g.id === assignment.group_id);
            if (g) return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-100 text-violet-700 border border-violet-200 rounded-full text-xs font-bold"><Layers size={12}/> {g.name}</span>;
        }
        
        if (assignment.chosen_subjects?.length > 0) {
            const names = assignment.chosen_subjects.map(id => legacySubjects.find(s => s.id === id)?.name || id);
            return <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-100 text-sky-700 border border-sky-200 rounded-full text-[10px] font-bold"><BookOpen size={12}/> {names.join(', ')}</span>;
        }

        return <span className="text-xs text-slate-400 italic">Unassigned</span>;
    };

    const isSelectionActive = (allocationMode === 'group' && activeGroupId) || (allocationMode === 'custom' && activeSubjectIds.size > 0);

    return (
        <div className="space-y-5">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <BookOpen size={28} />
                    Subject Allocation
                </h2>
                <p className="text-violet-100 mt-1 text-sm">
                    Assign pre-configured combinations or build custom subject lists for students.
                </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                    <Filter size={16} className="text-slate-400" />
                    <select
                        value={selectedClass}
                        onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }}
                        className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer min-w-[120px]"
                    >
                        <option value="">Select Class</option>
                        {sortedClasses.map(c => (
                            <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
                        ))}
                    </select>
                </div>

                {sections.length > 0 && (
                    <select
                        value={selectedSection}
                        onChange={e => setSelectedSection(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 outline-none px-4 py-2.5 rounded-xl cursor-pointer"
                    >
                        <option value="">All Sections</option>
                        {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                )}

                {selectedClass && (
                    <div className="ml-auto flex items-center gap-3">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                            {assignedCount} / {students.length} Allocated
                        </span>
                    </div>
                )}
            </div>

            {!selectedClass && (
                <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400 font-medium">
                    Select a class to begin mapping subjects
                </div>
            )}

            {selectedClass && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                    {/* Mode Toggle */}
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit mb-6">
                        <button 
                            onClick={() => { setAllocationMode('group'); setActiveSubjectIds(new Set()); }}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${allocationMode === 'group' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Pre-configured Groups
                        </button>
                        <button 
                            onClick={() => { setAllocationMode('custom'); setActiveGroupId(null); }}
                            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${allocationMode === 'custom' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Custom Selection (Subjects)
                        </button>
                    </div>

                    {/* Pre-configured Groups */}
                    {allocationMode === 'group' && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Layers size={15} className="text-violet-500"/> Select Group</h3>
                            {groups.length === 0 ? (
                                <p className="text-sm text-slate-400 bg-slate-50 p-4 rounded-xl border border-slate-100">No subject groups configured by Admin. Use "Custom Selection" instead.</p>
                            ) : (
                                <div className="flex flex-wrap gap-3">
                                    {groups.map(group => {
                                        const isActive = activeGroupId === group.id;
                                        return (
                                            <button
                                                key={group.id}
                                                onClick={() => setActiveGroupId(isActive ? null : group.id)}
                                                className={`px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all flex items-center gap-2
                                                    ${isActive ? 'bg-violet-600 text-white border-violet-700 shadow-md scale-105' : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-violet-300'}`}
                                            >
                                                {isActive && <Check size={14}/>} {group.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Custom Selection */}
                    {allocationMode === 'custom' && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Tag size={15} className="text-sky-500"/> Build Custom Combination</h3>
                            {legacySubjects.length === 0 ? (
                                <p className="text-sm text-slate-400 bg-slate-50 p-4 rounded-xl border border-slate-100">No subjects found for this class.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {legacySubjects.map(sub => {
                                        const isActive = activeSubjectIds.has(sub.id);
                                        return (
                                            <button
                                                key={sub.id}
                                                onClick={() => toggleSubject(sub.id)}
                                                className={`px-3 py-2 rounded-lg border-2 font-bold text-xs transition-all flex items-center gap-2
                                                    ${isActive ? 'bg-sky-500 text-white border-sky-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'}`}
                                            >
                                                {isActive && <Check size={12}/>} {sub.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                            {activeSubjectIds.size > 0 && (
                                <div className="text-xs font-medium text-sky-700 bg-sky-50 p-2 rounded border border-sky-100 inline-block mt-2">
                                    {activeSubjectIds.size} subject(s) selected to form combination.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {selectedClass && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-5">
                    <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Users size={16}/> Student List 
                            {selectedStudentIds.size > 0 && <span className="bg-violet-600 text-white px-2 py-0.5 rounded text-[10px] ml-2">{selectedStudentIds.size} selected</span>}
                        </span>
                        
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="search" placeholder="Search..." value={searchStudent} onChange={e => setSearchStudent(e.target.value)} className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-violet-400" />
                            </div>
                            {selectedStudentIds.size > 0 && (
                                <button
                                    onClick={handleClear}
                                    disabled={saving}
                                    className="bg-rose-100 hover:bg-rose-200 text-rose-700 px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? <RefreshCw size={12} className="animate-spin" /> : <Tag size={12} className="rotate-45" />} Clear
                                </button>
                            )}
                            {isSelectionActive && (
                                <button
                                    onClick={handleSave}
                                    disabled={saving || selectedStudentIds.size === 0}
                                    className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} Apply
                                </button>
                            )}
                        </div>
                    </div>

                    {!isSelectionActive && selectedStudentIds.size === 0 && (
                        <div className="px-5 py-2 bg-amber-50 text-xs font-bold text-amber-700 border-b border-amber-100">
                            ⚠️ Select a Group or Custom Subjects above to apply, or tick students directly to Clear allocation.
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="p-3 pl-5 w-12 text-left">
                                        <button onClick={() => setSelectedStudentIds(selectedStudentIds.size === filteredStudents.length ? new Set() : new Set(filteredStudents.map(s=>s.id)))}>
                                            {selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0 ? <CheckSquare size={16} className="text-violet-600"/> : <Square size={16} className="text-slate-400"/>}
                                        </button>
                                    </th>
                                    <th className="p-3 text-left text-[11px] font-bold text-slate-500 uppercase">Roll</th>
                                    <th className="p-3 text-left text-[11px] font-bold text-slate-500 uppercase">Student</th>
                                    <th className="p-3 text-left text-[11px] font-bold text-slate-500 uppercase">Current Allocation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map(student => {
                                    const isSelected = selectedStudentIds.has(student.id);
                                    return (
                                        <tr key={student.id} onClick={() => toggleStudent(student.id)} className={`border-b border-slate-50 cursor-pointer ${isSelected ? 'bg-violet-50' : 'hover:bg-slate-50'}`}>
                                            <td className="p-3 pl-5">
                                                <div className={`w-4 h-4 rounded flex items-center justify-center border-2 ${isSelected ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-300'}`}>
                                                    {isSelected && <Check size={10}/>}
                                                </div>
                                            </td>
                                            <td className="p-3 text-xs font-mono font-bold text-slate-500">{student.roll_number || '-'}</td>
                                            <td className="p-3">
                                                <p className="font-bold text-slate-800 text-xs">{student.name}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">{student.admission_no}</p>
                                            </td>
                                            <td className="p-3">
                                                {renderAssignmentBadge(assignments[student.id])}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubjectCombination;
