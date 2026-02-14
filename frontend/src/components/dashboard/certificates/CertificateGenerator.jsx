import React, { useState, useRef, useEffect } from 'react';
import { Search, Printer, FileText, Edit3, Download, Award, Calendar, User, Briefcase, GraduationCap } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const CertificateGenerator = () => {
    const [selectedTheme, setSelectedTheme] = useState('classic');
    const [userType, setUserType] = useState('STUDENT'); // 'STUDENT' or 'TEACHER'
    const [selectedType, setSelectedType] = useState('bonafide');
    const [searchTerm, setSearchTerm] = useState('');
    const [people, setPeople] = useState([]); // Replaces 'students'
    const [selectedPerson, setSelectedPerson] = useState(null); // Replaces 'selectedStudent'
    const [isEditing, setIsEditing] = useState(false);
    const [customText, setCustomText] = useState('');
    const [schoolDetails, setSchoolDetails] = useState({ name: 'School Name', address: 'Address Line 1' });

    useEffect(() => {
        const fetchSchoolDetails = async () => {
            try {
                const res = await api.get('/schools/my-school');
                setSchoolDetails(res.data);
            } catch (error) {
                console.error('Failed to fetch school details:', error);
            }
        };
        fetchSchoolDetails();
    }, []);

    // Certificate Templates Data
    const templates = {
        // Student Templates
        bonafide: {
            title: "BONAFIDE CERTIFICATE",
            color: "border-indigo-600",
            bg: "bg-indigo-50",
            for: 'STUDENT',
            text: (s) => `This is to certify that Master/Miss ${s.name}, Admission No. ${s.admission_no}, is a bonafide student of this school studying in Class ${s.class_name || '...'} Section ${s.section_name || '...'} for the academic year ${new Date().getFullYear()}-${new Date().getFullYear() + 1}.\n\nHis/Her date of birth as per our school records is ${s.dob ? new Date(s.dob).toLocaleDateString() : '...'}.\n\nHe/She bears a good moral character.`
        },
        character: {
            title: "CHARACTER CERTIFICATE",
            color: "border-emerald-600",
            bg: "bg-emerald-50",
            for: 'STUDENT',
            text: (s) => `This is to certify that Master/Miss ${s.name}, son/daughter of Mr. ${s.parent_name || '...'}, has been a student of this institution.\n\nDuring his/her stay in this school, to the best of my knowledge, he/she bears a good moral character and has displayed exemplary behavior.\n\nI wish him/her all the best for their future endeavors.`
        },
        transfer: {
            title: "TRANSFER CERTIFICATE",
            color: "border-slate-800",
            bg: "bg-slate-50",
            for: 'STUDENT',
            text: (s) => `TC Number: TC/${new Date().getFullYear()}/${s.id}\n\nName of Student: ${s.name}\nFather's Name: ${s.parent_name || '...'}\nDate of Birth: ${s.dob ? new Date(s.dob).toLocaleDateString('en-GB') : '...'}\nClass Studying: ${s.class_name || '...'}\n\nThis is to certify that the above student has no dues pending and has returned all library books. The student is hereby permitted to leave the institution.`
        },
        sports: {
            title: "CERTIFICATE OF ACHIEVEMENT",
            color: "border-orange-500",
            bg: "bg-orange-50",
            for: 'STUDENT',
            text: (s) => `This is to proudly certify that Master/Miss ${s.name} of Class ${s.class_name || '...'} has participated in the Annual Sports Meet ${new Date().getFullYear()} and secured _______ position in ___________ event.\n\nWe commend their sportsmanship and dedication.`
        },

        // Teacher Templates
        service: {
            title: "SERVICE CERTIFICATE",
            color: "border-blue-700",
            bg: "bg-blue-50",
            for: 'TEACHER',
            text: (t) => `This is to certify that Mr./Ms. ${t.name} has been working as a ${t.designation || 'Teacher'} (ID: ${t.employee_id || t.id || '...'}) in our institution since ${t.join_date ? new Date(t.join_date).toLocaleDateString('en-GB') : '...'}.\n\nDuring his/her tenure, he/she has been hardworking, sincere, and dedicated to the assigned duties. His/Her character and conduct have been excellent.\n\nWe wish him/her success in future endeavors.`
        },
        salary: {
            title: "SALARY CERTIFICATE",
            color: "border-green-700",
            bg: "bg-green-50",
            for: 'TEACHER',
            text: (t) => `TO WHOMSOEVER IT MAY CONCERN\n\nThis is to certify that Mr./Ms. ${t.name} is employed with us as ${t.designation || 'Teacher'} since ${t.join_date ? new Date(t.join_date).toLocaleDateString('en-GB') : '...'}.\n\nHis/Her current monthly gross salary is Rs. ${t.salary_per_day ? (t.salary_per_day * 30) : '...'} /-. This certificate is issued upon his/her request for _________________ purpose.`
        },
        experience: {
            title: "EXPERIENCE CERTIFICATE",
            color: "border-purple-700",
            bg: "bg-purple-50",
            for: 'TEACHER',
            text: (t) => `This is to certify that Mr./Ms. ${t.name} worked as a ${t.designation || 'Teacher'} in our school from ${t.join_date ? new Date(t.join_date).toLocaleDateString('en-GB') : '...'} to ${new Date().toLocaleDateString('en-GB')}.\n\nHe/She was responsible for teaching ${t.subject_specialization || '...'} to high school students. We found him/her to be professional and knowledgeable in the subject matter.\n\nWe wish him/her the very best.`
        }

    };

    // Filter templates based on user type
    const availableTemplates = Object.entries(templates).filter(([key, t]) => t.for === userType);

    // Theme Styles (Same as before)
    const themes = {
        classic: {
            label: "Classic Border",
            containerClass: (color) => `border-[16px] ${color}`,
            bgStyle: {
                backgroundImage: 'radial-gradient(circle at center, rgba(0,0,0,0.02) 2px, transparent 2px)',
                backgroundSize: '24px 24px'
            }
        },
        elegant: {
            label: "Elegant Double",
            containerClass: (color) => `border-4 border-double ${color} p-16 shadow-inner ring-4 ring-offset-4 ring-slate-100`,
            bgStyle: { backgroundColor: '#fff9f0' }
        },
        modern: {
            label: "Modern Sidebar",
            containerClass: (color) => `border-l-[48px] ${color} bg-white shadow-xl`,
            bgStyle: {}
        },
        premium: {
            label: "Premium Frame",
            containerClass: (color) => `border-y-8 ${color} shadow-2xl`,
            bgStyle: {
                backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.02) 1px, transparent 1px)',
                backgroundSize: '40px 40px'
            }
        }
    };

    const componentRef = useRef();
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Certificate-${selectedPerson?.name || 'User'}`,
    });

    const fetchPeople = async (value) => {
        if (!value) return;
        try {
            const endpoint = userType === 'STUDENT' ? '/students' : '/teachers';
            const res = await api.get(`${endpoint}?search=${value}`);

            // Handle different API response structures (Pagination vs Array)
            const rawData = Array.isArray(res.data) ? res.data : (res.data.data || []);

            // Client-side filtering backup
            const filtered = rawData.filter(p => {
                const searchLower = value.toLowerCase();
                const nameMatch = (p.name || '').toLowerCase().includes(searchLower);
                const idMatch = (p.admission_no || p.employee_id || p.id || '').toString().toLowerCase().includes(searchLower);
                return nameMatch || idMatch;
            });

            setPeople(filtered);
            if (filtered.length === 0 && value.length > 2) {
                toast.error('No results found');
            }
        } catch (error) {
            console.error(error);
            setPeople([]);
            toast.error('Search failed');
        }
    };

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (value.length > 2) {
            fetchPeople(value);
        } else {
            setPeople([]);
        }
    };

    const handleManualSearch = () => {
        if (searchTerm) fetchPeople(searchTerm);
    };

    const selectPerson = (person) => {
        setSelectedPerson(person);
        // Default to first available template for type if current selection mismatch
        const currentTemplate = templates[selectedType];

        let typeToUse = selectedType;
        if (currentTemplate.for !== userType) {
            typeToUse = availableTemplates[0][0];
            setSelectedType(typeToUse);
        }

        setCustomText(templates[typeToUse].text(person));
        setPeople([]);
        setSearchTerm('');
    };

    const handleTypeChange = (type) => {
        setSelectedType(type);
        if (selectedPerson) {
            setCustomText(templates[type].text(selectedPerson));
        }
    };

    const handleUserTypeChange = (type) => {
        setUserType(type);
        setSearchTerm('');
        setPeople([]);
        setSelectedPerson(null);
        // Reset to first template of new type
        const firstTemplate = Object.entries(templates).find(([_, t]) => t.for === type);
        if (firstTemplate) setSelectedType(firstTemplate[0]);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Controls Sidebar */}
                <div className="lg:col-span-1 space-y-6">

                    {/* User Type Selection (Student vs Teacher) */}
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex p-1">
                        <button
                            onClick={() => handleUserTypeChange('STUDENT')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${userType === 'STUDENT' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <GraduationCap size={16} /> Student
                        </button>
                        <button
                            onClick={() => handleUserTypeChange('TEACHER')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${userType === 'TEACHER' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Briefcase size={16} /> Teacher
                        </button>
                    </div>

                    {/* Theme Selection */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-3">Certificate Theme</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(themes).map(([key, theme]) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedTheme(key)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${selectedTheme === key
                                        ? 'bg-slate-800 text-white border-slate-800'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    {theme.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Certificate Type Selection */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <label className="block text-sm font-bold text-slate-700 mb-3">Certificate Type</label>
                        <div className="space-y-2">
                            {availableTemplates.map(([key, type]) => (
                                <button
                                    key={key}
                                    onClick={() => handleTypeChange(key)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedType === key
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    <FileText size={18} />
                                    {type.title.replace('CERTIFICATE', '').trim()} Certificate
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search & Edit Controls */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Select {userType === 'STUDENT' ? 'Student' : 'Staff'}</label>
                        <div className="relative flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder={userType === 'STUDENT' ? "Search Name/Adm No..." : "Search Name/Emp ID..."}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                />
                            </div>
                            <button
                                onClick={handleManualSearch}
                                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 transition-colors"
                            >
                                Search
                            </button>
                        </div>
                        {people.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto mx-4">
                                {people.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => selectPerson(p)}
                                        className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                    >
                                        <div className="font-bold text-slate-800">{p.name}</div>
                                        <div className="text-xs text-slate-500">
                                            {userType === 'STUDENT'
                                                ? `Class ${p.class_name} | ID: ${p.admission_no}`
                                                : `ID: ${p.employee_id} | ${p.designation}`
                                            }
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedPerson ? (
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-in slide-in-from-left-4 border-l-4 border-l-green-500">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                    Identity Verified
                                </h3>
                                <button
                                    onClick={() => setSelectedPerson(null)}
                                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                                >
                                    Change
                                </button>
                            </div>

                            <div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-2 border border-slate-100">
                                <div>
                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Name</div>
                                    <div className="text-sm font-bold text-slate-700">{selectedPerson.name}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                                            {userType === 'STUDENT' ? 'Admission No' : 'Employee ID'}
                                        </div>
                                        <div className="text-sm font-medium text-slate-600">
                                            {selectedPerson.admission_no || selectedPerson.employee_id || selectedPerson.id}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                                            {userType === 'STUDENT' ? 'Class' : 'Designation'}
                                        </div>
                                        <div className="text-sm font-medium text-slate-600">
                                            {selectedPerson.admission_no
                                                ? `${selectedPerson.class_name || '-'} ${selectedPerson.section_name || ''}`
                                                : (selectedPerson.designation || 'Teacher')
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Certificate Content</label>
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="text-xs flex items-center gap-1 text-indigo-600 font-bold hover:underline"
                                >
                                    <Edit3 size={12} /> {isEditing ? 'Done' : 'Edit Text'}
                                </button>
                            </div>

                            {isEditing && (
                                <textarea
                                    className="w-full h-32 p-3 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none mb-4 font-mono bg-slate-50"
                                    value={customText}
                                    onChange={(e) => setCustomText(e.target.value)}
                                ></textarea>
                            )}

                            <button
                                onClick={handlePrint}
                                className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                <Printer size={20} /> Generate & Print
                            </button>
                        </div>
                    ) : (
                        <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 text-center opacity-75">
                            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                                <User size={24} className="text-slate-400" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-600 mb-1">Verify Identity First</h3>
                            <p className="text-xs text-slate-500 mb-4">Search and select a {userType.toLowerCase()} to enable generation.</p>
                            <button disabled className="w-full bg-slate-200 text-slate-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                                <Printer size={20} /> Generate & Print
                            </button>
                        </div>
                    )}
                </div>

                {/* Preview Area */}
                <div className="lg:col-span-3 bg-slate-100 p-8 rounded-xl flex items-center justify-center overflow-auto min-h-[600px]">
                    {selectedPerson ? (
                        <div className="print-area shadow-2xl scale-[0.8] origin-top" ref={componentRef}>
                            <div
                                className={`w-[800px] min-h-[600px] bg-white p-12 relative flex flex-col items-center text-center overflow-hidden ${themes[selectedTheme].containerClass(templates[selectedType].color)}`}
                                style={themes[selectedTheme].bgStyle}
                            >
                                {/* Watermark */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                                    <Award size={400} />
                                </div>

                                {/* Header */}
                                <div className="z-10 w-full mb-8">
                                    <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-white ${selectedTheme === 'modern' ? 'bg-slate-800' : 'bg-indigo-600'}`}>
                                        <Award size={32} />
                                    </div>
                                    <h1 className="text-3xl font-black text-slate-800 tracking-wider uppercase break-words px-4 font-serif">
                                        {schoolDetails.name}
                                    </h1>
                                    <p className="text-slate-500 font-medium text-sm mt-1 px-8 break-words uppercase tracking-wide">
                                        {schoolDetails.address}
                                    </p>
                                </div>

                                {/* Title */}
                                <div className="z-10 mb-12">
                                    <span className={`px-8 py-2 text-xl font-bold uppercase tracking-[0.2em] border-b-2 ${templates[selectedType].color} text-slate-800`}>
                                        {templates[selectedType].title}
                                    </span>
                                </div>

                                {/* Body Text */}
                                <div className="z-10 flex-1 w-full px-12 flex items-center">
                                    <p className={`text-xl leading-loose text-slate-800 whitespace-pre-line text-justify w-full ${selectedTheme === 'elegant' ? 'font-serif italic' : 'font-serif'}`}>
                                        {customText}
                                    </p>
                                </div>

                                {/* Footer / Signatures */}
                                <div className="z-10 w-full flex justify-between items-end mt-auto pt-16 px-8">
                                    <div className="text-center">
                                        <div className="w-40 border-b border-slate-400 mb-2"></div>
                                        <p className="text-sm font-bold text-slate-600 uppercase">
                                            {userType === 'TEACHER' ? 'Admin / HR' : 'Class Teacher'}
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <div className="w-32 h-12 mb-2 flex items-center justify-center">
                                            {/* Stamp Placeholer */}
                                            <div className={`w-20 h-20 rounded-full border-4 ${templates[selectedType].color} opacity-20 rotate-12 flex items-center justify-center`}>
                                                <span className="text-[10px] font-bold opacity-50 uppercase -rotate-12">Seal</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="w-40 border-b border-slate-400 mb-2"></div>
                                        <p className="text-sm font-bold text-slate-600 uppercase">Principal</p>
                                    </div>
                                </div>

                                {/* Date */}
                                <div className="absolute bottom-4 left-12 text-xs text-slate-400 font-mono">
                                    Generated on: {new Date().toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-400 animate-pulse">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                <FileText size={40} className="opacity-20" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-600">No {userType === 'STUDENT' ? 'Student' : 'Teacher'} Selected</h3>
                            <p className="max-w-xs mx-auto mt-2">Search and select a {userType.toLowerCase()} from the sidebar to generate and preview their certificate.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CertificateGenerator;
