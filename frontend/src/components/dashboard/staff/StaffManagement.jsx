import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

const StaffManagement = ({ config }) => {
    const [staff, setStaff] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', role: '', gender: '', address: '', join_date: new Date().toISOString().split('T')[0], salary_per_day: '', salary_per_month: '', library_access: false, hostel_access: false, employee_id: '', can_enroll_face: false, can_take_face_attendance: false, manual_attendance_classes: [] });
    const [selectedId, setSelectedId] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const formBottomRef = React.useRef(null);


    useEffect(() => { fetchStaff(); }, []);

    const fetchStaff = async () => {
        setLoading(true);
        try { const res = await api.get('/staff'); setStaff(res.data); }
        catch (e) { toast.error('Failed to load staff'); }
        finally { setLoading(false); }
    };

    const openAddModal = () => {
        setIsEditing(false);
        setFieldErrors({});
        setFormData({ name: '', email: '', phone: '', role: '', gender: '', address: '', join_date: new Date().toISOString().split('T')[0], salary_per_day: '', salary_per_month: '', library_access: false, hostel_access: false, employee_id: '', can_enroll_face: false, can_take_face_attendance: false, manual_attendance_classes: [] });
        setShowModal(true);
    };

    const isSubmittingRef = React.useRef(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isSubmitting || isSubmittingRef.current) return;

        setFieldErrors({});

        // Validation
        if (formData.phone && !/^\d{10}$/.test(formData.phone)) return toast.error('Phone must be 10 digits');

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (formData.email && !emailRegex.test(formData.email)) return toast.error('Invalid email format');

        setIsSubmitting(true);
        isSubmittingRef.current = true;
        try {
            const payload = { ...formData };

            // Convert monthly salary to daily (monthly / 26 working days)
            if (formData.salary_per_month) {
                payload.salary_per_day = (parseFloat(formData.salary_per_month) / 26).toFixed(2);
            }
            delete payload.salary_per_month; // Don't send monthly to backend

            if (isEditing) { await api.put(`/staff/${selectedId}`, payload); toast.success('Staff updated'); }
            else { await api.post('/staff', payload); toast.success('Staff added'); }
            setShowModal(false); fetchStaff();
        } catch (error) {
            const msg = error.response?.data?.message || 'Failed to save staff';
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
        if (!confirm('Delete staff?')) return;

        setIsSubmitting(true);
        try {
            await api.delete(`/staff/${id}`);
            toast.success('Deleted');
            fetchStaff();
        } catch (e) {
            toast.error('Failed to delete');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Staff Management</h2>
                    <p className="text-slate-500 text-sm">Manage non-teaching staff members</p>
                </div>
                <button type="button" onClick={openAddModal} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"><Plus size={20} /> Add New Staff</button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider border-b border-slate-100">
                            <tr>
                                <th className="p-4 pl-6">ID</th>
                                <th className="p-4">Join Date</th>
                                <th className="p-4">Name & Role</th>
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
                                        <td className="p-4"><div className="h-6 w-16 bg-slate-200 rounded"></div></td>
                                        <td className="p-4"><div className="h-4 w-28 bg-slate-200 rounded"></div></td>
                                        <td className="p-4"><div className="h-8 w-8 bg-slate-200 rounded ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : (
                                <>
                                    {staff.map(t => (
                                        <tr key={t.id} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 pl-6 font-mono text-slate-400 text-xs">{t.employee_id || '-'}</td>
                                            <td className="p-4 font-mono text-slate-500 text-xs">
                                                {t.join_date ? new Date(t.join_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                                        {t.name?.[0]?.toUpperCase() || 'S'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-700">{t.name}</div>
                                                        <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{t.role}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-bold text-xs border border-emerald-100">
                                                    ₹{t.salary_per_day ? (parseFloat(t.salary_per_day) * 26).toLocaleString() : 0}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-slate-600 text-sm">{t.phone}</div>
                                                <div className="text-slate-400 text-xs">{t.email}</div>
                                                {t.library_access && <div className="mt-1"><span className="bg-indigo-50 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-md font-bold border border-indigo-100">Library Access</span></div>}
                                                {t.hostel_access && <div className="mt-1"><span className="bg-rose-50 text-rose-600 text-[10px] px-1.5 py-0.5 rounded-md font-bold border border-rose-100">Hostel Access</span></div>}
                                            </td>
                                            <td className="p-4 pr-6 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { 
                                                        setIsEditing(true); 
                                                        setFieldErrors({}); 
                                                        setSelectedId(t.id); 
                                                        const monthlySalary = t.salary_per_day ? (parseFloat(t.salary_per_day) * 26).toFixed(0) : '0';
                                                        setFormData({ 
                                                            ...t, 
                                                            join_date: t.join_date ? t.join_date.split('T')[0] : '',
                                                            salary_per_month: monthlySalary,
                                                            library_access: t.library_access || false,
                                                            hostel_access: t.hostel_access || false,
                                                            can_enroll_face: t.can_enroll_face || false,
                                                            can_take_face_attendance: t.can_take_face_attendance || false,
                                                            manual_attendance_classes: (() => {
                                                                try {
                                                                    let parsed = typeof t.manual_attendance_classes === 'string' ? JSON.parse(t.manual_attendance_classes) : t.manual_attendance_classes;
                                                                    return Array.isArray(parsed) ? parsed : [];
                                                                } catch(e) { return []; }
                                                            })()
                                                        }); 
                                                        setShowModal(true); 
                                                    }} className="text-indigo-500 hover:bg-indigo-50 p-2 rounded-lg transition-colors"><Edit2 size={18} /></button>
                                                    <button onClick={() => handleDelete(t.id)} disabled={isSubmitting} className={`text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}><Trash2 size={18} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {staff.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-slate-400">
                                                No staff members found. Add one to get started.
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Staff Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                            <h3 className="text-lg font-bold text-gray-800">{isEditing ? 'Edit Staff' : 'Add New Staff'}</h3>
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button"
                                    onClick={() => formBottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
                                    className="text-indigo-600 hover:bg-indigo-100 p-2 rounded-full transition-colors flex items-center gap-1 text-xs font-bold"
                                    title="Scroll to bottom"
                                >
                                    <ChevronDown size={18} />
                                    <span>Scroll Down</span>
                                </button>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-y-auto max-h-[calc(90vh-120px)] scrollbar-hide">
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                                         id="staff-name"
                                         name="name"
                                         placeholder="Full Name"
                                         required
                                         pattern="[A-Za-z\s]+"
                                         title="Letters and spaces only"
                                         autoComplete="off"
                                         value={formData.name}
                                         onChange={e => {
                                             if (/^[A-Za-z\s]*$/.test(e.target.value)) {
                                                 setFormData({ ...formData, name: e.target.value });
                                             }
                                         }}
                                     />
                                </div>
                                <div className={isEditing ? "col-span-2" : "col-span-1"}>
                                    <label className="label">Role</label>
                                    <input
                                        className="input"
                                        id="staff-role"
                                        name="role"
                                        placeholder="Role (e.g., Clerk)"
                                        autoComplete="off"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Phone</label>
                                    <input
                                        className={`input ${fieldErrors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                                        id="staff-phone"
                                        name="phone"
                                        placeholder="Phone"
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
                                    <label className="label">Email</label>
                                    <input
                                        className={`input ${fieldErrors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                                        id="staff-email"
                                        name="email"
                                        placeholder="Email"
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
                                    <label className="label">Gender</label>
                                    <select className="input" value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                                        <option value="">Select Gender</option><option value="Male">Male</option><option value="Female">Female</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Date of Joining</label>
                                    <input
                                        className="input"
                                        type="date"
                                        autoComplete="off"
                                        max={new Date().toISOString().split('T')[0]}
                                        value={formData.join_date}
                                        onChange={e => setFormData({ ...formData, join_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-1">
                                    <label className="label">Salary Per Month</label>
                                    <input
                                        className="input"
                                        type="number"
                                        min="0"
                                        placeholder="30000"
                                        autoComplete="off"
                                        value={formData.salary_per_month}
                                        onCopy={e => e.preventDefault()}
                                        onPaste={e => e.preventDefault()}
                                        onChange={e => setFormData({ ...formData, salary_per_month: e.target.value })}
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Daily rate: ₹{formData.salary_per_month ? (parseFloat(formData.salary_per_month) / 26).toFixed(2) : '0'}/day</p>
                                </div>
                                <div className="col-span-1 flex flex-col justify-center gap-2 mt-[1rem]">
                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-colors"
                                            checked={formData.library_access}
                                            onChange={e => setFormData({ ...formData, library_access: e.target.checked })}
                                        />
                                        <span className="text-sm font-semibold text-slate-700">Allow Library Access</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 transition-colors"
                                            checked={formData.hostel_access}
                                            onChange={e => setFormData({ ...formData, hostel_access: e.target.checked })}
                                        />
                                        <span className="text-sm font-semibold text-slate-700">Allow Hostel Access</span>
                                    </label>
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
                                <p className="text-[10px] text-indigo-400 font-medium leading-tight">Giving these permissions allows this staff member to use biometric features on mobile.</p>
                            </div>

                            {/* Manual Attendance Permissions */}
                            <div className="bg-sky-50/50 p-4 rounded-lg border border-sky-100 space-y-3">
                                <h4 className="text-xs font-black text-sky-600 uppercase tracking-widest mb-1">Manual Attendance Access</h4>
                                <p className="text-[10px] text-slate-500 mb-2 leading-tight">Select which classes this staff member can manually mark attendance for.</p>
                                
                                <label className="flex items-center gap-2 cursor-pointer group mb-3 w-max">
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 text-sky-600 rounded" 
                                        checked={formData.manual_attendance_classes?.includes('ALL')} 
                                        onChange={e => {
                                            if (e.target.checked) {
                                                setFormData({ ...formData, manual_attendance_classes: ['ALL'] });
                                            } else {
                                                setFormData({ ...formData, manual_attendance_classes: [] });
                                            }
                                        }} 
                                    />
                                    <span className="font-bold text-slate-700 text-sm group-hover:text-sky-600 transition-colors">All Classes (Full Access)</span>
                                </label>

                                {(!formData.manual_attendance_classes || !formData.manual_attendance_classes.includes('ALL')) && (
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar border border-slate-200 rounded-lg p-2 bg-white flex flex-col gap-2">
                                        {config?.classes?.map(c => {
                                            const isClassChecked = formData.manual_attendance_classes?.includes(c.class_id) || formData.manual_attendance_classes?.includes(`C_${c.class_id}`);
                                            
                                            return (
                                                <div key={c.class_id} className="w-full flex flex-col p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-100 transition-colors">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 text-sky-600 rounded"
                                                            checked={isClassChecked}
                                                            onChange={e => {
                                                                const current = formData.manual_attendance_classes || [];
                                                                if (e.target.checked) {
                                                                    // Add C_id, remove any S_id under it
                                                                    const sectionIds = c.sections?.map(s => `S_${s.id}`) || [];
                                                                    setFormData({ ...formData, manual_attendance_classes: [...current.filter(id => !sectionIds.includes(id) && id !== c.class_id), `C_${c.class_id}`] });
                                                                } else {
                                                                    // Remove C_id
                                                                    setFormData({ ...formData, manual_attendance_classes: current.filter(id => id !== c.class_id && id !== `C_${c.class_id}`) });
                                                                }
                                                            }}
                                                        />
                                                        <span className="text-sm font-bold text-slate-700 truncate">{c.class_name} {c.sections?.length > 0 ? '(All Sections)' : ''}</span>
                                                    </label>
                                                    
                                                    {/* Render sections if class has sections, and class is NOT checked completely */}
                                                    {!isClassChecked && c.sections && c.sections.length > 0 && (
                                                        <div className="ml-6 mt-2 grid grid-cols-2 gap-2 border-l-2 border-slate-200 pl-3">
                                                            {c.sections.map(s => (
                                                                <label key={s.id} className="flex items-center gap-2 cursor-pointer w-full p-1.5 hover:bg-slate-100 rounded">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-3.5 h-3.5 text-indigo-500 rounded"
                                                                        checked={formData.manual_attendance_classes?.includes(`S_${s.id}`)}
                                                                        onChange={e => {
                                                                            const current = formData.manual_attendance_classes || [];
                                                                            if (e.target.checked) {
                                                                                setFormData({ ...formData, manual_attendance_classes: [...current, `S_${s.id}`] });
                                                                            } else {
                                                                                setFormData({ ...formData, manual_attendance_classes: current.filter(id => id !== `S_${s.id}`) });
                                                                            }
                                                                        }}
                                                                    />
                                                                    <span className="text-xs font-semibold text-slate-600 truncate">Section {s.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Processing...' : (isEditing ? 'Update Staff' : 'Add Staff')}
                                </button>
                            </div>
                            <div ref={formBottomRef} />
                        </form>
                    </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffManagement;
