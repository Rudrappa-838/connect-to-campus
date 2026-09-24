import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import {
    Printer,
    Award,
    FileText,
    CheckSquare,
    Square,
    RefreshCw,
    Calendar,
    Search,
    Plus,
    Trash2,
    Eye,
    SlidersHorizontal,
    School,
    Hash,
    Building2,
    BookOpen
} from 'lucide-react';

const HallTicketGenerator = ({ config }) => {
    // Selection state
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedSectionId, setSelectedSectionId] = useState('');
    const [examTypes, setExamTypes] = useState([]);
    const [selectedExamTypeId, setSelectedExamTypeId] = useState('');

    // Metadata inputs (User entered / editable per request)
    const [trustName, setTrustName] = useState(() => localStorage.getItem('ht_trust_name') || '');
    const [collegeCode, setCollegeCode] = useState(() => localStorage.getItem('ht_college_code') || '');
    const [diseCode, setDiseCode] = useState(() => localStorage.getItem('ht_dise_code') || '');
    const [examTitle, setExamTitle] = useState(() => localStorage.getItem('ht_exam_title') || 'Mid-Term Exam Ã¢â‚¬â€œ October-2026');
    const [printLayout, setPrintLayout] = useState('2-per-page'); // '2-per-page' | '1-per-page'

    // School Profile details
    const [schoolInfo, setSchoolInfo] = useState({
        name: '',
        address: '',
        contact_number: '',
        logo: '',
        principal_signature: '',
        school_code: ''
    });

    // Students & Schedule state
    const [students, setStudents] = useState([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [timetable, setTimetable] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [previewStudent, setPreviewStudent] = useState(null);
    const [searchStudent, setSearchStudent] = useState('');

    // Subject editing state (allows adding / modifying subjects on the fly)
    const [showSubjectEditor, setShowSubjectEditor] = useState(false);
    const [newSubjectName, setNewSubjectName] = useState('');
    const [newSubjectDate, setNewSubjectDate] = useState('');

    // Save metadata to localStorage on change
    useEffect(() => {
        if (trustName) localStorage.setItem('ht_trust_name', trustName);
    }, [trustName]);

    useEffect(() => {
        if (collegeCode) localStorage.setItem('ht_college_code', collegeCode);
    }, [collegeCode]);

    useEffect(() => {
        if (diseCode) localStorage.setItem('ht_dise_code', diseCode);
    }, [diseCode]);

    useEffect(() => {
        if (examTitle) localStorage.setItem('ht_exam_title', examTitle);
    }, [examTitle]);

    // Initial load: School Profile, Classes, Exam Types
    useEffect(() => {
        fetchSchoolAndClasses();
        fetchExamTypes();
    }, []);

    const fetchSchoolAndClasses = async () => {
        try {
            const res = await api.get('/schools/my-school');
            if (res.data) {
                setSchoolInfo({
                    name: res.data.name || 'INSTITUTION NAME',
                    address: res.data.address || '',
                    contact_number: res.data.contact_number || '',
                    logo: res.data.logo || '',
                    principal_signature: res.data.principal_signature || '',
                    school_code: res.data.school_code || ''
                });

                if (!collegeCode && res.data.school_code) {
                    setCollegeCode(res.data.school_code);
                }

                if (res.data.classes && Array.isArray(res.data.classes)) {
                    const formatted = res.data.classes.map(c => ({
                        id: c.class_id,
                        name: c.class_name,
                        sections: c.sections || []
                    }));
                    setClasses(formatted);
                    if (formatted.length > 0) {
                        setSelectedClassId(formatted[0].id.toString());
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load school/class data:', error);
            toast.error('Failed to load classes');
        }
    };

    const fetchExamTypes = async () => {
        try {
            const res = await api.get('/marks/exam-types');
            if (res.data && Array.isArray(res.data)) {
                setExamTypes(res.data);
                if (res.data.length > 0) {
                    setSelectedExamTypeId(res.data[0].id.toString());
                }
            }
        } catch (error) {
            console.error('Failed to load exam types:', error);
        }
    };

    // Available sections for chosen class
    const availableSections = useMemo(() => {
        const c = classes.find(cls => cls.id.toString() === selectedClassId.toString());
        return c ? c.sections : [];
    }, [classes, selectedClassId]);

    // Default section to All Sections when class changes so all students in the class are visible
    useEffect(() => {
        setSelectedSectionId('');
    }, [selectedClassId]);

    // Update Exam Title placeholder when exam type changes
    useEffect(() => {
        if (selectedExamTypeId) {
            const exam = examTypes.find(e => e.id.toString() === selectedExamTypeId.toString());
            if (exam) {
                const now = new Date();
                const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                const suggested = `${exam.name} Ã¢â‚¬â€œ ${monthYear}`;
                if (!examTitle || examTitle === 'Mid-Term Exam Ã¢â‚¬â€œ October-2026') {
                    setExamTitle(suggested);
                }
            }
        }
    }, [selectedExamTypeId, examTypes]);

    // Fetch Students whenever Class or Section changes
    useEffect(() => {
        if (!selectedClassId) return;
        fetchStudents();
    }, [selectedClassId, selectedSectionId]);

    const fetchStudents = async () => {
        setLoadingStudents(true);
        try {
            const params = {
                class_id: selectedClassId,
                limit: 1000
            };
            if (selectedSectionId) {
                params.section_id = selectedSectionId;
            }
            const res = await api.get('/students', { params });
            const rawData = res.data?.data || res.data?.students || (Array.isArray(res.data) ? res.data : []);
            const list = Array.isArray(rawData) ? rawData : [];

            // Sort by roll number ascending
            const sorted = [...list].sort((a, b) => {
                const rA = parseInt(a.roll_number || '0', 10);
                const rB = parseInt(b.roll_number || '0', 10);
                if (rA !== rB) return rA - rB;
                return (a.name || '').localeCompare(b.name || '');
            });
            setStudents(sorted);
            setSelectedStudentIds(sorted.map(s => s.id));
            if (sorted.length > 0) {
                setPreviewStudent(sorted[0]);
            } else {
                setPreviewStudent(null);
            }
        } catch (error) {
            console.error('Failed to fetch students:', error);
            toast.error('Failed to load students');
        } finally {
            setLoadingStudents(false);
        }
    };

    // Fetch Timetable / Schedule whenever Exam Type, Class or Section changes
    useEffect(() => {
        if (!selectedClassId || !selectedExamTypeId) return;
        fetchSchedule();
    }, [selectedClassId, selectedSectionId, selectedExamTypeId]);

    const fetchSchedule = async () => {
        setLoadingSchedule(true);
        try {
            const params = {
                class_id: selectedClassId,
                exam_type_id: selectedExamTypeId
            };
            if (selectedSectionId) {
                params.section_id = selectedSectionId;
            }
            const res = await api.get('/exam-schedule', { params });
            const schedules = res.data || [];
            if (schedules.length > 0) {
                // Map to clean table format
                const mapped = schedules.map(item => ({
                    id: item.id || Math.random(),
                    subject: item.subject_name || item.topic || 'Subject',
                    date: item.exam_date ? formatDateToIndian(item.exam_date) : '-'
                }));
                setTimetable(mapped);
            } else {
                // Default fallback placeholder schedule if not scheduled yet
                setTimetable([
                    { id: 1, subject: 'Physics', date: '26-09-2026' },
                    { id: 2, subject: 'Mathematics', date: '28-09-2026' },
                    { id: 3, subject: 'Chemistry', date: '30-09-2026' },
                    { id: 4, subject: 'Biology', date: '01-10-2026' },
                    { id: 5, subject: 'Kannada', date: '03-10-2026' },
                    { id: 6, subject: 'English', date: '05-10-2026' }
                ]);
            }
        } catch (error) {
            console.error('Failed to fetch schedule:', error);
            // Fallback default sample subjects
            setTimetable([
                { id: 1, subject: 'Physics', date: '26-09-2026' },
                { id: 2, subject: 'Mathematics', date: '28-09-2026' },
                { id: 3, subject: 'Chemistry', date: '30-09-2026' },
                { id: 4, subject: 'Biology', date: '01-10-2026' },
                { id: 5, subject: 'Kannada', date: '03-10-2026' },
                { id: 6, subject: 'English', date: '05-10-2026' }
            ]);
        } finally {
            setLoadingSchedule(false);
        }
    };

    // Helper to format dates to DD-MM-YYYY
    const formatDateToIndian = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        } catch (e) {
            return dateStr;
        }
    };

    // Select / Deselect Students
    const handleToggleStudent = (id) => {
        setSelectedStudentIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedStudentIds.length === filteredStudents.length) {
            setSelectedStudentIds([]);
        } else {
            setSelectedStudentIds(filteredStudents.map(s => s.id));
        }
    };

    // Subject Editor Functions
    const handleAddSubject = () => {
        if (!newSubjectName.trim()) {
            return toast.error('Subject name is required');
        }
        setTimetable(prev => [
            ...prev,
            {
                id: Date.now(),
                subject: newSubjectName.trim(),
                date: newSubjectDate ? formatDateToIndian(newSubjectDate) : '-'
            }
        ]);
        setNewSubjectName('');
        setNewSubjectDate('');
        toast.success('Subject added to timetable');
    };

    const handleRemoveSubject = (id) => {
        setTimetable(prev => prev.filter(item => item.id !== id));
    };

    const handleUpdateSubject = (id, field, value) => {
        setTimetable(prev =>
            prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
        );
    };

    // Search filter for students
    const filteredStudents = useMemo(() => {
        if (!searchStudent.trim()) return students;
        const q = searchStudent.toLowerCase();
        return students.filter(s =>
            (s.name && s.name.toLowerCase().includes(q)) ||
            (s.admission_no && s.admission_no.toLowerCase().includes(q)) ||
            (s.roll_number && s.roll_number.toString().includes(q)) ||
            (s.enrollment_number && s.enrollment_number.toLowerCase().includes(q)) ||
            (s.sats_number && s.sats_number.toLowerCase().includes(q))
        );
    }, [students, searchStudent]);

    // Current Class & Section names
    const currentClassName = useMemo(() => {
        const c = classes.find(cls => cls.id.toString() === selectedClassId.toString());
        return c ? c.name : 'I PUC';
    }, [classes, selectedClassId]);

    const currentSectionName = useMemo(() => {
        const s = availableSections.find(sec => sec.id.toString() === selectedSectionId.toString());
        return s ? s.name : 'Science';
    }, [availableSections, selectedSectionId]);

    // Printable HTML Generation (Exact match to sample image)
    const generateHallTicketHTML = (studentList) => {
        const isTwoPerPage = printLayout === '2-per-page';

        const ticketsHTML = studentList.map((stu, index) => {
            const rollNo = stu.custom_roll_number || (stu.roll_number ? String(stu.roll_number).padStart(2, '0') : '-');
            const satsNo = stu.sats_number || '-';
            const enrNo = stu.enrollment_number || '-';
            const stuClass = stu.class_name || currentClassName;
            const stuSection = stu.section_name || currentSectionName;

            const isEven = (index + 1) % 2 === 0;

            return `
            <div class="hall-ticket-wrapper ${isTwoPerPage ? 'ticket-two-per-page' : 'ticket-single-page'}">
                <div class="hall-ticket-box">
                    <!-- HEADER SECTION -->
                    <div class="ht-header">
                        <div class="ht-logo-col">
                            ${schoolInfo.logo ? `<img src="${schoolInfo.logo}" alt="Logo" class="ht-logo-img" />` : `<div class="ht-logo-placeholder"><span>LOGO</span></div>`}
                        </div>
                        <div class="ht-inst-col">
                            ${trustName ? `<div class="ht-trust-name">${trustName}</div>` : ''}
                            <div class="ht-college-name">${schoolInfo.name || 'INSTITUTION NAME'}</div>
                            <div class="ht-address-phone">
                                ${schoolInfo.address || 'Address'}, ${schoolInfo.contact_number ? 'MobileNo.:' + schoolInfo.contact_number : ''}
                            </div>
                            <div class="ht-exam-title">${examTitle || 'Examination'}</div>
                            <div class="ht-banner-title">Examination Hall Ticket</div>
                        </div>
                        <div class="ht-codes-col">
                            ${collegeCode ? `<div class="ht-code-line">COLLEGE CODE : ${collegeCode}</div>` : ''}
                            ${diseCode ? `<div class="ht-code-line">Dise Code : ${diseCode}</div>` : ''}
                        </div>
                    </div>

                    <!-- CANDIDATE INFO BOX -->
                    <div class="ht-candidate-box">
                        <div class="ht-cand-left">
                            <div class="ht-cand-row">
                                <span class="ht-label">Student Name</span>
                                <span class="ht-sep">:</span>
                                <span class="ht-val ht-val-name">${stu.name || '-'}</span>
                            </div>
                            <div class="ht-cand-row">
                                <span class="ht-label">Class</span>
                                <span class="ht-sep">:</span>
                                <span class="ht-val">${stuClass}</span>
                            </div>
                            ${availableSections.length > 0 ? `
                            <div class="ht-cand-row">
                                <span class="ht-label">Section</span>
                                <span class="ht-sep">:</span>
                                <span class="ht-val">${stuSection}</span>
                            </div>` : ''}
                        </div>
                        <div class="ht-cand-right">
                            <div class="ht-cand-row">
                                <span class="ht-label">SATS NO.</span>
                                <span class="ht-sep">:</span>
                                <span class="ht-val ht-val-mono">${satsNo}</span>
                            </div>
                            <div class="ht-cand-row">
                                <span class="ht-label">Enrollment No.</span>
                                <span class="ht-sep">:</span>
                                <span class="ht-val ht-val-mono">${enrNo}</span>
                            </div>
                            <div class="ht-cand-row">
                                <span class="ht-label">Roll No.</span>
                                <span class="ht-sep">:</span>
                                <span class="ht-val ht-val-mono">${rollNo}</span>
                            </div>
                        </div>
                    </div>

                    <!-- TIMETABLE TABLE -->
                    <table class="ht-timetable">
                        <thead>
                            <tr>
                                <th style="width: 55px; text-align: center;">Sl No.</th>
                                <th style="width: 200px;">Subject</th>
                                <th style="width: 110px; text-align: center;">Date</th>
                                <th style="width: 90px; text-align: center;">Block No</th>
                                <th style="width: 120px; text-align: center;">Ans.Book No</th>
                                <th style="text-align: center;">Invigilator Sign</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${timetable.map((sub, i) => `
                                <tr>
                                    <td style="text-align: center; font-weight: 500;">${i + 1}</td>
                                    <td style="font-weight: 600; padding-left: 10px;">${sub.subject}</td>
                                    <td style="text-align: center; font-family: monospace; font-size: 11px;">${sub.date}</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <!-- FOOTER SECTION -->
                    <div class="ht-footer">
                        <div class="ht-principal-box">
                            ${schoolInfo.principal_signature ? `<img src="${schoolInfo.principal_signature}" alt="Signature" class="ht-sig-img" />` : '<div class="ht-sig-space"></div>'}
                            <div class="ht-principal-text">Principal</div>
                        </div>
                    </div>
                </div>
            </div>
            ${isTwoPerPage && isEven ? '<div class="page-break"></div>' : (!isTwoPerPage ? '<div class="page-break"></div>' : '')}
            `;
        }).join('');

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Examination Hall Tickets - ${currentClassName}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
                }
                body {
                    background: #ffffff;
                    color: #000000;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                @page {
                    size: A4 portrait;
                    margin: 8mm 10mm;
                }
                .hall-ticket-wrapper {
                    width: 100%;
                    box-sizing: border-box;
                }
                .ticket-two-per-page {
                    height: 48.5%;
                    margin-bottom: 12px;
                    page-break-inside: avoid;
                }
                .ticket-single-page {
                    height: 98%;
                    page-break-inside: avoid;
                }
                .hall-ticket-box {
                    border: 1.5px solid #000000;
                    padding: 10px 14px 12px 14px;
                    background: #ffffff;
                    position: relative;
                }
                /* HEADER */
                .ht-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1.5px solid #000000;
                    padding-bottom: 8px;
                    margin-bottom: 8px;
                }
                .ht-logo-col {
                    width: 75px;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .ht-logo-img {
                    max-width: 65px;
                    max-height: 65px;
                    object-fit: contain;
                }
                .ht-logo-placeholder {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    border: 1px dashed #777;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    color: #777;
                }
                .ht-inst-col {
                    flex: 1;
                    text-align: center;
                    padding: 0 10px;
                }
                .ht-trust-name {
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #000000;
                    margin-bottom: 2px;
                }
                .ht-college-name {
                    font-size: 17px;
                    font-weight: 900;
                    color: #b91c1c;
                    font-family: 'Times New Roman', Times, serif;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    margin-bottom: 2px;
                }
                .ht-address-phone {
                    font-size: 10px;
                    font-weight: bold;
                    color: #000000;
                    margin-bottom: 3px;
                }
                .ht-exam-title {
                    font-size: 12px;
                    font-weight: 700;
                    color: #000000;
                    margin-bottom: 2px;
                }
                .ht-banner-title {
                    font-size: 13px;
                    font-weight: 800;
                    text-transform: capitalize;
                    letter-spacing: 0.3px;
                    color: #000000;
                    margin-top: 2px;
                }
                .ht-codes-col {
                    width: 150px;
                    flex-shrink: 0;
                    text-align: right;
                    font-size: 13px;
                    font-weight: bold;
                }
                .ht-code-line {
                    color: #000000;
                    margin-bottom: 4px;
                }
                .ht-dise-line {
                    font-size: 12px;
                }
                /* CANDIDATE BOX */
                .ht-candidate-box {
                    border: 1px solid #000000;
                    padding: 6px 10px;
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 12px;
                    background: #ffffff;
                }
                .ht-cand-left {
                    width: 55%;
                }
                .ht-cand-right {
                    width: 45%;
                }
                .ht-cand-row {
                    display: flex;
                    align-items: center;
                    line-height: 1.6;
                }
                .ht-label {
                    width: 110px;
                    font-weight: 700;
                    color: #000000;
                }
                .ht-sep {
                    margin-right: 8px;
                    font-weight: 700;
                }
                .ht-val {
                    font-weight: 600;
                    color: #000000;
                }
                .ht-val-name {
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .ht-val-mono {
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 13px;
                    font-weight: 700;
                }
                /* TIMETABLE TABLE */
                .ht-timetable {
                    width: 100%;
                    border-collapse: collapse;
                    border: 1px solid #000000;
                    margin-bottom: 12px;
                    font-size: 11.5px;
                }
                .ht-timetable th, .ht-timetable td {
                    border: 1px solid #000000;
                    padding: 4px 6px;
                    height: 24px;
                }
                .ht-timetable th {
                    background-color: #f1f5f9;
                    font-weight: 700;
                    color: #000000;
                    font-size: 11px;
                }
                /* FOOTER */
                .ht-footer {
                    display: flex;
                    justify-content: flex-end;
                    padding-right: 15px;
                    margin-top: 8px;
                }
                .ht-principal-box {
                    text-align: center;
                    min-width: 110px;
                }
                .ht-sig-space {
                    height: 28px;
                }
                .ht-sig-img {
                    max-height: 32px;
                    max-width: 100px;
                    object-fit: contain;
                    display: block;
                    margin: 0 auto 2px auto;
                }
                .ht-principal-text {
                    font-size: 12px;
                    font-weight: 800;
                    color: #000000;
                }
                .page-break {
                    page-break-after: always;
                    height: 0;
                    margin: 0;
                }
                @media print {
                    .page-break {
                        page-break-after: always;
                    }
                }
            </style>
        </head>
        <body>
            ${ticketsHTML}
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 500);
                };
            </script>
        </body>
        </html>
        `;
    };

    // Trigger Print
    const handlePrint = (studentsToPrint) => {
        if (!studentsToPrint || studentsToPrint.length === 0) {
            return toast.error('No students selected to print');
        }
        if (timetable.length === 0) {
            return toast.error('Timetable has no subjects. Please add at least 1 subject.');
        }

        const html = generateHallTicketHTML(studentsToPrint);
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            return toast.error('Pop-up blocked. Please allow pop-ups for this site to print.');
        }
        printWindow.document.write(html);
        printWindow.document.close();
    };

    // Print Selected
    const handlePrintSelected = () => {
        const selected = students.filter(s => selectedStudentIds.includes(s.id));
        handlePrint(selected);
    };

    // Print All
    const handlePrintAll = () => {
        handlePrint(students);
    };

    // Print Single Student
    const handlePrintSingle = (student) => {
        handlePrint([student]);
    };

    return (
        <div className="space-y-6">
            {/* Top Banner Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                            <Award size={26} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold text-slate-800">Examination Hall Ticket Generator</h1>
                                <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-100">
                                    Academics
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Generate and print official examination hall tickets matching the board/PU college format.
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={() => setShowSubjectEditor(!showSubjectEditor)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                            <SlidersHorizontal size={14} />
                            {showSubjectEditor ? 'Hide Timetable Editor' : 'Edit Subjects & Dates'}
                        </button>
                        <button
                            onClick={handlePrintSelected}
                            disabled={selectedStudentIds.length === 0 || loadingStudents}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                        >
                            <Printer size={16} />
                            Print Selected ({selectedStudentIds.length})
                        </button>
                        <button
                            onClick={handlePrintAll}
                            disabled={students.length === 0 || loadingStudents}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-rose-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                        >
                            <Printer size={16} />
                            Print All ({students.length})
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter & Configuration Bar */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* Class Selector */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Class *</label>
                        <select
                            value={selectedClassId}
                            onChange={e => setSelectedClassId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 cursor-pointer"
                        >
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Section Selector */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Section</label>
                        <select
                            value={selectedSectionId}
                            onChange={e => setSelectedSectionId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 cursor-pointer"
                        >
                            <option value="">All Sections</option>
                            {availableSections.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Exam Type Selector */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Exam Type *</label>
                        <select
                            value={selectedExamTypeId}
                            onChange={e => setSelectedExamTypeId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 cursor-pointer"
                        >
                            {examTypes.map(et => (
                                <option key={et.id} value={et.id}>{et.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* College Code (Requested by user) */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            College Code
                        </label>
                        <input
                            type="text"
                            value={collegeCode}
                            onChange={e => setCollegeCode(e.target.value)}
                            placeholder="e.g. EB0304"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-indigo-400"
                        />
                    </div>

                    {/* DISE Code (Requested by user) */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            DISE Code
                        </label>
                        <input
                            type="text"
                            value={diseCode}
                            onChange={e => setDiseCode(e.target.value)}
                            placeholder="e.g. 29020211210"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-indigo-400"
                        />
                    </div>

                    {/* Print Layout */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Print Layout</label>
                        <select
                            value={printLayout}
                            onChange={e => setPrintLayout(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 cursor-pointer"
                        >
                            <option value="2-per-page">2 Tickets / Page (A4)</option>
                            <option value="1-per-page">1 Ticket / Page (A4)</option>
                        </select>
                    </div>
                </div>

                {/* Refresh Button */}
                <div className="flex justify-end pt-1">
                    <button
                        onClick={() => { fetchStudents(); fetchSchedule(); }}
                        disabled={loadingStudents || loadingSchedule}
                        className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={(loadingStudents || loadingSchedule) ? 'animate-spin' : ''} />
                        Refresh Data
                    </button>
                </div>

                {/* Second Row: Society/Trust & Exam Title */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Trust / Society Name <span className="text-slate-400 font-normal">(Optional header)</span>
                        </label>
                        <input
                            type="text"
                            value={trustName}
                            onChange={e => setTrustName(e.target.value)}
                            placeholder="e.g. VARADA HASTA SHIKSHANA SANSTHE MATTIKATTI Ã‚Â®"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-indigo-400"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Exam Title Bar
                        </label>
                        <input
                            type="text"
                            value={examTitle}
                            onChange={e => setExamTitle(e.target.value)}
                            placeholder="e.g. Mid-Term Exam Ã¢â‚¬â€œ October-2026"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-indigo-400"
                        />
                    </div>
                </div>
            </div>

            {/* Subject / Timetable Editor Panel (Collapsible) */}
            {showSubjectEditor && (
                <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                                <BookOpen size={16} className="text-indigo-600" />
                                Exam Timetable & Subjects ({timetable.length} Subjects)
                            </h3>
                            <p className="text-[11px] text-indigo-600 mt-0.5">
                                Subjects and dates that will appear in the table on every student's hall ticket.
                            </p>
                        </div>
                        <button
                            onClick={fetchSchedule}
                            disabled={loadingSchedule}
                            className="text-xs text-indigo-700 bg-white hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 font-bold flex items-center gap-1 transition-colors"
                        >
                            <RefreshCw size={12} className={loadingSchedule ? 'animate-spin' : ''} />
                            Reload from Exam Schedule
                        </button>
                    </div>

                    {/* Table of Subjects */}
                    <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-indigo-100/60 font-bold text-indigo-950 uppercase text-[10px]">
                                <tr>
                                    <th className="p-2.5 pl-4 w-12 text-center">#</th>
                                    <th className="p-2.5">Subject Name</th>
                                    <th className="p-2.5 w-48">Date (DD-MM-YYYY)</th>
                                    <th className="p-2.5 pr-4 w-16 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {timetable.map((sub, idx) => (
                                    <tr key={sub.id} className="hover:bg-slate-50">
                                        <td className="p-2.5 pl-4 text-center font-bold text-slate-500">{idx + 1}</td>
                                        <td className="p-2.5">
                                            <input
                                                type="text"
                                                value={sub.subject}
                                                onChange={e => handleUpdateSubject(sub.id, 'subject', e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
                                            />
                                        </td>
                                        <td className="p-2.5">
                                            <input
                                                type="text"
                                                value={sub.date}
                                                onChange={e => handleUpdateSubject(sub.id, 'date', e.target.value)}
                                                placeholder="26-09-2026"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-medium text-slate-700 outline-none focus:border-indigo-400"
                                            />
                                        </td>
                                        <td className="p-2.5 pr-4 text-center">
                                            <button
                                                onClick={() => handleRemoveSubject(sub.id)}
                                                className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Add new subject inline */}
                    <div className="flex items-center gap-2 pt-1">
                        <input
                            type="text"
                            placeholder="Add Subject (e.g. Physics)"
                            value={newSubjectName}
                            onChange={e => setNewSubjectName(e.target.value)}
                            className="bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-400 flex-1"
                        />
                        <input
                            type="date"
                            value={newSubjectDate}
                            onChange={e => setNewSubjectDate(e.target.value)}
                            className="bg-white border border-slate-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-indigo-400"
                        />
                        <button
                            onClick={handleAddSubject}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                        >
                            <Plus size={14} /> Add Subject
                        </button>
                    </div>
                </div>
            )}

            {/* Main Area: 2 Columns (Student Selector on Left, Live Hall Ticket Preview on Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Students List Column (5 cols) */}
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-slate-800">Students List</h2>
                            <p className="text-[11px] text-slate-500">
                                {selectedStudentIds.length} of {students.length} students selected
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSelectAll}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 transition-colors"
                            >
                                {selectedStudentIds.length === filteredStudents.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                    </div>

                    {/* Student Search */}
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name, roll, SATS, Enr..."
                            value={searchStudent}
                            onChange={e => setSearchStudent(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-400"
                        />
                    </div>

                    {/* Student Rows Container */}
                    <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                        {loadingStudents ? (
                            <div className="py-12 text-center text-slate-400 text-xs">
                                <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-indigo-500" />
                                Loading students...
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs">
                                No students found in this class/section.
                            </div>
                        ) : (
                            filteredStudents.map(stu => {
                                const isSelected = selectedStudentIds.includes(stu.id);
                                const isPreviewing = previewStudent?.id === stu.id;
                                const rollDisplay = stu.custom_roll_number || (stu.roll_number ? String(stu.roll_number).padStart(2, '0') : '-');

                                return (
                                    <div
                                        key={stu.id}
                                        onClick={() => setPreviewStudent(stu)}
                                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                            isPreviewing
                                                ? 'bg-indigo-50/70 border-indigo-300 shadow-sm'
                                                : 'bg-white border-slate-150 hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={e => {
                                                    e.stopPropagation();
                                                    handleToggleStudent(stu.id);
                                                }}
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold font-mono text-[11px] flex items-center justify-center shrink-0 border border-slate-200">
                                                {rollDisplay}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-slate-800 truncate">
                                                    {stu.name}
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        ID: {stu.admission_no}
                                                    </span>
                                                    {stu.enrollment_number && (
                                                        <span className="text-[9px] bg-purple-50 text-purple-700 px-1 py-0.2 rounded border border-purple-100 font-mono">
                                                            Enr: {stu.enrollment_number}
                                                        </span>
                                                    )}
                                                    {stu.sats_number && (
                                                        <span className="text-[9px] bg-teal-50 text-teal-700 px-1 py-0.2 rounded border border-teal-100 font-mono">
                                                            SATS: {stu.sats_number}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    handlePrintSingle(stu);
                                                }}
                                                title="Print this ticket"
                                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                                            >
                                                <Printer size={15} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Live Hall Ticket Preview Column (7 cols) */}
                <div className="lg:col-span-7 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Eye size={16} className="text-indigo-600" />
                            <h2 className="text-sm font-bold text-slate-800">
                                Live Preview {previewStudent ? `(${previewStudent.name})` : ''}
                            </h2>
                        </div>
                        {previewStudent && (
                            <button
                                onClick={() => handlePrintSingle(previewStudent)}
                                className="bg-slate-900 hover:bg-black text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                                <Printer size={14} /> Print This Ticket
                            </button>
                        )}
                    </div>

                    {/* Preview Box - Exact replica of user's photo */}
                    {previewStudent ? (
                        <div className="border-2 border-black p-4 bg-white text-black shadow-inner rounded-sm overflow-x-auto text-[12px] font-sans">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
                                <div className="w-16 shrink-0 flex items-center justify-center">
                                    {schoolInfo.logo ? (
                                        <img src={schoolInfo.logo} alt="Logo" className="max-w-[55px] max-h-[55px] object-contain" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full border border-dashed border-gray-400 flex items-center justify-center text-[9px] text-gray-500">
                                            LOGO
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 text-center px-2">
                                    {trustName && (
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-black">
                                            {trustName}
                                        </div>
                                    )}
                                    <div className="text-[16px] font-extrabold text-red-700 font-serif uppercase tracking-wide">
                                        {schoolInfo.name || 'INSTITUTION NAME'}
                                    </div>
                                    <div className="text-[10px] font-bold text-black">
                                        {schoolInfo.address || 'Address'}, {schoolInfo.contact_number ? 'MobileNo.:' + schoolInfo.contact_number : ''}
                                    </div>
                                    <div className="text-[11px] font-bold text-black mt-0.5">
                                        {examTitle || 'Mid-Term Exam Ã¢â‚¬â€œ October-2026'}
                                    </div>
                                    <div className="text-[12px] font-black text-black tracking-wide mt-0.5">
                                        Examination Hall Ticket
                                    </div>
                                </div>
                                <div className="w-36 shrink-0 text-right text-[13px] font-bold">
                                    {collegeCode && (
                                        <div className="text-black">COLLEGE CODE : {collegeCode}</div>
                                    )}
                                    {diseCode && (
                                        <div className="text-black">Dise Code : {diseCode}</div>
                                    )}
                                </div>
                            </div>

                            {/* Candidate Info Box */}
                            <div className="border border-black p-2 flex justify-between mb-2 bg-white text-[11px]">
                                <div className="w-1/2 space-y-0.5">
                                    <div className="flex">
                                        <span className="w-24 font-bold">Student Name</span>
                                        <span className="mx-1 font-bold">:</span>
                                        <span className="font-extrabold uppercase">{previewStudent.name}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-24 font-bold">Class</span>
                                        <span className="mx-1 font-bold">:</span>
                                        <span className="font-semibold">{previewStudent.class_name || currentClassName}</span>
                                    </div>
                                    {availableSections.length > 0 && (
                                        <div className="flex">
                                            <span className="w-24 font-bold">Section</span>
                                            <span className="mx-1 font-bold">:</span>
                                            <span className="font-semibold">{previewStudent.section_name || currentSectionName}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="w-1/2 space-y-0.5">
                                    <div className="flex">
                                        <span className="w-28 font-bold">SATS NO.</span>
                                        <span className="mx-1 font-bold">:</span>
                                        <span className="font-mono font-bold">{previewStudent.sats_number || '-'}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-28 font-bold">Enrollment No.</span>
                                        <span className="mx-1 font-bold">:</span>
                                        <span className="font-mono font-bold">{previewStudent.enrollment_number || '-'}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-28 font-bold">Roll No.</span>
                                        <span className="mx-1 font-bold">:</span>
                                        <span className="font-mono font-bold">
                                            {previewStudent.custom_roll_number || (previewStudent.roll_number ? String(previewStudent.roll_number).padStart(2, '0') : '-')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Timetable Table */}
                            <table className="w-full border-collapse border border-black mb-3 text-[11px]">
                                <thead>
                                    <tr className="bg-slate-100 text-black">
                                        <th className="border border-black p-1 text-center w-12 font-bold">Sl No.</th>
                                        <th className="border border-black p-1 text-left font-bold pl-2">Subject</th>
                                        <th className="border border-black p-1 text-center w-28 font-bold">Date</th>
                                        <th className="border border-black p-1 text-center w-20 font-bold">Block No</th>
                                        <th className="border border-black p-1 text-center w-24 font-bold">Ans.Book No</th>
                                        <th className="border border-black p-1 text-center font-bold">Invigilator Sign</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timetable.map((sub, i) => (
                                        <tr key={sub.id} className="h-6">
                                            <td className="border border-black p-1 text-center font-medium">{i + 1}</td>
                                            <td className="border border-black p-1 pl-2 font-bold">{sub.subject}</td>
                                            <td className="border border-black p-1 text-center font-mono text-[10px]">{sub.date}</td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                            <td className="border border-black p-1"></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Principal Signature */}
                            <div className="flex justify-end pr-4 mt-2">
                                <div className="text-center">
                                    {schoolInfo.principal_signature ? (
                                        <img src={schoolInfo.principal_signature} alt="Sign" className="max-h-8 max-w-[90px] object-contain mx-auto" />
                                    ) : (
                                        <div className="h-6"></div>
                                    )}
                                    <div className="text-xs font-bold">Principal</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            Select a student from the list to preview their hall ticket.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HallTicketGenerator;
