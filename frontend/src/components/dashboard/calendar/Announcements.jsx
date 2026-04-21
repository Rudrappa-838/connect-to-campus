import React, { useState, useEffect, useRef } from 'react';
import { Bell, Plus, Trash2, Tag, Clock, Users, Paperclip, FileText, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

import { useAuth } from '../../../context/AuthContext';

const Announcements = () => {
    const { user } = useAuth();
    const isAdmin = ['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

    const [announcements, setAnnouncements] = useState([]);
    const [classes, setClasses] = useState([]);
    const [sections, setSections] = useState([]);

    // Form States
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [targetRole, setTargetRole] = useState('');
    const [priority, setPriority] = useState('Normal');
    const [validUntil, setValidUntil] = useState('');
    
    // Attachment State
    const [attachmentData, setAttachmentData] = useState(null);
    const [attachmentName, setAttachmentName] = useState('');
    const [attachmentType, setAttachmentType] = useState('');
    const fileInputRef = useRef(null);

    // Specific Targeting States
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedStaffRole, setSelectedStaffRole] = useState('');

    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [availableRoles, setAvailableRoles] = useState([]);

    const [audienceCount, setAudienceCount] = useState(null);
    const [isCounting, setIsCounting] = useState(false);

    useEffect(() => {
        fetchAnnouncements();
        fetchClasses();
        fetchOptions();
    }, []);

    // Fetch Sections when Class Changes
    useEffect(() => {
        if (selectedClass) {
            setSections([]); // Clear previous sections
            setSelectedSection('');
            fetchSections(selectedClass);
        } else {
            setSections([]);
            setSelectedSection('');
        }
    }, [selectedClass]);

    // Live Audience Count Effect with Race-Condition Protection
    useEffect(() => {
        if (!isAdmin) return;

        // Skip if nothing is selected to avoid unnecessary API calls
        if (!targetRole || (targetRole === 'Class' && !selectedClass)) {
            setAudienceCount(null);
            setIsCounting(false);
            return;
        }

        const controller = new AbortController();

        const fetchAudienceCount = async () => {
            setIsCounting(true);
            try {
                const params = new URLSearchParams({
                    target_role: targetRole,
                    class_id: selectedClass || '',
                    section_id: selectedSection || '',
                    subject_name: selectedSubject || '',
                    staff_role: selectedStaffRole || ''
                });

                const res = await api.get(`/calendar/announcements/count?${params.toString()}`, {
                    signal: controller.signal
                });

                setAudienceCount(res.data.count);
            } catch (error) {
                if (error.name === 'CanceledError' || error.name === 'AbortError') return;
                console.error("Failed to fetch count", error);
                setAudienceCount(null);
            } finally {
                // Only stop counting if this was the latest request
                if (!controller.signal.aborted) {
                    setIsCounting(false);
                }
            }
        };

        // Instant trigger for "static" roles (no extra details needed)
        const isStaticRole = ['All', 'Student', 'Teacher', 'Staff'].includes(targetRole);
        const delay = isStaticRole ? 0 : 40;

        const timer = setTimeout(fetchAudienceCount, delay);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [targetRole, selectedClass, selectedSection, isAdmin]); // Removed legacy deps

    const fetchClasses = async () => {
        try {
            const res = await api.get('/classes');
            setClasses(res.data);
        } catch (error) { console.error('Error loading classes'); }
    };

    const fetchSections = async (classId) => {
        try {
            const res = await api.get(`/classes/${classId}/sections`);
            setSections(res.data);
        } catch (error) { console.error('Error loading sections'); }
    };

    const fetchOptions = async () => {
        try {
            const res = await api.get('/calendar/announcements/options');
            setAvailableSubjects(res.data.subjects || []);
            setAvailableRoles(res.data.roles || []);
        } catch (error) { console.error('Error loading options'); }
    };

    const fetchAnnouncements = async () => {
        try {
            const res = await api.get('/calendar/announcements');
            setAnnouncements(res.data);
        } catch (error) {
            toast.error('Failed to load announcements');
        }
    };

    // Reset selections not relevant to current role
    useEffect(() => {
        if (targetRole !== 'Class') {
            setSelectedClass('');
            setSelectedSection('');
        }
    }, [targetRole]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Limiting to 5MB for base64 to avoid huge payloads (5MB approx)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must be under 5MB');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setAttachmentData(reader.result);
            setAttachmentName(file.name);
            setAttachmentType(file.type);
        };
        reader.readAsDataURL(file);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            // Validation
            if (!targetRole) return toast.error('Please select an audience');
            if (targetRole === 'Class' && !selectedClass) return toast.error('Please select a class');
            if (targetRole === 'Subject' && !selectedSubject) return toast.error('Please select a subject');
            if (targetRole === 'Role' && !selectedStaffRole) return toast.error('Please select a staff role');
            if (!validUntil) return toast.error('Please select a valid until date');

            const payload = {
                title,
                message,
                target_role: targetRole,
                priority,
                valid_until: validUntil || null,
                class_id: targetRole === 'Class' ? selectedClass : null,
                section_id: (targetRole === 'Class' && selectedSection) ? selectedSection : null,
                subject_name: targetRole === 'Subject' ? selectedSubject : null,
                staff_role: targetRole === 'Role' ? selectedStaffRole : null,
                attachment_data: attachmentData,
                attachment_type: attachmentType
            };

            console.log("Posting Announcement Payload:", payload); // Debug log

            await api.post('/calendar/announcements', payload);
            toast.success(`Announcement posted to ${audienceCount} members!`);

            // Reset Form
            setTitle('');
            setMessage('');
            setValidUntil('');
            setTargetRole('');
            setSelectedClass('');
            setSelectedSection('');
            setSelectedSubject('');
            setSelectedStaffRole('');
            
            setAttachmentData(null);
            setAttachmentName('');
            setAttachmentType('');
            if (fileInputRef.current) fileInputRef.current.value = '';

            fetchAnnouncements();
        } catch (error) {
            console.error("Post Error:", error);
            const errMsg = error.response?.data?.message || error.message || 'Failed to post announcement';
            toast.error(errMsg);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this announcement?')) return;
        try {
            await api.delete(`/calendar/announcements/${id}`);
            toast.success('Deleted');
            fetchAnnouncements();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in h-full">
            {/* Form Section - Back on the Left for primary action */}
            {isAdmin && (
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6 lg:top-24 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto custom-scrollbar">
                        <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
                            <Plus size={20} className="text-indigo-600" /> New Announcement
                        </h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
                                <input
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    placeholder="Important Notice"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Attachment (Image/PDF up to 5MB)</label>
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={handleFileChange}
                                    ref={fileInputRef}
                                    className={`w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors border border-slate-200 rounded-lg p-1 ${attachmentName ? 'hidden' : 'block'}`}
                                />
                                {attachmentName && (
                                    <div className="flex items-center justify-between p-2 border border-slate-200 bg-slate-50 rounded-lg">
                                        <span className="text-sm font-medium text-slate-700 truncate mr-2 flex-1" title={attachmentName}>
                                            📎 {attachmentName}
                                        </span>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setAttachmentData(null);
                                                setAttachmentName('');
                                                setAttachmentType('');
                                                if (fileInputRef.current) fileInputRef.current.value = '';
                                            }}
                                            className="text-white bg-red-500 hover:bg-red-600 text-xs font-bold px-3 py-1.5 rounded outline-none transition-colors shadow-sm ml-2 flex-shrink-0"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Message</label>
                                <textarea
                                    required
                                    rows="4"
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    placeholder="Details..."
                                ></textarea>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Audience</label>
                                    <select
                                        value={targetRole}
                                        onChange={e => setTargetRole(e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none ${!targetRole ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}
                                        required
                                    >
                                        <option value="">-- Select Audience --</option>
                                        <option value="All">Everyone (All)</option>
                                        <option value="Student">Students</option>
                                        <option value="Class">Specific Class</option>
                                        <option value="Teacher">Teachers</option>
                                        <option value="Staff">Staffs</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Priority</label>
                                    <select
                                        value={priority}
                                        onChange={e => setPriority(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    >
                                        <option value="Normal">Normal</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            {/* Audience Count Display */}
                            {(audienceCount !== null || isCounting) && (
                                <div className={`text-xs font-semibold px-3 py-2.5 rounded-xl flex items-center gap-3 border transition-all duration-300 shadow-sm ${isCounting ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                                    }`}>
                                    <div className="relative">
                                        <Users size={16} className={isCounting ? 'animate-pulse text-indigo-400' : 'text-indigo-600'} />
                                        {isCounting && <div className="absolute inset-0 bg-indigo-400 rounded-full animate-ping opacity-20"></div>}
                                    </div>
                                    {isCounting ? (
                                        <span className="animate-pulse">Analyzing audience size...</span>
                                    ) : (
                                        <span className="animate-in fade-in slide-in-from-left-1">
                                            Will reach <strong>{audienceCount}</strong> {audienceCount === 1 ? 'verified member' : 'verified members'}
                                        </span>
                                    )}
                                </div>
                            )}
                            promotional

                            {/* Conditional Inputs */}
                            {targetRole === 'Class' && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Select Class</label>
                                        <select
                                            value={selectedClass}
                                            onChange={e => setSelectedClass(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                                            required
                                        >
                                            <option value="">-- Select Class --</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.school_name ? `${c.school_name} - ` : ''}{c.name}</option>)}
                                        </select>
                                    </div>
                                    {selectedClass && sections.length > 0 && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Select Section (Optional)</label>
                                            <select
                                                value={selectedSection}
                                                onChange={e => setSelectedSection(e.target.value)}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                                            >
                                                <option value="">All Sections</option>
                                                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {targetRole === 'Subject' && (
                                <div className="animate-in fade-in slide-in-from-top-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Select Subject</label>
                                    <select
                                        value={selectedSubject}
                                        onChange={e => setSelectedSubject(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                                        required
                                    >
                                        <option value="">-- Select Subject --</option>
                                        {availableSubjects.map((s, i) => <option key={i} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            )}

                            {targetRole === 'Role' && (
                                <div className="animate-in fade-in slide-in-from-top-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Select Staff Role</label>
                                    <select
                                        value={selectedStaffRole}
                                        onChange={e => setSelectedStaffRole(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none"
                                        required
                                    >
                                        <option value="">-- Select Role --</option>
                                        {availableRoles.map((r, i) => <option key={i} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Valid Until date (Auto-delete after)</label>
                                <input
                                    required
                                    type="date"
                                    value={validUntil}
                                    onChange={e => setValidUntil(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                            <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold transition-colors">
                                Post Announcement
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* List Section - Now on the Right */}
            <div className={`space-y-4 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto px-6 custom-scrollbar ${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 sticky top-0 bg-slate-50/80 backdrop-blur-md py-2 z-10 rounded-lg px-2">
                    <Bell size={20} className="text-indigo-600" /> Active Announcements
                </h3>

                {announcements.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-400">
                        No active announcements.
                    </div>
                ) : (
                    announcements.map(item => (
                        <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-200 transition-colors group relative">
                            {isAdmin && (
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}

                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-lg text-slate-800">{item.title}</h4>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${item.priority === 'Urgent' ? 'bg-red-100 text-red-600' :
                                    item.priority === 'High' ? 'bg-orange-100 text-orange-600' :
                                        'bg-blue-100 text-blue-600'
                                    }`}>
                                    {item.priority}
                                </span>
                            </div>

                            <p className="text-slate-600 mb-4 whitespace-pre-wrap">{item.message}</p>
                            
                            {item.attachment_url && (
                                <div className="mb-4">
                                    <a 
                                        href={`${api.defaults.baseURL.replace('/api', '')}${item.attachment_url}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-indigo-600 font-medium hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                                    >
                                        {(item.attachment_type || '').includes('pdf') ? <FileText size={16} /> : <ImageIcon size={16} />}
                                        View Attachment
                                    </a>
                                </div>
                            )}

                            <div className="flex items-center gap-4 text-xs text-slate-400 border-t border-slate-100 pt-3">
                                <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded">
                                    <Tag size={12} />
                                    {item.target_role === 'Class' && item.class_name ? (
                                        <>To Class: {item.class_name} {item.section_name && `(${item.section_name})`}</>
                                    ) : item.target_role === 'Subject' && item.subject_name ? (
                                        <>To: {item.subject_name} Teachers</>
                                    ) : item.target_role === 'Role' && item.staff_role ? (
                                        <>To: {item.staff_role}s</>
                                    ) : item.target_role === 'Student' ? (
                                        <>To: Students Only</>
                                    ) : item.target_role === 'Teacher' ? (
                                        <>To: Teachers Only</>
                                    ) : item.target_role === 'Staff' ? (
                                        <>To: Staff Only</>
                                    ) : (
                                        <>To: Everyone</>
                                    )}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock size={12} /> Posted: {new Date(item.created_at).toLocaleDateString('en-GB')}
                                </span>
                                {item.valid_until && (
                                    <span className="flex items-center gap-1 text-orange-400">
                                        Valid until: {new Date(item.valid_until).toLocaleDateString('en-GB')}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Announcements;
