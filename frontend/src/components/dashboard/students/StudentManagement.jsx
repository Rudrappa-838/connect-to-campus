import React, { useState, useEffect } from 'react';
import { Filter, Plus, SortAsc, Edit2, Trash2, X, Printer, GraduationCap, Check, FileDown, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import StudentPromotionModal from './StudentPromotionModal';

const StudentManagement = ({ config, prefillData, isPromotionView, defaultViewMode = 'active' }) => {
    const [students, setStudents] = useState([]);
    const [filterClass, setFilterClass] = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [searchQuery, setSearchQuery] = useState(''); // Added Search State
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
    const [viewMode, setViewMode] = useState(defaultViewMode); // 'active' | 'bin'

    // Promotion States
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [showPromotionModal, setShowPromotionModal] = useState(false);

    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Clear selection when filters change
    useEffect(() => {
        setSelectedStudents([]);
    }, [filterClass, filterSection]);

    const [formData, setFormData] = useState({
        admission_no: '',
        first_name: '',
        middle_name: '',
        last_name: '',
        gender: '',
        dob: '',
        age: '',
        class_id: '',
        section_id: '',
        father_name: '',
        mother_name: '',
        contact_number: '',
        email: '',
        address: '',
        attendance_id: '',
        admission_date: new Date().toISOString().split('T')[0]
    });

    // Check for prefill data (from Admissions CRM)
    useEffect(() => {
        if (prefillData && prefillData.action === 'add_student' && prefillData.data) {
            const data = prefillData.data;

            // Find Class ID from Name
            const foundClass = config.classes?.find(c => c.class_name === data.class_name); // Note: Assuming exact name match
            const classId = foundClass ? foundClass.class_id : '';

            // Split name if present
            const nameParts = (data.student_name || data.first_name || '').split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
            const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

            setFormData(prev => ({
                ...prev,
                first_name: firstName,
                middle_name: middleName,
                last_name: lastName,
                father_name: data.guardian_name || '',
                contact_number: data.guardian_phone || '',
                email: data.email || '',
                class_id: classId,
                attendance_id: Math.floor(100000 + Math.random() * 900000).toString(),
            }));

            // Auto open modal
            setIsEditing(false);
            setShowModal(true);
        }
    }, [prefillData, config.classes]);

    // Derived sections based on selected class
    // Sort classes numerically if they follow "Class X" pattern, otherwise keep original
    const sortedClasses = React.useMemo(() => {
        return [...(config.classes || [])].sort((a, b) => {
            const numA = parseInt(a.class_name.replace(/\D/g, '') || '0', 10);
            const numB = parseInt(b.class_name.replace(/\D/g, '') || '0', 10);
            return numA === numB ? a.class_name.localeCompare(b.class_name) : numA - numB;
        });
    }, [config.classes]);

    const availableSections = sortedClasses.find(c => c.class_id === parseInt(filterClass))?.sections || [];
    const formSections = config.classes?.find(c => c.class_id === parseInt(formData.class_id))?.sections || [];

    // Auto-select filter section
    useEffect(() => {
        if (filterClass && availableSections.length > 0 && !isPromotionView) {
            setFilterSection(availableSections[0].id);
        } else {
            setFilterSection('');
        }
    }, [filterClass, isPromotionView]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setPage(1); // Reset to page 1 on search/filter
            fetchStudents(1);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [filterClass, filterSection, searchQuery, viewMode]);

    useEffect(() => {
        if (page > 1) fetchStudents(page);
    }, [page]);

    // Auto-calculate Age
    useEffect(() => {
        if (formData.dob) {
            const birthDate = new Date(formData.dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            setFormData(prev => ({ ...prev, age: age >= 0 ? age : 0 }));
        }
    }, [formData.dob]);

    const fetchStudents = async (targetPage = page) => {
        // In Promotion View, enforce Class selection first (Section is optional)
        if (isPromotionView && !filterClass) {
            setStudents([]);
            setPagination({ total: 0, totalPages: 1 });
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            if (viewMode === 'bin') {
                const res = await api.get('/students/bin');
                setStudents(res.data || []);
                setPagination({ total: res.data?.length || 0, totalPages: 1 }); // Bin has no server pagination yet
            } else {
                const params = {
                    page: targetPage,
                    limit: 50,
                    search: searchQuery
                };
                if (filterClass) params.class_id = filterClass;
                if (filterSection) params.section_id = filterSection;

                const res = await api.get('/students', { params });
                setStudents(res.data.data || []);
                setPagination(res.data.pagination || { total: 0, totalPages: 1 });
            }
        } catch (error) {
            console.error('Fetch error:', error);
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (isSubmitting) return;
        if (!window.confirm('Are you sure you want to move this student to the Recycle Bin?')) return;

        setIsSubmitting(true);
        try {
            await api.delete(`/students/${id}`);
            toast.success('Student moved to bin');
            fetchStudents();
        } catch (error) {
            console.error('Delete error:', error);
            const errorMsg = error.response?.data?.message || error.message || 'Failed to delete student';
            toast.error(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRestore = async (id) => {
        if (isSubmitting) return;
        if (!window.confirm('Are you sure you want to restore this student?')) return;

        setIsSubmitting(true);
        try {
            await api.put(`/students/${id}/restore`);
            toast.success('Student restored successfully');
            fetchStudents();
        } catch (error) {
            toast.error('Failed to restore student');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePermanentDelete = async (id) => {
        if (isSubmitting) return;
        if (!window.confirm('WARNING: This action is irreversible. Are you sure you want to PERMANENTLY delete this student?')) return;

        setIsSubmitting(true);
        try {
            await api.delete(`/students/${id}/permanent`);
            toast.success('Student permanently deleted');
            fetchStudents();
        } catch (error) {
            console.error('Permanent delete error:', error);
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to delete student permanently';
            const errorDetail = error.response?.data?.detail || '';
            const errorConstraint = error.response?.data?.constraint || '';

            toast.error(`${errorMsg}${errorDetail ? '\n' + errorDetail : ''}${errorConstraint && errorConstraint !== 'Unknown' ? '\nConstraint: ' + errorConstraint : ''}`, {
                duration: 6000
            });

            // Also log to console for debugging
            console.log('Error details:', error.response?.data);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkDelete = async () => {
        if (isSubmitting) return;
        if (!window.confirm(`Are you sure you want to move ${selectedStudents.length} students to the Recycle Bin?`)) return;

        setIsSubmitting(true);
        try {
            await Promise.all(selectedStudents.map(s => api.delete(`/students/${s.id}`)));
            toast.success('Students moved to bin');
            setSelectedStudents([]);
            fetchStudents();
        } catch (error) {
            console.error('Bulk delete error', error);
            toast.error('Failed to delete some students');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkRestore = async () => {
        if (isSubmitting) return;
        if (!window.confirm(`Are you sure you want to restore ${selectedStudents.length} students?`)) return;

        setIsSubmitting(true);
        try {
            await Promise.all(selectedStudents.map(s => api.put(`/students/${s.id}/restore`)));
            toast.success('Students restored successfully');
            setSelectedStudents([]);
            fetchStudents();
        } catch (error) {
            toast.error('Failed to restore students');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkPermanentDelete = async () => {
        if (isSubmitting) return;
        if (!window.confirm(`WARNING: IRREVERSIBLE ACTION.\nAre you sure you want to PERMANENTLY delete ${selectedStudents.length} students?`)) return;

        setIsSubmitting(true);
        try {
            await Promise.all(selectedStudents.map(s => api.delete(`/students/${s.id}/permanent`)));
            toast.success('Students permanently deleted');
            setSelectedStudents([]);
            fetchStudents();
        } catch (error) {
            toast.error('Failed to delete students permanently');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (student) => {
        setIsEditing(true);
        setSelectedStudent(student);

        // Split Name logic
        const nameParts = (student.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

        setFormData({
            admission_no: student.admission_no || '',
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            gender: student.gender || '',
            dob: student.dob ? student.dob.split('T')[0] : '',
            age: student.age || '',
            class_id: student.class_id,
            section_id: student.section_id,
            father_name: student.father_name || '',
            mother_name: student.mother_name || '',
            contact_number: student.contact_number || '',
            email: student.email || '',
            address: student.address || '',
            attendance_id: student.attendance_id || '',
            admission_date: student.admission_date ? student.admission_date.split('T')[0] : ''
        });
        setShowModal(true);
    };

    const handleAdd = () => {
        setIsEditing(false);
        setSelectedStudent(null);
        // Generate random 6 digit Attendance ID
        const autoAttendanceId = Math.floor(100000 + Math.random() * 900000).toString();

        setFormData({
            admission_no: '',
            first_name: '',
            middle_name: '',
            last_name: '',
            gender: '',
            dob: '',
            age: '',
            class_id: filterClass || '',
            section_id: filterSection || '',
            father_name: '',
            mother_name: '',
            contact_number: '',
            email: '',
            address: '',
            attendance_id: autoAttendanceId, // Auto preset
            admission_date: new Date().toISOString().split('T')[0]
        });
        setShowModal(true);
    };

    const handlePrint = () => {
        const className = config.classes?.find(c => c.class_id === parseInt(filterClass))?.class_name || 'All Classes';
        const sectionName = config.classes?.find(c => c.class_id === parseInt(filterClass))?.sections?.find(s => s.id === parseInt(filterSection))?.name || 'All Sections';

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Student List - ${className} ${sectionName !== 'All Sections' ? '- ' + sectionName : ''}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 20px; 
                        background: white;
                    }
                    h1 { 
                        text-align: center; 
                        color: #333; 
                        font-size: 24px; 
                        margin-bottom: 5px; 
                    }
                    h2 { 
                        text-align: center; 
                        color: #666; 
                        font-size: 18px; 
                        margin-top: 0; 
                        margin-bottom: 20px; 
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-top: 20px; 
                    }
                    th, td { 
                        border: 1px solid #ddd; 
                        padding: 12px; 
                        text-align: left; 
                    }
                    th { 
                        background-color: #4f46e5; 
                        color: white; 
                        font-weight: bold; 
                    }
                    tr:nth-child(even) { 
                        background-color: #f9f9f9; 
                    }
                    .footer { 
                        text-align: center; 
                        margin-top: 30px; 
                        font-size: 12px; 
                        color: #666; 
                    }
                    @media print {
                        body { padding: 10px; }
                        @page { margin: 1cm; }
                    }
                </style>
            </head>
            <body>
                <h1>Student List</h1>
                <h2>${className}${sectionName !== 'All Sections' ? ' - ' + sectionName : ''}</h2>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 20%;">Roll No.</th>
                            <th style="width: 80%;">Student Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(student => `
                            <tr>
                                <td>${student.roll_number || '-'}</td>
                                <td>${student.name}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    <p>Printed on: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    const isSubmittingRef = React.useRef(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prevent double submit immediate check
        if (isSubmitting || isSubmittingRef.current) return;

        if (formData.contact_number && !/^\d{10}$/.test(formData.contact_number)) {
            return toast.error('Mobile number must be 10 digits');
        }

        // Email Validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (formData.email && !emailRegex.test(formData.email)) {
            return toast.error('Please enter a valid email address');
        }

        // Combine Names
        const finalName = [formData.first_name, formData.middle_name, formData.last_name]
            .filter(Boolean)
            .join(' ')
            .trim();

        if (!finalName) {
            return toast.error('First Name and Last Name are required');
        }

        setIsSubmitting(true);
        isSubmittingRef.current = true;
        const payload = { ...formData, name: finalName };

        try {
            if (isEditing) {
                await api.put(`/students/${selectedStudent.id}`, payload);
                toast.success('Student updated');
            } else {
                await api.post('/students', payload);
                toast.success('Student added successfully');
            }
            setShowModal(false);
            fetchStudents();
        } catch (error) {
            console.error('Save student error:', error);
            console.error('Error response:', error.response);
            toast.error(error.response?.data?.message || 'Failed to save student');
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Filters */}
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col gap-4">
                    {/* View Toggle */}
                    {/* View Toggle Removed as per request */}

                    {(viewMode === 'active' || isPromotionView) && (
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                                <Filter size={18} className="text-slate-400" />
                                <select
                                    className="bg-transparent text-sm outline-none text-slate-700 font-bold min-w-[140px] cursor-pointer"
                                    value={filterClass}
                                    onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}
                                >
                                    <option value="">All Classes</option>
                                    {sortedClasses.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                                </select>
                            </div>
                            {filterClass && availableSections.length > 0 && (
                                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors animate-in fade-in slide-in-from-left-2">
                                    <span className="text-slate-300 font-light">/</span>
                                    <select
                                        className="bg-transparent text-sm outline-none text-slate-700 font-bold min-w-[120px] cursor-pointer"
                                        value={filterSection}
                                        onChange={e => setFilterSection(e.target.value)}
                                    >
                                        <option value="">All Sections</option>
                                        {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap gap-3 items-center justify-end w-full md:w-auto">
                    {!isPromotionView && viewMode === 'active' && (
                        <>
                            <input
                                type="search"
                                placeholder="Search Name/ID..."
                                autoComplete="off"
                                className="bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-indigo-400 w-40 md:w-56 transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9 ]/g, '').replace(/^\s+/, ''))}
                            />
                            <button
                                onClick={handlePrint}
                                disabled={students.length === 0 || selectedStudents.length > 0}
                                className={`bg-slate-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-500/20 hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${selectedStudents.length > 0 ? 'opacity-30 blur-[1px]' : ''}`}
                            >
                                <Printer size={20} /> Print List
                            </button>
                        </>
                    )}
                    {selectedStudents.length > 0 && viewMode === 'active' && (
                        <button
                            onClick={handleBulkDelete}
                            disabled={isSubmitting}
                            className={`bg-rose-100 text-rose-700 px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-rose-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 animate-in fade-in slide-in-from-left-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Trash2 size={20} /> Delete ({selectedStudents.length})
                        </button>
                    )}
                    {selectedStudents.length > 0 && viewMode === 'bin' && (
                        <>
                            <button
                                onClick={handleBulkRestore}
                                disabled={isSubmitting}
                                className={`bg-emerald-100 text-emerald-700 px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 animate-in fade-in slide-in-from-left-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Check size={20} /> Restore ({selectedStudents.length})
                            </button>
                            <button
                                onClick={handleBulkPermanentDelete}
                                disabled={isSubmitting}
                                className={`bg-red-100 text-red-700 px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-red-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 animate-in fade-in slide-in-from-left-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <X size={20} /> Delete Forever ({selectedStudents.length})
                            </button>
                        </>
                    )}
                    {(selectedStudents.length > 0 || isPromotionView) && (
                        <button
                            onClick={() => setShowPromotionModal(true)}
                            disabled={selectedStudents.length === 0}
                            className={`bg-purple-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-purple-500/20 hover:bg-purple-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 animate-in fade-in slide-in-from-left-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            <GraduationCap size={20} /> Promote ({selectedStudents.length})
                        </button>
                    )}
                    {!isPromotionView && viewMode === 'active' && (
                        <button
                            onClick={handleAdd}
                            disabled={selectedStudents.length > 0}
                            className={`bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 ${selectedStudents.length > 0 ? 'opacity-30 blur-[1px] pointer-events-none' : ''}`}
                        >
                            <Plus size={20} /> Add Student
                        </button>
                    )}
                </div>
            </div>

            {!isPromotionView && filterClass && (
                <div className="flex justify-end px-2 gap-3">
                    <button
                        onClick={async () => {
                            if (isSubmitting) return;
                            const sectionText = filterSection ? 'the selected section' : 'this class';
                            if (!window.confirm(`This will reassign roll numbers alphabetically (by student name) for ${sectionText}. Students with the same name will keep their current roll number order. Continue?`)) return;
                            setIsSubmitting(true);
                            try {
                                await api.post('/students/roll-numbers', { class_id: filterClass, section_id: filterSection || null });
                                toast.success('Roll numbers updated');
                                fetchStudents();
                            } catch (error) {
                                toast.error('Failed to update roll numbers');
                            } finally {
                                setIsSubmitting(false);
                            }
                        }}
                        disabled={isSubmitting}
                        className={`text-indigo-600 text-xs font-bold hover:underline mb-2 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <SortAsc size={14} /> Re-assign Roll Numbers Alphabetically
                    </button>
                </div>
            )}

            {/* Bulk Actions Bar */}
            {!isPromotionView && viewMode === 'active' && (
                <div className="flex justify-end px-2 gap-3 mb-2">
                    <button
                        onClick={() => {
                            import('xlsx').then(xlsx => {
                                const headers = [
                                    ['First Name', 'Middle Name', 'Last Name', 'Gender', 'Date of Birth', 'Class', 'Section', 'Father\'s Name', 'Mother\'s Name', 'Mobile Number', 'Email Address', 'Address']
                                ];
                                const data = [
                                    ['John', 'D', 'Doe', 'Male', '2010-05-15', 'Class 10', 'A', 'Richard Doe', 'Jane Doe', '9876543210', 'student@example.com', '123 Main St']
                                ];
                                const ws = xlsx.utils.aoa_to_sheet([...headers, ...data]);

                                // Auto-width columns
                                const wscols = headers[0].map(() => ({ wch: 15 }));
                                ws['!cols'] = wscols;

                                const wb = xlsx.utils.book_new();
                                xlsx.utils.book_append_sheet(wb, ws, "Template");
                                xlsx.writeFile(wb, "school_student_upload_template.xlsx");
                            });
                        }}
                        className="text-emerald-600 text-xs font-bold hover:underline flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors"
                    >
                        <FileDown size={14} /> Download Template
                    </button>

                    <label className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">
                        <UploadCloud size={14} /> Upload Students (Excel)
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;

                                const formData = new FormData();
                                formData.append('file', file);

                                const toastId = toast.loading('Uploading students...');
                                setIsSubmitting(true);
                                try {
                                    const res = await api.post('/students/bulk-upload', formData, {
                                        headers: { 'Content-Type': 'multipart/form-data' }
                                    });
                                    toast.success(`Upload Complete! Success: ${res.data.summary.success}, Failed: ${res.data.summary.failed}`, { id: toastId, duration: 5000 });
                                    if (res.data.errors.length > 0) {
                                        console.warn("Upload Errors:", res.data.errors);
                                        alert("Some rows failed. Check console for details.\nFirst Error: " + res.data.errors[0].error);
                                    }
                                    fetchStudents();
                                } catch (err) {
                                    console.error(err);
                                    toast.error(err.response?.data?.message || 'Upload failed', { id: toastId });
                                } finally {
                                    setIsSubmitting(false);
                                    e.target.value = ''; // Reset
                                }
                            }}
                        />
                    </label>
                </div>
            )}

            {/* Student List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                            <tr>
                                <th className="p-4 pl-6 w-12">
                                    {filterClass && (
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            checked={selectedStudents.length === students.length && students.length > 0}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedStudents(students);
                                                } else {
                                                    setSelectedStudents([]);
                                                }
                                            }}
                                            title="Select all students in this class"
                                        />
                                    )}
                                </th>
                                <th className="p-4">Roll No.</th>
                                {!isPromotionView && <th className="p-4">Admission Date</th>}
                                <th className="p-4">Name & ID</th>
                                <th className="p-4">Class</th>
                                {!isPromotionView && <th className="p-4">Demographics</th>}
                                {!isPromotionView && <th className="p-4">Parents / Contact</th>}
                                {!isPromotionView && <th className="p-4 text-right pr-6">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="p-4 pl-6"><div className="h-8 w-8 bg-slate-200 rounded-lg"></div></td>
                                        <td className="p-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                                        <td className="p-4">
                                            <div className="space-y-2">
                                                <div className="h-4 w-32 bg-slate-200 rounded"></div>
                                                <div className="h-3 w-16 bg-slate-200 rounded"></div>
                                            </div>
                                        </td>
                                        <td className="p-4"><div className="h-6 w-20 bg-slate-200 rounded"></div></td>
                                        <td className="p-4">
                                            <div className="space-y-2">
                                                <div className="h-3 w-12 bg-slate-200 rounded"></div>
                                                <div className="h-3 w-16 bg-slate-200 rounded"></div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="space-y-1">
                                                <div className="h-3 w-24 bg-slate-200 rounded"></div>
                                                <div className="h-3 w-20 bg-slate-200 rounded"></div>
                                                <div className="h-3 w-24 bg-slate-200 rounded"></div>
                                            </div>
                                        </td>
                                        <td className="p-4"><div className="h-8 w-8 bg-slate-200 rounded ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : (
                                <>
                                    {students.map(student => (
                                        <tr key={student.id} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 pl-6">
                                                {filterClass && (
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        checked={selectedStudents.some(s => s.id === student.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedStudents([...selectedStudents, student]);
                                                            } else {
                                                                setSelectedStudents(selectedStudents.filter(s => s.id !== student.id));
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold font-mono text-xs border border-slate-200">
                                                    {student.roll_number || '-'}
                                                </div>
                                            </td>
                                            {!isPromotionView && (
                                                <td className="p-4 font-mono text-slate-500 text-xs">
                                                    {student.admission_date ? new Date(student.admission_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : (student.created_at ? new Date(student.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '-')}
                                                </td>
                                            )}
                                            <td className="p-4">
                                                <div className="font-bold text-slate-700">{student.name}</div>
                                                <div className="text-[10px] text-indigo-500 font-mono font-medium bg-indigo-50 inline-block px-1.5 py-0.5 rounded mt-0.5 border border-indigo-100">ID: {student.admission_no}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-white text-slate-600 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 shadow-sm">
                                                    {student.class_name}{student.section_name ? ` - ${student.section_name}` : ''}
                                                </span>
                                            </td>
                                            {!isPromotionView && (
                                                <td className="p-4">
                                                    <div className="text-slate-600 text-xs font-medium">{student.gender}</div>
                                                    <div className="text-slate-400 text-[10px]">{student.age} Years Old</div>
                                                </td>
                                            )}
                                            {!isPromotionView && (
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs font-bold text-slate-700">{student.father_name}</span>
                                                        <span className="text-[10px] text-slate-400">{student.mother_name}</span>
                                                        <span className="text-xs text-indigo-600 font-medium">{student.contact_number}</span>
                                                    </div>
                                                </td>
                                            )}
                                            {!isPromotionView && (
                                                <td className="p-4 pr-6 text-right">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {viewMode === 'active' ? (
                                                            <>
                                                                {!isPromotionView && (
                                                                    <button onClick={() => handleEdit(student)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit"><Edit2 size={18} /></button>
                                                                )}
                                                                <button onClick={() => handleDelete(student.id)} disabled={isSubmitting} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Move to Bin"><Trash2 size={18} /></button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => handleRestore(student.id)} disabled={isSubmitting} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors font-bold text-xs flex items-center gap-1 border border-emerald-200 bg-emerald-50/50 disabled:opacity-50 disabled:cursor-not-allowed" title="Restore">
                                                                    Restore
                                                                </button>
                                                                <button onClick={() => handlePermanentDelete(student.id)} disabled={isSubmitting} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-xs font-bold border border-rose-200 bg-rose-50/50 disabled:opacity-50 disabled:cursor-not-allowed" title="Delete Permanently">
                                                                    Permanently Delete
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {students.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="p-12 text-center text-slate-400">
                                                <div className="flex flex-col items-center justify-center">
                                                    {isPromotionView && !filterClass ? (
                                                        <>
                                                            <div className="bg-indigo-50 p-4 rounded-full mb-3">
                                                                <Filter size={24} className="text-indigo-500" />
                                                            </div>
                                                            <p className="font-bold text-slate-700 mb-1">Select Class</p>
                                                            <p className="text-xs text-slate-500">Please select a class to view students for promotion.</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="font-medium text-slate-500 mb-1">No students found</p>
                                                            <p className="text-xs">Try changing filters or add a new student.</p>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Footer */}
                {pagination.totalPages > 1 && (
                    <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                            Showing <span className="font-bold text-slate-700">{students.length}</span> of <span className="font-bold text-slate-700">{pagination.total}</span> students
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-100 transition-colors"
                            >
                                Previous
                            </button>
                            <div className="flex items-center gap-1">
                                {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                                    const pageNum = i + 1; // Basic logic, could be improved with sliding window
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setPage(pageNum)}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${page === pageNum ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                disabled={page === pagination.totalPages}
                                onClick={() => setPage(prev => Math.min(pagination.totalPages, prev + 1))}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-100 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl sticky top-0 z-10">
                            <h2 className="text-lg font-bold text-gray-800">{isEditing ? 'Edit Student' : 'Add New Student'}</h2>
                            <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <form onSubmit={handleSubmit} autoComplete="off" className="p-6 grid grid-cols-2 gap-4 overflow-y-auto">

                            {/* Personal Details */}
                            <div className="col-span-2">
                                <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Personal Details</h3>
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="col-span-1">
                                        <label className="label">Admission No (Student ID)</label>
                                        <input
                                            className="input"
                                            id="student-id"
                                            name="admission_no"
                                            placeholder="Auto if empty"
                                            autoComplete="off"
                                            value={formData.admission_no || ''}
                                            onChange={e => setFormData({ ...formData, admission_no: e.target.value.toUpperCase() })}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[11px] text-slate-400 mt-6 italic">* Student ID will be automatically generated if left empty.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Name Fields Split */}
                            <div className="col-span-2 grid grid-cols-3 gap-3">
                                <div className="col-span-1">
                                    <label className="label">First Name <span className="text-red-500">*</span></label>
                                    <input
                                        className="input"
                                        required
                                        id="student-first-name"
                                        name="first_name"
                                        placeholder="First Name"
                                        pattern="[A-Za-z]+"
                                        title="Only letters allowed"
                                        autoComplete="off"
                                        value={formData.first_name || ''}
                                        onCopy={e => e.preventDefault()}
                                        onPaste={e => e.preventDefault()}
                                        onChange={e => {
                                            if (/^[A-Za-z]*$/.test(e.target.value)) {
                                                setFormData({ ...formData, first_name: e.target.value });
                                            }
                                        }}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="label">Middle Name</label>
                                    <input
                                        className="input"
                                        id="student-middle-name"
                                        name="middle_name"
                                        placeholder="Middle Name"
                                        pattern="[A-Za-z]*"
                                        title="Only letters allowed"
                                        autoComplete="off"
                                        value={formData.middle_name || ''}
                                        onCopy={e => e.preventDefault()}
                                        onPaste={e => e.preventDefault()}
                                        onChange={e => {
                                            if (/^[A-Za-z]*$/.test(e.target.value)) {
                                                setFormData({ ...formData, middle_name: e.target.value });
                                            }
                                        }}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="label">Last Name <span className="text-red-500">*</span></label>
                                    <input
                                        className="input"
                                        required
                                        id="student-last-name"
                                        name="last_name"
                                        placeholder="Last Name"
                                        pattern="[A-Za-z]+"
                                        title="Only letters allowed"
                                        autoComplete="off"
                                        value={formData.last_name || ''}
                                        onCopy={e => e.preventDefault()}
                                        onPaste={e => e.preventDefault()}
                                        onChange={e => {
                                            if (/^[A-Za-z]*$/.test(e.target.value)) {
                                                setFormData({ ...formData, last_name: e.target.value });
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="col-span-1">
                                <label className="label">Gender <span className="text-red-500">*</span></label>
                                <select className="input" id="student-gender" name="gender" required value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="label">Date of Birth <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    className="input"
                                    required
                                    autoComplete="off"
                                    max={new Date().toISOString().split('T')[0]}
                                    value={formData.dob}
                                    onChange={e => setFormData({ ...formData, dob: e.target.value })}
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="label">Age</label>
                                <input className="input bg-gray-50" readOnly autoComplete="off" value={formData.age} placeholder="Auto-calculated" />
                            </div>
                            <div className="col-span-1">
                                <label className="label">Admission Date <span className="text-red-500">*</span></label>
                                <input type="date" className="input" required autoComplete="off" value={formData.admission_date} onChange={e => setFormData({ ...formData, admission_date: e.target.value })} />
                            </div>

                            {/* Academic Details */}
                            <div className="col-span-2 mt-2">
                                <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Academic Details</h3>
                            </div>
                            <div className="col-span-1">
                                <label className="label">Class <span className="text-red-500">*</span></label>
                                <select className="input" required value={formData.class_id} onChange={e => setFormData({ ...formData, class_id: e.target.value, section_id: '' })}>
                                    <option value="">Select Class</option>
                                    {sortedClasses.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                                </select>
                            </div>
                            {formSections.length > 0 && (
                                <div className="col-span-1">
                                    <label className="label">Section <span className="text-red-500">*</span></label>
                                    <select
                                        className="input disabled:bg-gray-100 disabled:text-gray-400"
                                        required
                                        value={formData.section_id}
                                        onChange={e => setFormData({ ...formData, section_id: e.target.value })}
                                        disabled={formSections.length === 0}
                                    >
                                        <option value="">Select Section</option>
                                        {formSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Guardian & Contact */}
                            <div className="col-span-2 mt-2">
                                <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Guardian & Contact</h3>
                            </div>
                            <div className="col-span-1">
                                <label className="label">Father's Name <span className="text-red-500">*</span></label>
                                <input
                                    className="input"
                                    required
                                    pattern="[A-Za-z\s]+"
                                    title="Only letters and spaces allowed"
                                    autoComplete="off"
                                    value={formData.father_name}
                                    onCopy={e => e.preventDefault()}
                                    onPaste={e => e.preventDefault()}
                                    onChange={e => {
                                        if (/^[A-Za-z\s]*$/.test(e.target.value)) {
                                            setFormData({ ...formData, father_name: e.target.value });
                                        }
                                    }}
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="label">Mother's Name <span className="text-red-500">*</span></label>
                                <input
                                    className="input"
                                    required
                                    pattern="[A-Za-z\s]+"
                                    title="Only letters and spaces allowed"
                                    autoComplete="off"
                                    value={formData.mother_name}
                                    onCopy={e => e.preventDefault()}
                                    onPaste={e => e.preventDefault()}
                                    onChange={e => {
                                        if (/^[A-Za-z\s]*$/.test(e.target.value)) {
                                            setFormData({ ...formData, mother_name: e.target.value });
                                        }
                                    }}
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="label">Mobile Number <span className="text-red-500">*</span></label>
                                <input
                                    className="input"
                                    type="tel"
                                    required
                                    id="student-contact"
                                    name="contact_number"
                                    maxLength="10"
                                    placeholder="10 Digits"
                                    autoComplete="off"
                                    value={formData.contact_number}
                                    onCopy={e => e.preventDefault()}
                                    onPaste={e => e.preventDefault()}
                                    onChange={e => {
                                        const re = /^[0-9\b]+$/;
                                        if (e.target.value === '' || re.test(e.target.value)) {
                                            setFormData({ ...formData, contact_number: e.target.value })
                                        }
                                    }}
                                />
                            </div>
                            <div className="col-span-1">
                                <label className="label">Email Address <span className="text-red-500">*</span></label>
                                <input
                                    className="input"
                                    type="email"
                                    required
                                    id="student-email"
                                    name="email"
                                    placeholder="example@domain.com"
                                    autoComplete="off"
                                    value={formData.email}
                                    onCopy={e => e.preventDefault()}
                                    onPaste={e => e.preventDefault()}
                                    onChange={e => {
                                        // Remove spaces and allow only valid email characters (basic check)
                                        const val = e.target.value.replace(/\s/g, '');
                                        setFormData({ ...formData, email: val });
                                    }}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="label">Address</label>
                                <textarea
                                    className="input"
                                    rows="2"
                                    autoComplete="off"
                                    value={formData.address}
                                    onCopy={e => e.preventDefault()}
                                    onPaste={e => e.preventDefault()}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}>
                                </textarea>
                            </div>

                            <div className="col-span-2 flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                    {isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Admit Student')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Student Promotion Modal */}
            <StudentPromotionModal
                isOpen={showPromotionModal}
                onClose={() => {
                    setShowPromotionModal(false);
                    setSelectedStudents([]);
                }}
                selectedStudents={selectedStudents}
                config={{ ...config, classes: sortedClasses }}
                onSuccess={() => {
                    fetchStudents();
                    setSelectedStudents([]);
                }}
            />
        </div>
    );
};

export default StudentManagement;
