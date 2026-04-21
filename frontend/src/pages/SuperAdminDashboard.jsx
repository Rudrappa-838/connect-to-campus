import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { Plus, School, LogOut, ChevronDown, Check, Trash2, X, Eye, Edit2, Search, Filter, Shield, Info, MapPin, Phone, Mail, Users, Power, RotateCcw, Home, Layers, Database, UserCheck, ScanLine } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import LogoutConfirmationModal from '../components/LogoutConfirmationModal';
import ClassManagement from '../components/dashboard/admin/ClassManagement';

// Predefined Options
const PREDEFINED_CLASSES = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
const PREDEFINED_SECTIONS = ['A', 'B', 'C', 'D', 'E'];
const PREDEFINED_SUBJECTS = ['Kannada', 'Mathematics', 'Science', 'English', 'Social Science', 'Hindi', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Computer Science', 'Physical Education'];

const SuperAdminDashboard = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const [schools, setSchools] = useState([]);
    const [deletedSchools, setDeletedSchools] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [viewSchool, setViewSchool] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editSchoolId, setEditSchoolId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('active'); // 'active' or 'deleted'
    const [manageClassesSchoolId, setManageClassesSchoolId] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        contactEmail: '',
        contactNumber: '',
        adminEmail: '',
        adminPassword: '',
        confirmAdminPassword: '',
        institutionType: 'SCHOOL',
        classes: []
    });

    // Temp Class Input State
    const [classInput, setClassInput] = useState({
        name: '',
        sections: [],
        subjects: []
    });

    const [customInputs, setCustomInputs] = useState({
        class: false,
        section: false,
        subject: false
    });

    // Controlled inputs for custom additions
    const [customSectionStr, setCustomSectionStr] = useState('');
    const [customSubjectStr, setCustomSubjectStr] = useState('');

    // Available Options State (Predefined + Custom added by user)
    const [customOptions, setCustomOptions] = useState({
        sections: [],
        subjects: []
    });



    const handleToggleService = async (school) => {
        const newStatus = !school.is_active;
        const action = newStatus ? 'Enable' : 'Disable';

        if (!window.confirm(`Are you sure you want to ${action} service for ${school.name}?`)) return;

        try {
            await api.put(`/schools/${school.id}/status`, { is_active: newStatus });
            toast.success(`Service ${newStatus ? 'Enabled' : 'Disabled'}`);
            fetchSchools(); // Refresh list
        } catch (error) {
            console.error(error);
            toast.error('Failed to update status');
        }
    };

    const handleToggleFeature = async (school, field, label) => {
        const currentStatus = school[field] !== false; // Default true if undefined, but our migration set FALSE.
        const newStatus = !currentStatus;
        try {
            await api.put(`/schools/${school.id}/features`, { [field]: newStatus });
            toast.success(`${label} ${newStatus ? 'Enabled' : 'Disabled'}`);
            fetchSchools();
        } catch (error) {
            console.error(error);
            toast.error(`Failed to update ${label}`);
        }
    };

    const classConfigRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = useRef(false);

    const fetchSchools = async () => {
        try {
            const res = await api.get('/schools');
            setSchools(res.data);
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || error.message;
            const detail = error.response?.data?.error || '';
            toast.error(`Failed to load schools: ${msg} ${detail ? `(${detail})` : ''}`);
        }
    };

    const fetchDeletedSchools = async () => {
        try {
            const res = await api.get('/schools/deleted/all');
            setDeletedSchools(res.data);
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || error.message;
            const detail = error.response?.data?.error || '';
            toast.error(`Failed to load deleted schools: ${msg} ${detail ? `(${detail})` : ''}`);
        }
    };

    useEffect(() => {
        fetchSchools();
        fetchDeletedSchools();
    }, []);

    const handleDeleteSchool = async (school) => {
        if (!window.confirm(`Are you sure you want to delete "${school.name}"? This will move it to the dustbin.`)) return;

        try {
            await api.delete(`/schools/${school.id}`);
            toast.success('School moved to dustbin');
            fetchSchools();
            fetchDeletedSchools();
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete school');
        }
    };

    const handleRestoreSchool = async (school) => {
        if (!window.confirm(`Are you sure you want to restore "${school.name}"?`)) return;

        try {
            await api.put(`/schools/${school.id}/restore`);
            toast.success('School restored successfully');
            fetchSchools();
            fetchDeletedSchools();
        } catch (error) {
            console.error(error);
            toast.error('Failed to restore school');
        }
    };

    const handlePermanentDeleteSchool = async (school) => {
        const confirmed = window.confirm(
            `⚠️ PERMANENT DELETE WARNING ⚠️\n\n` +
            `You are about to PERMANENTLY delete "${school.name}".\n\n` +
            `This will DELETE ALL DATA including:\n` +
            `• All students, teachers, and staff\n` +
            `• All attendance, marks, and fees records\n` +
            `• All classes, sections, and subjects\n` +
            `• All user accounts\n\n` +
            `THIS ACTION CANNOT BE UNDONE!\n\n` +
            `Are you absolutely sure?`
        );

        if (!confirmed) return;

        // Double confirmation
        const doubleConfirm = window.confirm(
            `FINAL CONFIRMATION\n\n` +
            `Type the school name to confirm: "${school.name}"\n\n` +
            `This is your last chance to cancel. Proceed with permanent deletion?`
        );

        if (!doubleConfirm) return;

        try {
            await api.delete(`/schools/${school.id}/permanent`);
            toast.success('School permanently deleted');
            fetchSchools();
            fetchDeletedSchools();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to permanently delete school');
        }
    };

    const handleViewDetails = async (id) => {
        console.log("handleViewDetails called with ID:", id);
        try {
            console.log("Fetching school details...");
            const res = await api.get(`/schools/${id}`);
            console.log("School details response:", res.data);
            setViewSchool(res.data);
            console.log("Set viewSchool state.");
        } catch (error) {
            console.error("Error fetching details:", error);
            toast.error(error.response?.data?.message || 'Failed to load details');
        }
    };

    const handleEditSchool = async (school) => {
        setIsEditing(true);
        setEditSchoolId(school.id);

        // Fetch full details including classes
        try {
            const res = await api.get(`/schools/${school.id}`);
            const fullSchool = res.data;

            // Transform backend structure to form structure
            const transformedClasses = (fullSchool.classes || []).map(cls => ({
                name: cls.class_name,
                sections: (cls.sections || []).map(s => s.name),
                subjects: (cls.subjects || []).map(s => s.name)
            }));

            // Collect all unique sections and subjects from the school data
            const allSections = new Set([...PREDEFINED_SECTIONS]);
            const allSubjects = new Set([...PREDEFINED_SUBJECTS]);

            (fullSchool.classes || []).forEach(cls => {
                (cls.sections || []).forEach(s => allSections.add(s.name));
                (cls.subjects || []).forEach(s => allSubjects.add(s.name));
            });

            // If there are separate lists of all available subjects/sections in the school object, use them too
            if (fullSchool.subjects && Array.isArray(fullSchool.subjects)) {
                fullSchool.subjects.forEach(s => allSubjects.add(s));
            }

            // Update custom options state so they appear in the buttons list
            setCustomOptions({
                sections: [...allSections].filter(x => !PREDEFINED_SECTIONS.includes(x)),
                subjects: [...allSubjects].filter(x => !PREDEFINED_SUBJECTS.includes(x))
            });

            // Force state update with new array reference
            setFormData(prev => ({
                ...prev,
                name: fullSchool.name,
                address: fullSchool.address || '',
                contactEmail: fullSchool.contact_email,
                contactNumber: fullSchool.contact_number || '',
                adminEmail: '',
                adminPassword: '',
                confirmAdminPassword: '',
                institutionType: fullSchool.institution_type || 'SCHOOL',
                classes: [...transformedClasses] // Use spread to ensure new array reference
            }));
            setShowModal(true);
        } catch (error) {
            console.error("Edit load error:", error);
            toast.error(error.response?.data?.message || "Failed to load school details for editing");
        }
    };

    const handleAddSchool = () => {
        setIsEditing(false);
        setEditSchoolId(null);
        setFormData({
            name: '', address: '', contactEmail: '', contactNumber: '',
            adminEmail: '', adminPassword: '', confirmAdminPassword: '', institutionType: 'SCHOOL', classes: []
        });
        setShowModal(true);
    };

    // Helper to persist the current class configuration to formData
    const updateClassConfig = (configToSave, showToast = true) => {
        if (!configToSave.name) return;

        const existingClassIndex = formData.classes.findIndex(c => c.name === configToSave.name);

        setFormData(prev => {
            const updatedClasses = [...prev.classes];

            if (existingClassIndex !== -1) {
                // Merge
                const existingClass = updatedClasses[existingClassIndex];
                // Use Set to strictly ensure uniqueness
                const mergedSections = [...new Set([...existingClass.sections, ...configToSave.sections])];
                const mergedSubjects = [...new Set([...existingClass.subjects, ...configToSave.subjects])];

                updatedClasses[existingClassIndex] = {
                    ...existingClass,
                    sections: mergedSections,
                    subjects: mergedSubjects
                };
                if (showToast) toast.success(`Updated configuration for ${configToSave.name}`);
            } else {
                // New
                updatedClasses.push({
                    name: configToSave.name,
                    sections: configToSave.sections,
                    subjects: configToSave.subjects
                });
                if (showToast) toast.success(`Added ${configToSave.name}`);
            }
            return { ...prev, classes: updatedClasses };
        });
    };

    const handleAddClass = () => {
        if (!classInput.name) return toast.error('Class Name is required');
        updateClassConfig(classInput);

        // Reset inputs
        setClassInput({ name: '', sections: [], subjects: [] });
        setCustomInputs({ class: false, section: false, subject: false });
        // We do NOT clear customOptions here anymore because the user might want to reuse them
        // But for UI cleanliness, maybe we should? The original code did. 
        // Let's keep it consistent:
        setCustomOptions({ sections: [], subjects: [] });
    };

    const removeClass = (index) => {
        const classToRemove = formData.classes[index];

        // In edit mode, show warning about student impact
        if (isEditing) {
            const confirmed = window.confirm(
                `⚠️ WARNING: Removing "${classToRemove.name}" will move all students in this class to the Unassigned bin.\n\nSchool Admin can later restore them by assigning a new class.\n\nAre you sure you want to proceed?`
            );
            if (!confirmed) return;
        }

        setFormData(prev => ({
            ...prev,
            classes: prev.classes.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prevent double submission
        if (isSubmittingRef.current) {
            console.log('[SUBMIT BLOCKED] Already submitting');
            return;
        }
        isSubmittingRef.current = true;
        setIsSubmitting(true);

        if (!isEditing && formData.adminPassword !== formData.confirmAdminPassword) {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            return toast.error("Passwords do not match!");
        }

        if (formData.contactNumber && formData.contactNumber.length !== 10) {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
            return toast.error("Contact Number must be exactly 10 digits!");
        }

        try {
            if (isEditing) {
                await api.put(`/schools/${editSchoolId}`, {
                    name: formData.name,
                    address: formData.address,
                    contactEmail: formData.contactEmail,
                    contactNumber: formData.contactNumber,
                    institution_type: formData.institutionType,
                    classes: formData.classes,
                    allowDeletions: true
                });
                toast.success('School updated successfully! ✏️');
            } else {
                const { confirmAdminPassword, institutionType, ...rest } = formData;
                const payload = { ...rest, institution_type: institutionType };

                console.log('[CREATE SCHOOL] Sending request...');
                await api.post('/schools', payload);
                console.log('[CREATE SCHOOL] Success!');
                toast.success('School created successfully! 🎉');
            }

            setShowModal(false);
            await fetchSchools(); // Refresh list
            setIsEditing(false);
            setEditSchoolId(null);
        } catch (error) {
            console.error('[SUBMIT ERROR]', error);
            console.error('[SUBMIT ERROR] Status:', error.response?.status);
            console.error('[SUBMIT ERROR] Data:', error.response?.data);
            console.error('[SUBMIT ERROR] Message:', error.message);

            // Check if the error is "email already exists" - school might have been created
            const errorMsg = error.response?.data?.message || 'Failed to save school';

            if (errorMsg.includes('already exists')) {
                // School might have been created despite the error
                toast.error('⚠️ ' + errorMsg + '. Refreshing list...');
                setShowModal(false);
                await fetchSchools(); // Refresh to show the school if it was created
                setIsEditing(false);
                setEditSchoolId(null);
            } else {
                toast.error(errorMsg);
            }
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const handleLogoutClick = () => {
        setShowLogoutModal(true);
    };

    const handleConfirmLogout = () => {
        logout();
        navigate('/');
    };

    // Toggle item in array (for multi-select)
    const toggleSelection = (field, value) => {
        setClassInput(prev => {
            const current = prev[field];
            if (current.includes(value)) {
                return { ...prev, [field]: current.filter(item => item !== value) };
            } else {
                return { ...prev, [field]: [...current, value] };
            }
        });
    };

    const currentSchools = (viewMode === 'active' ? schools : deletedSchools) || [];
    const filteredSchools = Array.isArray(currentSchools) ? currentSchools.filter(school =>
        (school.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (school.contact_email || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30 font-sans relative overflow-hidden">

            {/* Ambient Background Effects */}
            <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2 pointer-events-none"></div>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transform hover:rotate-12 transition-transform duration-300">
                            <Shield className="text-white w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">Super Admin</h1>
                            <p className="text-xs text-slate-400 font-medium">System Overview</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700/50">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-xs font-medium text-slate-300">System Healthy</span>
                        </div>
                        <div className="h-8 w-px bg-slate-800"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-semibold text-white">{user?.email}</p>
                                <p className="text-xs text-slate-400">Administrator</p>
                            </div>
                            <button
                                onClick={handleLogoutClick}
                                className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200"
                                title="Logout"
                            >
                                <LogOut size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-28 pb-12 px-6 max-w-7xl mx-auto relative z-10">

                {/* Dashboard Stats / Controls */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
                            {viewMode === 'active' ? 'Registered Schools' : 'Deleted Schools (Dustbin)'}
                        </h2>
                        <p className="text-slate-400">
                            {viewMode === 'active' ? 'Manage and monitor all school instances.' : 'Restore or permanently manage deleted schools.'}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        {/* View Mode Toggle */}
                        <div className="flex bg-slate-900 border border-slate-700 rounded-xl p-1">
                            <button
                                onClick={() => setViewMode('active')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'active'
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                <School size={16} className="inline mr-2" />
                                Active ({schools.length})
                            </button>
                            <button
                                onClick={() => setViewMode('deleted')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'deleted'
                                    ? 'bg-red-600 text-white shadow-lg shadow-red-500/25'
                                    : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                <Trash2 size={16} className="inline mr-2" />
                                Dustbin ({deletedSchools.length})
                            </button>
                        </div>

                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-400 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search schools..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''))}
                                autoComplete="off"
                                className="pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none w-full sm:w-64 transition-all"
                            />
                        </div>
                        {viewMode === 'active' && (
                            <div className="flex gap-2">

                                <button
                                    onClick={handleAddSchool}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:scale-95 font-semibold text-sm"
                                >
                                    <Plus size={18} /> Add New School
                                </button>
                            </div>
                        )}
                    </div>
                </div>



                {/* Grid */}
                {filteredSchools.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSchools.map(school => (
                            <div key={school.id} className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-500/30 transition-all duration-300 relative overflow-hidden">

                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/10 transition-colors"></div>

                                <div className="flex justify-between items-start mb-6 relative">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700 group-hover:border-indigo-500/30 transition-colors">
                                            <School className="text-indigo-400 w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">{school.name}</h3>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent card hover effect interference if any
                                                        handleToggleService(school);
                                                    }}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all ${school.is_active
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                        : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                                        }`}
                                                    title={school.is_active ? "Click to Disable Service" : "Click to Enable Service"}
                                                >
                                                    <Power size={10} className={school.is_active ? "text-emerald-500" : "text-red-500"} />
                                                    {school.is_active ? 'Service Online' : 'Service Offline'}
                                                </button>
                                                 <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleFeature(school, 'has_hostel', 'Hostel');
                                                    }}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all ${school.has_hostel !== false
                                                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
                                                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20'
                                                        }`}
                                                    title={school.has_hostel !== false ? "Disable Hostel" : "Enable Hostel"}
                                                >
                                                    <Home size={10} />
                                                    {school.has_hostel !== false ? 'Hostel ON' : 'Hostel OFF'}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleFeature(school, 'has_neet_exams', 'NEET Bank');
                                                    }}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all ${school.has_neet_exams
                                                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20'
                                                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20'
                                                        }`}
                                                    title={school.has_neet_exams ? "Disable NEET Bank" : "Enable NEET Bank"}
                                                >
                                                    <Database size={10} />
                                                    {school.has_neet_exams ? 'NEET ON' : 'NEET OFF'}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleFeature(school, 'has_face_enrollment', 'Face Enroll');
                                                    }}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all ${school.has_face_enrollment
                                                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
                                                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20'
                                                        }`}
                                                    title={school.has_face_enrollment ? "Disable Face Enrollment" : "Enable Face Enrollment"}
                                                >
                                                    <UserCheck size={10} />
                                                    {school.has_face_enrollment ? 'ENROLL ON' : 'ENROLL OFF'}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleFeature(school, 'has_face_scanner', 'Face Scanner');
                                                    }}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all ${school.has_face_scanner
                                                        ? 'bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20'
                                                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20'
                                                        }`}
                                                    title={school.has_face_scanner ? "Disable Face Scanner" : "Enable Face Scanner"}
                                                >
                                                    <ScanLine size={10} />
                                                    {school.has_face_scanner ? 'SCANNER ON' : 'SCANNER OFF'}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleFeature(school, 'has_biometric', 'Biometric');
                                                    }}
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border transition-all ${school.has_biometric
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20'
                                                        }`}
                                                    title={school.has_biometric ? "Disable Biometric Access" : "Enable Biometric Access"}
                                                >
                                                    <Shield size={10} />
                                                    {school.has_biometric ? 'BIOMETRIC ON' : 'BIOMETRIC OFF'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        {viewMode === 'active' ? (
                                            <>
                                                <button
                                                    onClick={() => handleEditSchool(school)}
                                                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleViewDetails(school.id)}
                                                    className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSchool(school)}
                                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Delete School"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setManageClassesSchoolId(school.id)}
                                                    className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
                                                    title="Manage Classes & Subjects"
                                                >
                                                    <Layers size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => handleRestoreSchool(school)}
                                                    className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                    title="Restore School"
                                                >
                                                    <RotateCcw size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleViewDetails(school.id)}
                                                    className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handlePermanentDeleteSchool(school)}
                                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Permanent Delete (Cannot be undone!)"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6 relative">
                                    <div className="flex items-center gap-3 text-sm text-slate-400">
                                        <Mail size={14} className="text-slate-500" />
                                        <span className="truncate">{school.contact_email}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-400">
                                        <Phone size={14} className="text-slate-500" />
                                        <span>{school.contact_number || "N/A"}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-400">
                                        <MapPin size={14} className="text-slate-500" />
                                        <span className="truncate">{school.address || "N/A"}</span>
                                    </div>
                                </div>

                                {/* Member Statistics */}
                                <div className="mb-6 relative">
                                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Software Users</h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-blue-400">{school.student_count || 0}</div>
                                                <div className="text-[10px] text-slate-500 uppercase font-semibold mt-1">Students</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-purple-400">{school.teacher_count || 0}</div>
                                                <div className="text-[10px] text-slate-500 uppercase font-semibold mt-1">Teachers</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-emerald-400">{school.staff_count || 0}</div>
                                                <div className="text-[10px] text-slate-500 uppercase font-semibold mt-1">Staff</div>
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-800">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-semibold text-slate-400">Total Members</span>
                                                <span className="text-lg font-bold text-indigo-300">{school.total_members || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-800 flex justify-between items-center relative">
                                    <span className="text-xs font-semibold text-slate-500">
                                        School ID: <span className="text-indigo-300 font-mono text-sm">{school.school_code || 'N/A'}</span>
                                    </span>
                                    <button
                                        onClick={() => handleViewDetails(school.id)}
                                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        View Dashboard <ChevronDown size={12} className="-rotate-90" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-slate-900/30 border border-dashed border-slate-800 rounded-3xl">
                        <div className="bg-slate-800/50 p-4 rounded-full mb-4">
                            <School className="w-12 h-12 text-slate-600" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No Schools Found</h3>
                        <p className="text-slate-400 max-w-sm text-center">
                            {searchTerm ? `No results for "${searchTerm}"` : "Get started by adding your first school to the system."}
                        </p>
                        {!searchTerm && (
                            <button onClick={handleAddSchool} className="mt-6 text-indigo-400 hover:text-indigo-300 font-semibold hover:underline">
                                Create a School Now
                            </button>
                        )}
                    </div>
                )}
            </main>

            {/* Modal Overlay */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

                        {/* Modal Header */}
                        <div className="px-8 py-6 border-b border-slate-800 bg-slate-900 sticky top-0 z-10 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">{isEditing ? 'Edit School' : 'New School Registration'}</h2>
                                <p className="text-sm text-slate-400">Configure institutional details and academic structure.</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">

                            <form id="schoolForm" onSubmit={handleSubmit} className="space-y-8">
                                {/* School Details Section */}
                                <section>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">1</div>
                                        <h3 className="text-lg font-bold text-white">{formData.institutionType === 'COLLEGE' ? 'College' : 'School'} Information</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="group">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{formData.institutionType === 'COLLEGE' ? 'College' : 'School'} Name</label>
                                            <input
                                                required
                                                placeholder="e.g. Springfield High"
                                                autoComplete="off"
                                                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="group">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Official Email</label>
                                            <input
                                                required
                                                type="email"
                                                placeholder="Enter admin email"
                                                autoComplete="off"
                                                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                                value={formData.contactEmail}
                                                onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                                            />
                                        </div>
                                        <div className="group">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Contact Number</label>
                                            <input
                                                required
                                                type="tel"
                                                maxLength={10}
                                                placeholder="10-digit number"
                                                autoComplete="off"
                                                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                                value={formData.contactNumber}
                                                onChange={e => setFormData({ ...formData, contactNumber: e.target.value.replace(/\D/g, '') })}
                                            />
                                        </div>
                                        <div className="group">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Address</label>
                                            <input
                                                required
                                                placeholder="Full street address"
                                                autoComplete="off"
                                                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                                value={formData.address}
                                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                            />
                                        </div>
                                        <div className="group col-span-1 md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Institution Type</label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, institutionType: 'SCHOOL' })}
                                                    className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${formData.institutionType === 'SCHOOL'
                                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                                                        }`}
                                                >
                                                    <School size={18} />
                                                    School
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, institutionType: 'COLLEGE' })}
                                                    className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${formData.institutionType === 'COLLEGE'
                                                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                                                        }`}
                                                >
                                                    <Layers size={18} />
                                                    College
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* Admin Credentials Section (New Only) */}
                                {!isEditing && (
                                    <section>
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-sm">2</div>
                                            <h3 className="text-lg font-bold text-white">System Administrator Setup</h3>
                                        </div>
                                        <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Admin Email</label>
                                                <input
                                                    required
                                                    type="email"
                                                    placeholder="Principal or Admin Email"
                                                    autoComplete="off"
                                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                                                    value={formData.adminEmail}
                                                    onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
                                                <input
                                                    required
                                                    type="password"
                                                    placeholder="••••••••"
                                                    autoComplete="off"
                                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                                                    value={formData.adminPassword}
                                                    onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Confirm Password</label>
                                                <input
                                                    required
                                                    type="password"
                                                    placeholder="••••••••"
                                                    autoComplete="off"
                                                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                                                    value={formData.confirmAdminPassword}
                                                    onChange={e => setFormData({ ...formData, confirmAdminPassword: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {/* Academic Configuration Section */}
                                <section>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">{isEditing ? '2' : '3'}</div>
                                        <h3 className="text-lg font-bold text-white">Academic Configuration</h3>
                                    </div>

                                    {isEditing && (
                                        <div className="mb-6 flex items-start gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                            <Info className="text-indigo-400 shrink-0 mt-0.5" size={18} />
                                            <p className="text-indigo-200 text-sm">
                                                You can <strong>add or remove</strong> classes, sections, and subjects. <strong className="text-amber-300">⚠️ Note:</strong> Removing a class/section will move affected students to the <strong>Unassigned bin</strong>, where School Admin can later restore them.
                                            </p>
                                        </div>
                                    )}

                                    <div ref={classConfigRef} className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 mb-6 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {/* Class Selector */}
                                            <div className="space-y-2">
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Class Name</label>
                                                {!customInputs.class ? (
                                                    <div className="relative">
                                                        <select
                                                            className="w-full appearance-none px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all cursor-pointer"
                                                            value={classInput.name}
                                                            onChange={(e) => {
                                                                if (e.target.value === 'custom') {
                                                                    setCustomInputs({ ...customInputs, class: true });
                                                                    setClassInput({ ...classInput, name: '' });
                                                                } else {
                                                                    setClassInput({ ...classInput, name: e.target.value });
                                                                }
                                                            }}
                                                        >
                                                            <option value="">Select a Class...</option>
                                                            {formData.classes.length > 0 && (
                                                                <optgroup label="Modify Existing">
                                                                    {formData.classes.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                                                </optgroup>
                                                            )}
                                                            <optgroup label="Add New Standard">
                                                                {PREDEFINED_CLASSES
                                                                    .filter(c => !formData.classes.some(fc => fc.name === c))
                                                                    .map(c => <option key={c} value={c}>{c}</option>)
                                                                }
                                                            </optgroup>
                                                            <option value="custom" className="font-bold text-emerald-400">+ Custom Class Name</option>
                                                        </select>
                                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
                                                        <input
                                                            autoFocus
                                                            placeholder="Enter Class Name"
                                                            autoComplete="off"
                                                            className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:border-emerald-500 outline-none"
                                                            value={classInput.name}
                                                            onChange={e => setClassInput({ ...classInput, name: e.target.value })}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    if (classInput.name.trim()) {
                                                                        updateClassConfig(classInput);
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (classInput.name.trim()) {
                                                                    updateClassConfig(classInput);
                                                                }
                                                            }}
                                                            className="px-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
                                                        >
                                                            Add
                                                        </button>
                                                        <button type="button" onClick={() => setCustomInputs({ ...customInputs, class: false })} className="px-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl">
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Section Selector */}
                                            <div className="space-y-2">
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Sections</label>
                                                <div className="flex flex-wrap gap-2 p-2 bg-slate-900 border border-slate-700 rounded-xl min-h-[50px]">
                                                    {[...PREDEFINED_SECTIONS, ...customOptions.sections].map(s => (
                                                        <button
                                                            key={s}
                                                            type="button"
                                                            onClick={() => toggleSelection('sections', s)}
                                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${classInput.sections.includes(s)
                                                                ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-500/10'
                                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                                                }`}
                                                        >
                                                            {s}
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => setCustomInputs({ ...customInputs, section: !customInputs.section })}
                                                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-dashed border-slate-600 text-slate-500 hover:text-slate-300 hover:border-slate-400 transition-colors"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                {customInputs.section && (
                                                    <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
                                                        <input
                                                            placeholder="Add Section (e.g. F)"
                                                            autoComplete="off"
                                                            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-indigo-500 outline-none"
                                                            value={customSectionStr}
                                                            onChange={(e) => setCustomSectionStr(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    if (customSectionStr.trim()) {
                                                                        const val = customSectionStr.trim();
                                                                        setCustomOptions(prev => ({ ...prev, sections: [...new Set([...prev.sections, val])] }));

                                                                        const newSections = [...new Set([...classInput.sections, val])];
                                                                        setClassInput(prev => ({ ...prev, sections: newSections }));

                                                                        // Auto-save if class name is present
                                                                        if (classInput.name) {
                                                                            updateClassConfig({ ...classInput, sections: newSections }, false);
                                                                        }

                                                                        setCustomSectionStr('');
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (customSectionStr.trim()) {
                                                                    const val = customSectionStr.trim();
                                                                    setCustomOptions(prev => ({ ...prev, sections: [...new Set([...prev.sections, val])] }));

                                                                    const newSections = [...new Set([...classInput.sections, val])];
                                                                    setClassInput(prev => ({ ...prev, sections: newSections }));

                                                                    // Auto-save if class name is present
                                                                    if (classInput.name) {
                                                                        updateClassConfig({ ...classInput, sections: newSections }, false);
                                                                    }

                                                                    setCustomSectionStr('');
                                                                }
                                                            }}
                                                            className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Subject Selector */}
                                            <div className="space-y-2">
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Subjects</label>
                                                <div className="flex flex-wrap gap-2 p-2 bg-slate-900 border border-slate-700 rounded-xl min-h-[50px] max-h-48 overflow-y-auto custom-scrollbar">
                                                    {[...PREDEFINED_SUBJECTS, ...customOptions.subjects].map(s => (
                                                        <button
                                                            key={s}
                                                            type="button"
                                                            onClick={() => toggleSelection('subjects', s)}
                                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${classInput.subjects.includes(s)
                                                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/10'
                                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                                                }`}
                                                        >
                                                            {s}
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => setCustomInputs({ ...customInputs, subject: !customInputs.subject })}
                                                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-dashed border-slate-600 text-slate-500 hover:text-slate-300 hover:border-slate-400 transition-colors"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                {customInputs.subject && (
                                                    <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
                                                        <input
                                                            placeholder="Add Subject"
                                                            autoComplete="off"
                                                            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:border-emerald-500 outline-none"
                                                            value={customSubjectStr}
                                                            onChange={(e) => setCustomSubjectStr(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    if (customSubjectStr.trim()) {
                                                                        const val = customSubjectStr.trim();
                                                                        setCustomOptions(prev => ({ ...prev, subjects: [...new Set([...prev.subjects, val])] }));

                                                                        const newSubjects = [...new Set([...classInput.subjects, val])];
                                                                        setClassInput(prev => ({ ...prev, subjects: newSubjects }));

                                                                        // Auto-save if class name is present
                                                                        if (classInput.name) {
                                                                            updateClassConfig({ ...classInput, subjects: newSubjects }, false);
                                                                        }

                                                                        setCustomSubjectStr('');
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (customSubjectStr.trim()) {
                                                                    const val = customSubjectStr.trim();
                                                                    setCustomOptions(prev => ({ ...prev, subjects: [...new Set([...prev.subjects, val])] }));

                                                                    const newSubjects = [...new Set([...classInput.subjects, val])];
                                                                    setClassInput(prev => ({ ...prev, subjects: newSubjects }));

                                                                    // Auto-save if class name is present
                                                                    if (classInput.name) {
                                                                        updateClassConfig({ ...classInput, subjects: newSubjects }, false);
                                                                    }

                                                                    setCustomSubjectStr('');
                                                                }
                                                            }}
                                                            className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors"
                                                        >
                                                            Add
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleAddClass}
                                            disabled={!classInput.name}
                                            className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${formData.classes.some(c => c.name === classInput.name)
                                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                                : classInput.name ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                                }`}
                                        >
                                            {formData.classes.some(c => c.name === classInput.name) ? (
                                                <> <Edit2 size={16} /> Update Configuration for {classInput.name} </>
                                            ) : (
                                                <> <Plus size={16} /> Add Configuration to List </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Configured Classes Preview */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase">Current Configuration</h4>
                                        {formData.classes.length > 0 ? (
                                            <div className="grid grid-cols-1 gap-3">
                                                {formData.classes.map((cls, idx) => (
                                                    <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 border border-slate-800 p-4 rounded-xl hover:border-slate-700 transition-colors">
                                                        <div className="mb-3 sm:mb-0">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-lg text-sm font-bold border border-indigo-500/20">{cls.name}</span>
                                                            </div>
                                                            <div className="space-y-1 text-xs text-slate-400">
                                                                <p><span className="font-semibold text-slate-500">SECTIONS:</span> {cls.sections.join(', ')}</p>
                                                                <p><span className="font-semibold text-slate-500">SUBJECTS:</span> {cls.subjects.join(', ')}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 self-end sm:self-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    // Load for editing
                                                                    setClassInput({
                                                                        name: cls.name,
                                                                        sections: cls.sections || [],
                                                                        subjects: cls.subjects || []
                                                                    });
                                                                    // If it's a custom class name, ensure dropdown is set to custom or handled
                                                                    if (!PREDEFINED_CLASSES.includes(cls.name)) {
                                                                        setCustomInputs(prev => ({ ...prev, class: true }));
                                                                    } else {
                                                                        setCustomInputs(prev => ({ ...prev, class: false }));
                                                                    }

                                                                    // Add custom items to selection if needed
                                                                    const missingSections = (cls.sections || []).filter(s => !PREDEFINED_SECTIONS.includes(s) && !customOptions.sections.includes(s));
                                                                    if (missingSections.length > 0) {
                                                                        setCustomOptions(prev => ({ ...prev, sections: [...prev.sections, ...missingSections] }));
                                                                    }

                                                                    const missingSubjects = (cls.subjects || []).filter(s => !PREDEFINED_SUBJECTS.includes(s) && !customOptions.subjects.includes(s));
                                                                    if (missingSubjects.length > 0) {
                                                                        setCustomOptions(prev => ({ ...prev, subjects: [...prev.subjects, ...missingSubjects] }));
                                                                    }

                                                                    // Scroll to the top of configuration section
                                                                    if (classConfigRef.current) {
                                                                        classConfigRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                        // Optional: focus the input if it's in custom mode, or just highlight the area
                                                                    }

                                                                    toast('Loaded configuration for editing', { icon: '📝' });
                                                                }}
                                                                className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            {!isEditing && (
                                                                <button type="button" onClick={() => removeClass(idx)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl text-slate-500 bg-slate-900/30">
                                                No classes configured yet. Add one above.
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-8 py-6 border-t border-slate-800 bg-slate-900 sticky bottom-0 z-10 flex justify-end gap-4">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2.5 text-slate-400 font-medium hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                form="schoolForm"
                                type="submit"
                                disabled={isSubmitting}
                                className={`px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]'}`}
                            >
                                {isSubmitting ? 'Processing...' : (isEditing ? 'Save Changes' : (formData.institutionType === 'COLLEGE' ? 'Create College' : 'Create School'))}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Details Modal */}
            {viewSchool && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-white">{viewSchool.name}</h2>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border border-slate-700 ${viewSchool.subscription_status === 'ACTIVE' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400'}`}>{viewSchool.subscription_status}</span>
                            </div>
                            <button onClick={() => setViewSchool(null)} className="text-slate-500 hover:text-white transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">{viewSchool.institution_type === 'COLLEGE' ? 'College' : 'School'} ID</p>
                                    <p className="text-indigo-300 font-mono text-lg font-bold">{viewSchool.school_code || 'N/A'}</p>
                                </div>
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Status</p>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${viewSchool.subscription_status === 'ACTIVE'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${viewSchool.subscription_status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                        {viewSchool.subscription_status}
                                    </span>
                                </div>
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Contact Email</p>
                                    <p className="text-slate-200 font-mono text-sm">{viewSchool.contact_email}</p>
                                </div>
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Phone</p>
                                    <p className="text-slate-200 font-mono text-sm">{viewSchool.contact_number || "N/A"}</p>
                                </div>
                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 col-span-2">
                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Location</p>
                                    <p className="text-slate-200">{viewSchool.address || "N/A"}</p>
                                </div>
                            </div>

                            {/* Member Statistics Section */}
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Users size={16} className="text-indigo-400" /> Software Users
                                </h3>
                                <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-blue-400">{viewSchool.student_count || 0}</div>
                                            <div className="text-xs text-slate-500 uppercase font-semibold mt-2">Students</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-purple-400">{viewSchool.teacher_count || 0}</div>
                                            <div className="text-xs text-slate-500 uppercase font-semibold mt-2">Teachers</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-emerald-400">{viewSchool.staff_count || 0}</div>
                                            <div className="text-xs text-slate-500 uppercase font-semibold mt-2">Staff</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-3xl font-bold text-indigo-400">{viewSchool.total_members || 0}</div>
                                            <div className="text-xs text-slate-500 uppercase font-semibold mt-2">Total</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <School size={16} className="text-indigo-400" /> Academic Structure
                                </h3>
                                <div className="space-y-3">
                                    {viewSchool.classes && viewSchool.classes.map(cls => (
                                        <div key={cls.class_id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/30 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-indigo-400">{cls.class_name}</h4>
                                                <span className="text-xs text-slate-600 bg-slate-900 px-2 py-1 rounded">ID: {cls.class_id}</span>
                                            </div>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-xs font-bold text-slate-500 w-16 px-1">SECTIONS</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {Array.isArray(cls.sections) && cls.sections.length > 0 ? cls.sections.map(s => (
                                                            <span key={s.id} className="px-1.5 py-0.5 bg-slate-900 text-slate-300 rounded text-xs border border-slate-800">{s.name}</span>
                                                        )) : <span className="text-slate-600 italic">None</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-xs font-bold text-slate-500 w-16 px-1">SUBJECTS</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {Array.isArray(cls.subjects) && cls.subjects.length > 0 ? cls.subjects.map(s => (
                                                            <span key={s.id} className="px-1.5 py-0.5 bg-slate-900 text-slate-300 rounded text-xs border border-slate-800">{s.name}</span>
                                                        )) : <span className="text-slate-600 italic">None</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!viewSchool.classes || viewSchool.classes.length === 0) && (
                                        <p className="text-slate-600 text-center py-4 italic">No academic configuration available.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #0f172a; 
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155; 
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #475569; 
                }
            `}</style>
            {/* Logout Confirmation Modal */}
            <LogoutConfirmationModal
                isOpen={showLogoutModal}
                onClose={() => setShowLogoutModal(false)}
                onConfirm={handleConfirmLogout}
            />
            {/* Manage Classes Modal */}
            {manageClassesSchoolId && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="px-8 py-6 border-b border-slate-200 bg-white sticky top-0 z-10 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 mb-1">Manage Classes</h2>
                                <p className="text-sm text-slate-500">Configure classes, sections, and subjects for this school.</p>
                            </div>
                            <button onClick={() => setManageClassesSchoolId(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                            <ClassManagement schoolId={manageClassesSchoolId} />
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SuperAdminDashboard;
