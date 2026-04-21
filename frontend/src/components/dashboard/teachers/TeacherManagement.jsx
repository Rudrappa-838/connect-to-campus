import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

const TeacherManagement = ({ config }) => {
    const [teachers, setTeachers] = useState([]);
    const [dbSubjects, setDbSubjects] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isClassTeacher, setIsClassTeacher] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // State for field-specific errors
    const [fieldErrors, setFieldErrors] = useState({});

    // Form Data
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', subject_specialization: '',
        gender: '', address: '', join_date: new Date().toISOString().split('T')[0],
        assign_class_id: '', assign_section_id: '', salary_per_day: '', salary_per_month: '',
        employee_id: '', can_enroll_face: false, can_take_face_attendance: false
    });
    const [selectedId, setSelectedId] = useState(null);

    // Derived State
    const assignSections = config?.classes?.find(c => c.class_id === parseInt(formData.assign_class_id))?.sections || [];

    useEffect(() => {
        fetchTeachers();
        fetchSubjects();
    }, []);

    const fetchSubjects = async () => {
        try { const res = await api.get('/teachers/subjects'); setDbSubjects(res.data); }
        catch (e) { console.error(e); }
    };

    const fetchTeachers = async () => {
        setLoading(true);
        try { const res = await api.get('/teachers'); setTeachers(res.data); }
        catch (e) { toast.error('Failed to load teachers'); }
        finally { setLoading(false); }
    };

    const isSubmittingRef = React.useRef(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prevent double submit with immediate ref check
        if (isSubmitting || isSubmittingRef.current) return;

        setFieldErrors({}); // Clear previous errors

        // Validation
        if (formData.phone && !/^\d{10}$/.test(formData.phone)) return toast.error('Phone must be 10 digits');

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (formData.email && !emailRegex.test(formData.email)) return toast.error('Invalid email format');

        setIsSubmitting(true);
        isSubmittingRef.current = true;
        try {
            const payload = { ...formData };
            if (!isClassTeacher) {
                delete payload.assign_class_id;
                delete payload.assign_section_id;
            }

            // Convert monthly salary to daily (monthly / 26 working days)
            if (formData.salary_per_month) {
                payload.salary_per_day = (parseFloat(formData.salary_per_month) / 26).toFixed(2);
            }
            delete payload.salary_per_month; // Don't send monthly to backend

            if (isEditing) {
                await api.put(`/teachers/${selectedId}`, payload);
                toast.success('Teacher updated');
            } else {
                await api.post('/teachers', payload);
                toast.success('Teacher added');
            }
            setShowModal(false);
            fetchTeachers();
        } catch (error) {
            const msg = error.response?.data?.message || 'Failed to save teacher';

            // Check for specific duplicate errors
            if (msg.toLowerCase().includes('phone number already exists')) {
                setFieldErrors(prev => ({ ...prev, phone: msg }));
            } else if (msg.toLowerCase().includes('email already exists')) {
                setFieldErrors(prev => ({ ...prev, email: msg }));
            } else {
                toast.error(msg);
            }
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const handleDelete = async (id) => {
        if (isSubmitting) return;
        if (!confirm('Delete teacher?')) return;

        setIsSubmitting(true);
        try {
            await api.delete(`/teachers/${id}`);
            toast.success('Deleted');
            fetchTeachers();
        } catch (e) {
            toast.error('Failed to delete');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openAddModal = () => {
        setIsEditing(false);
        setFieldErrors({});
        setFormData(prev => ({
            name: '', email: '', phone: '', subject_specialization: '',
            gender: '', address: '', join_date: new Date().toISOString().split('T')[0],
            assign_class_id: prev.assign_class_id,
            assign_section_id: prev.assign_section_id,
            salary_per_day: '', salary_per_month: '',
            employee_id: '', can_enroll_face: false, can_take_face_attendance: false
        }));
        setShowModal(true);
    };

    // Render Subject Options
    const commonSubjects = dbSubjects.length > 0 ? dbSubjects : (config?.subjects || []);

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Teacher Management</h2>
                    <p className="text-slate-500 text-sm">Manage teaching staff and allocations</p>
                </div>
                <button onClick={openAddModal} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"><Plus size={20} /> Add Teacher</button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider border-b border-slate-100">
                            <tr>
                                <th className="p-4 pl-6">ID</th>
                                <th className="p-4">Join Date</th>
                                <th className="p-4">Name & Subject</th>
                                <th className="p-4">Assigned Class</th>
                                <th className="p-4">Salary/Month</th>
                                <th className="p-4">Contact</th>
                                <th className="p-4 text-right pr-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="p-4 pl-6"><div className="h-4 w-12 bg-slate-200 rounded"></div></td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                                                <div className="space-y-2">
                                                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                                                    <div className="h-3 w-20 bg-slate-200 rounded"></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4"><div className="h-6 w-24 bg-slate-200 rounded"></div></td>
                                        <td className="p-4"><div className="h-6 w-16 bg-slate-200 rounded"></div></td>
                                        <td className="p-4"><div className="h-4 w-28 bg-slate-200 rounded"></div></td>
                                        <td className="p-4"><div className="h-8 w-8 bg-slate-200 rounded ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : (
                                <>
                                    {teachers.map(t => (
                                        <tr key={t.id} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 pl-6 font-mono text-slate-400 text-xs">{t.employee_id || '-'}</td>
                                            <td className="p-4 font-mono text-slate-500 text-xs">
                                                {t.join_date ? new Date(t.join_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                                        {t.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-700">{t.name}</div>
                                                        <div className="text-xs text-slate-500 font-medium bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-0.5">{t.subject_specialization}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {t.class_name ? (
                                                    <span className="px-3 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs font-bold border border-violet-100 inline-flex items-center gap-1 shadow-sm">
                                                        {t.class_name}
                                                        {(config?.classes?.find(c => c.class_id === t.assigned_class_id)?.sections?.length > 1) && t.section_name && t.section_name !== 'Class Teacher' ? ` - ${t.section_name}` : ''}
                                                    </span>
                                                ) : <span className="text-slate-300 text-xs italic">Not Assigned</span>}
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-bold text-xs border border-emerald-100">
                                                    ₹{t.salary_per_day ? (parseFloat(t.salary_per_day) * 26).toLocaleString() : 0}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-slate-600 text-sm">{t.phone}</div>
                                                <div className="text-slate-400 text-xs">{t.email}</div>
                                            </td>
                                            <td className="p-4 pr-6 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { 
                                                        setIsEditing(true); 
                                                        setFieldErrors({}); 
                                                        setSelectedId(t.id); 
                                                        // Ensure salary_per_month is at least '0' if salary_per_day is 0 or null
                                                        const monthlySalary = t.salary_per_day ? (parseFloat(t.salary_per_day) * 26).toFixed(0) : '0';
                                                        setFormData({ 
                                                            ...t, 
                                                            join_date: t.join_date ? t.join_date.split('T')[0] : '',
                                                            assign_class_id: t.assigned_class_id || '', 
                                                            assign_section_id: t.assigned_section_id || '', 
                                                            salary_per_month: monthlySalary 
                                                        }); 
                                                        setIsClassTeacher(!!t.assigned_class_id); 
                                                        setShowModal(true); 
                                                    }} className="text-indigo-500 hover:bg-indigo-50 p-2 rounded-lg transition-colors"><Edit2 size={18} /></button>
                                                    <button onClick={() => handleDelete(t.id)} disabled={isSubmitting} className={`text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}><Trash2 size={18} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {teachers.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-slate-400">
                                                No teachers found. Add one to get started.
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4">{isEditing ? 'Edit Teacher' : 'Add Teacher'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {isEditing && (
                                    <div className="col-span-1">
                                        <label className="label">Employee ID</label>
                                        <input
                                            className="input bg-slate-50"
                                            readOnly
                                            autoComplete="off"
                                            value={formData.employee_id || ''}
                                        />
                                    </div>
                                )}
                                <div className={isEditing ? "col-span-1" : "col-span-2"}>
                                    <label className="label">Full Name <span className="text-red-500">*</span></label>
                                    <input
                                        className="input"
                                        id="teacher-name"
                                        name="name"
                                        placeholder="Full Name"
                                        required
                                        pattern="[A-Za-z\s]+"
                                        title="Letters and spaces only"
                                        autoComplete="off"
                                        value={formData.name}
                                        onCopy={e => e.preventDefault()}
                                        onPaste={e => e.preventDefault()}
                                        onChange={e => {
                                            if (/^[A-Za-z\s]*$/.test(e.target.value)) {
                                                setFormData({ ...formData, name: e.target.value });
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Subject Selection */}
                            <div>
                                <label className="label">Subject Specialization <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input
                                        list="subjects-list"
                                        className="input"
                                        id="teacher-subject"
                                        name="subject_specialization"
                                        required
                                        placeholder="Select or Type Subject"
                                        autoComplete="off"
                                        value={formData.subject_specialization}
                                        onCopy={e => e.preventDefault()}
                                        onPaste={e => e.preventDefault()}
                                        onChange={e => setFormData({ ...formData, subject_specialization: e.target.value })}
                                    />
                                    <datalist id="subjects-list">
                                        {commonSubjects.map(s => <option key={s} value={s} />)}
                                    </datalist>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Phone <span className="text-red-500">*</span></label>
                                    <input
                                        className={`input ${fieldErrors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                                        id="teacher-phone"
                                        name="phone"
                                        placeholder="Phone"
                                        required
                                        maxLength={10}
                                        autoComplete="off"
                                        value={formData.phone}
                                        onCopy={e => e.preventDefault()}
                                        onPaste={e => e.preventDefault()}
                                        onClick={() => setFieldErrors(prev => ({ ...prev, phone: '' }))}
                                        onFocus={() => setFieldErrors(prev => ({ ...prev, phone: '' }))}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                    />
                                    {fieldErrors.phone && <p className="text-xs text-red-500 mt-1 font-medium">{fieldErrors.phone}</p>}
                                </div>
                                <div>
                                    <label className="label">Email <span className="text-red-500">*</span></label>
                                    <input
                                        className={`input ${fieldErrors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                                        id="teacher-email"
                                        name="email"
                                        placeholder="Email"
                                        required
                                        type="email"
                                        autoComplete="off"
                                        value={formData.email}
                                        onCopy={e => e.preventDefault()}
                                        onPaste={e => e.preventDefault()}
                                        onClick={() => setFieldErrors(prev => ({ ...prev, email: '' }))}
                                        onFocus={() => setFieldErrors(prev => ({ ...prev, email: '' }))}
                                        onChange={e => setFormData({ ...formData, email: e.target.value.replace(/\s/g, '') })}
                                    />
                                    {fieldErrors.email && <p className="text-xs text-red-500 mt-1 font-medium">{fieldErrors.email}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Gender <span className="text-red-500">*</span></label>
                                    <select className="input" required value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                                        <option value="">Select Gender</option><option value="Male">Male</option><option value="Female">Female</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Date of Joining <span className="text-red-500">*</span></label>
                                    <input
                                        className="input"
                                        required
                                        type="date"
                                        autoComplete="off"
                                        max={new Date().toISOString().split('T')[0]}
                                        value={formData.join_date ? formData.join_date.split('T')[0] : ''}
                                        onChange={e => setFormData({ ...formData, join_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1">
                                    <label className="label">Salary Per Month <span className="text-red-500">*</span></label>
                                    <input
                                        className="input"
                                        type="number"
                                        min="0"
                                        required
                                        placeholder="30000"
                                        autoComplete="off"
                                        value={formData.salary_per_month}
                                        onCopy={e => e.preventDefault()}
                                        onPaste={e => e.preventDefault()}
                                        onChange={e => setFormData({ ...formData, salary_per_month: e.target.value })}
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Daily rate: ₹{formData.salary_per_month ? (parseFloat(formData.salary_per_month) / 26).toFixed(2) : '0'}/day</p>
                                </div>
                            </div>
                            <textarea
                                className="input"
                                placeholder="Address"
                                rows="2"
                                value={formData.address}
                                onCopy={e => e.preventDefault()}
                                onPaste={e => e.preventDefault()}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}>
                            </textarea>

                            {/* Class Teacher Assignment */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={isClassTeacher} onChange={e => setIsClassTeacher(e.target.checked)} />
                                    <span className="font-bold text-gray-700 text-sm">Assign as Class Teacher</span>
                                </label>

                                {isClassTeacher && (
                                    <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                                        <div>
                                            <label className="label">Class <span className="text-red-500">*</span></label>
                                            <select className="input" required={isClassTeacher} value={formData.assign_class_id} onChange={e => setFormData({ ...formData, assign_class_id: e.target.value, assign_section_id: '' })}>
                                                <option value="">Select Class</option>
                                                {config?.classes?.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                                            </select>
                                        </div>
                                        {assignSections.length > 0 && (
                                            <div>
                                                <label className="label">Section <span className="text-red-500">*</span></label>
                                                <select className="input" required={isClassTeacher} value={formData.assign_section_id} onChange={e => setFormData({ ...formData, assign_section_id: e.target.value })}>
                                                    <option value="">Select Section</option>
                                                    {assignSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Biometric Permissions */}
                            <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 space-y-3">
                                <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-1">Mobile App Biometric Access</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-indigo-600 rounded" 
                                            checked={formData.can_enroll_face} 
                                            onChange={e => setFormData({ ...formData, can_enroll_face: e.target.checked })} 
                                        />
                                        <span className="font-bold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors">Can Enroll Student Face</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 text-indigo-600 rounded" 
                                            checked={formData.can_take_face_attendance} 
                                            onChange={e => setFormData({ ...formData, can_take_face_attendance: e.target.checked })} 
                                        />
                                        <span className="font-bold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors">Can Take Attendance</span>
                                    </label>
                                </div>
                                <p className="text-[10px] text-indigo-400 font-medium leading-tight">Giving these permissions allows the teacher to use their mobile camera for student biometrics.</p>
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherManagement;
