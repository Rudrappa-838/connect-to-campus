import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import { 
    Printer, FileText, Search, Sparkles, RefreshCw, AlertCircle, User, GraduationCap, Users, ChevronDown
} from 'lucide-react';

// Clean Roman PUC Class Name Formatter
const formatClassName = (className) => {
    if (!className) return 'I PUC';
    const str = String(className).toUpperCase().trim();

    if (str.includes('2 PUC') || str.includes('2PUC') || str.includes('2ND') || str.includes('12') || str.includes('II PUC')) {
        return 'II PUC';
    }
    if (str.includes('1 PUC') || str.includes('1PUC') || str.includes('1ST') || str.includes('11') || str.includes('I PUC')) {
        return 'I PUC';
    }

    return str.includes('PUC') ? str : `${str} PUC`;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getSubjectExamData = (exam, subjectName) => {
    const defaultData = { marks: 'N/A', max: 100, date: null };
    if (!exam || !exam.subjects) return defaultData;

    const subMatch = exam.subjects.find(s => s.subject === subjectName);
    if (subMatch) {
        const obtained = subMatch.marks;
        const isAbsent = obtained === null || obtained === undefined || obtained === '' || obtained === 'ABSENT' || obtained === 'AB' || obtained === 'N/A' || obtained === 'NA';
        return {
            marks: isAbsent ? 'N/A' : obtained,
            max: subMatch.max || 100,
            date: subMatch.exam_date || null
        };
    }
    return defaultData;
};

// Display name for subject column headers
const getSubjectDisplayName = (name) => {
    const upper = name.toUpperCase();
    // Biology + Computer Science combined label
    if ((upper.includes('BIOLOGY') && upper.includes('COMPUTER')) ||
        (upper.includes('BIO') && upper.includes('CS'))) {
        return 'Biology/CS';
    }
    return name;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const str = String(dateStr).split('T')[0].trim();
        const parts = str.split('-');
        if (parts.length === 3) {
            const [y, m, d] = parts;
            return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
        }
        return dateStr;
    } catch {
        return dateStr;
    }
};

const getExamDates = (exam) => {
    if (!exam || !exam.subjects) return [];
    const dateSet = new Set();
    exam.subjects.forEach(s => {
        if (s.exam_date) {
            const formatted = formatDate(s.exam_date).trim();
            if (formatted) {
                dateSet.add(formatted);
            }
        }
    });
    return Array.from(dateSet);
};

// NEET order: Physics, Chemistry, Mathematics, Botany, Zoology, Biology
const SUBJECT_ORDER = [
    'PHYSICS', 'CHEMISTRY', 'MATHEMATICS', 'MATH', 'MATHS',
    'BOTANY', 'ZOOLOGY', 'BIOLOGY',
    'ENGLISH', 'KANNADA', 'HINDI', 'COMPUTER SCIENCE'
];

const subjectSortKey = (name) => {
    const upper = name.toUpperCase();
    const idx = SUBJECT_ORDER.findIndex(s => upper.includes(s));
    return idx === -1 ? 999 : idx;
};

// Sort exams by date (chronological/month-wise)
const sortExamsByDate = (exams) => {
    return [...exams].sort((a, b) => {
        const getFirstDate = (exam) => {
            if (!exam.subjects) return null;
            for (const s of exam.subjects) {
                if (s.exam_date) {
                    return new Date(s.exam_date);
                }
            }
            return null;
        };
        const da = getFirstDate(a);
        const db = getFirstDate(b);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
    });
};

const groupExams = (exams) => {
    if (!exams) return { jeeExams: [], neetExams: [], kcetExams: [], theoryExams: [] };
    
    const jeeExams = [];
    const neetExams = [];
    const kcetExams = [];
    const theoryExams = [];
    
    exams.forEach(exam => {
        const name = exam.exam_name.toUpperCase();
        if (name.includes('JEE')) {
            jeeExams.push(exam);
        } else if (name.includes('NEET')) {
            neetExams.push(exam);
        } else if (name.includes('KCET') || name.includes('CET')) {
            kcetExams.push(exam);
        } else {
            theoryExams.push(exam);
        }
    });
    
    // Sort each group by date (month-wise chronological)
    return {
        jeeExams: sortExamsByDate(jeeExams),
        neetExams: sortExamsByDate(neetExams),
        kcetExams: sortExamsByDate(kcetExams),
        theoryExams: sortExamsByDate(theoryExams)
    };
};

const getTableSubjects = (examsList) => {
    const subjectsMap = {};
    examsList.forEach(exam => {
        if (exam.subjects && Array.isArray(exam.subjects)) {
            exam.subjects.forEach(sub => {
                if (sub && sub.subject) {
                    const name = sub.subject;
                    if (!subjectsMap[name]) {
                        subjectsMap[name] = {
                            name: name,
                            code: sub.subject_code || ''
                        };
                    }
                }
            });
        }
    });
    return Object.values(subjectsMap).sort((a, b) => {
        const ka = subjectSortKey(a.name);
        const kb = subjectSortKey(b.name);
        if (ka !== kb) return ka - kb;
        return a.name.localeCompare(b.name);
    });
};

const getRowTotal = (exam, subjectsList) => {
    let allAbsent = true;
    let sum = 0;
    subjectsList.forEach(subject => {
        const subData = getSubjectExamData(exam, subject.name);
        if (subData.marks !== 'NA' && subData.marks !== 'N/A' && subData.marks !== 'ABSENT') {
            allAbsent = false;
            sum += parseFloat(subData.marks) || 0;
        }
    });
    return allAbsent ? 'N/A' : sum;
};

// ─── Direct Isolated HTML Generator for 100% Reliable Print Pagination ────────

const generateSingleMarksheetHTML = (result, school) => {
    const grouped = groupExams(result?.exams);
    const jeeSubjects = getTableSubjects(grouped.jeeExams);
    const neetSubjects = getTableSubjects(grouped.neetExams);
    const kcetSubjects = getTableSubjects(grouped.kcetExams);
    const theorySubjects = getTableSubjects(grouped.theoryExams);

    const schoolName = school?.name || 'SHRAMA PU SCIENCE COLLEGE.';
    const schoolLocation = school?.address || 'VIDYAGIRI, BAGALKOT.';

    const renderTableHTML = (exams, subjects, title, subtitle) => {
        if (!exams || exams.length === 0) return '';
        let html = `
        <div class="exam-section">
            <div class="exam-title-box">
                <div class="exam-title">${title}</div>
                ${subtitle ? `<div class="exam-subtitle">${subtitle}</div>` : ''}
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px;">SL NO</th>
                        <th style="width: 85px;">TEST DATE</th>
                        ${subjects.map(s => `<th>${getSubjectDisplayName(s.name)}</th>`).join('')}
                        <th style="width: 55px;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
        `;
        exams.forEach((exam, idx) => {
            const dates = getExamDates(exam);
            const total = getRowTotal(exam, subjects);
            html += `
                <tr>
                    <td class="font-bold">${String(idx + 1).padStart(2, '0')}</td>
                    <td>${dates.length > 0 ? dates.join('<br/>') : '-'}</td>
                    ${subjects.map(sub => {
                        const subData = getSubjectExamData(exam, sub.name);
                        const displayVal = (subData.marks === 'ABSENT' || subData.marks === 'N/A' || subData.marks === 'NA' || subData.marks === null || subData.marks === undefined || subData.marks === '') ? 'N/A' : subData.marks;
                        return `<td class="font-bold">${displayVal}</td>`;
                    }).join('')}
                    <td class="font-bold">${total}</td>
                </tr>
            `;
        });
        html += `
                </tbody>
            </table>
        </div>
        `;
        return html;
    };

    const hasNoExams = grouped.jeeExams.length === 0 && grouped.neetExams.length === 0 && grouped.kcetExams.length === 0 && grouped.theoryExams.length === 0;

    return `
    <div class="marksheet-page">
        <div class="marksheet-border">
            <!-- Header with logo and school details -->
            <div class="school-header">
                <div class="logo-box">
                    ${(school?.logo || school?.logo_url) ? `
                        <img src="${school.logo || school.logo_url}" class="logo-img" alt="Logo" />
                    ` : `
                        <div class="logo-fallback">
                            <span style="font-size:16px;">🎓</span>
                            <span>COLLEGE<br/>LOGO</span>
                        </div>
                    `}
                </div>
                <div class="school-text">
                    <h1 class="school-title">${schoolName}</h1>
                    <h2 class="school-sub">${schoolLocation}</h2>
                </div>
                <div class="logo-box-spacer"></div>
            </div>

            <!-- Student info bar -->
            <div class="student-info-bar">
                <div class="info-row">
                    <div>CLASS : <strong>${result.student.class_name || '-'}</strong></div>
                    <div style="text-align: right;">ROLL NO : <strong>${result.student.custom_roll_number || result.student.roll_number || result.student.admission_no || '-'}</strong></div>
                </div>
                <div style="margin-top: 4px;">
                    STUDENT NAME : <strong>${result.student.name}</strong>
                </div>
            </div>

            ${hasNoExams ? `
                <div class="no-exams-box">NO EXAM MARKS RECORDED YET FOR THIS STUDENT</div>
            ` : `
                ${renderTableHTML(grouped.jeeExams, jeeSubjects, 'JEE EXAMS MARKS CARD (MAX MARKS – 300)', 'COMPETITIVE TEST RESULTS')}
                ${renderTableHTML(grouped.neetExams, neetSubjects, 'NEET EXAMS MARKS CARD (MAX MARKS – 720)', 'COMPETITIVE TEST RESULTS')}
                ${renderTableHTML(grouped.kcetExams, kcetSubjects, 'KCET EXAMS MARKS CARD (MAX MARKS – 180)', 'COMPETITIVE TEST RESULTS')}
                ${renderTableHTML(grouped.theoryExams, theorySubjects, 'THEORY UNIT TEST MARKS LIST', '(MAX MARKS – 25)')}
            `}

            <!-- Signatures -->
            <div class="signatures-row">
                <div class="sig-box">
                    <div class="sig-line">Parent Signature</div>
                </div>
                <div class="sig-box" style="text-align: center;">
                    ${school?.principal_signature ? `
                        <img src="${school.principal_signature}" class="principal-sig-img" alt="Principal Signature" />
                    ` : ''}
                    <div class="sig-line">Principal Signature</div>
                </div>
            </div>
        </div>
    </div>
    `;
};

// ─── Function to Trigger Clean Multi-Page Print via Isolated Iframe ────────────

const printMarksheetsViaIframe = (reports, schoolInfo) => {
    if (!reports || reports.length === 0) {
        toast.error('No marksheet data to print');
        return;
    }

    // Each student wrapped in its own isolation div; break between students, not within
    const pagesHTML = reports.map(r =>
        `<div class="student-wrapper">${generateSingleMarksheetHTML(r, schoolInfo)}</div>`
    ).join('\n');

    const fullHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Consolidated Exams Marksheet</title>
<style>
@page {
    size: A4 portrait;
    margin: 8mm 10mm;
}
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}
html, body {
    background: #fff;
    color: #000;
    font-family: "Times New Roman", Times, serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}
/* Student wrapper: isolates each student's pages from others */
.student-wrapper {
    display: block;
}
/* Each page within a student wrapper */
.marksheet-page {
    width: 100%;
    margin: 0 auto;
    page-break-inside: avoid;
    break-inside: avoid;
    box-sizing: border-box;
    padding: 2px 0;
}
/* Force break AFTER each student (not after last) */
.student-wrapper:not(:last-child) {
    page-break-after: always;
    break-after: page;
}
.marksheet-border {
    border: 2px solid #000;
    border-radius: 12px;
    padding: 14px 18px;
    background: #fff;
    width: 100%;
    margin: 0 auto;
}
.school-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 10px;
    gap: 12px;
}
.logo-box {
    width: 65px;
    height: 65px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.logo-img {
    max-width: 65px;
    max-height: 65px;
    object-fit: contain;
}
.logo-fallback {
    width: 56px;
    height: 56px;
    border: 2px solid #000;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 7px;
    font-weight: 900;
    text-align: center;
    line-height: 1.1;
    background: #f8fafc;
}
.school-text {
    flex: 1;
    text-align: center;
}
.school-title {
    font-size: 22px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1.2;
}
.school-sub {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    margin-top: 2px;
}
.logo-box-spacer {
    width: 65px;
    flex-shrink: 0;
}
.student-info-bar {
    border-bottom: 2px solid #000;
    padding-bottom: 8px;
    margin-bottom: 12px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.info-row {
    display: flex;
    justify-content: space-between;
}
.exam-section {
    margin-bottom: 12px;
}
.exam-title-box {
    text-align: center;
    margin-bottom: 4px;
}
.exam-title {
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.exam-subtitle {
    font-size: 9.5px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-decoration: underline dotted;
    text-underline-offset: 2px;
}
table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    text-align: center;
}
table, th, td {
    border: 1px solid #000;
}
th {
    background-color: #f1f5f9;
    padding: 3px 5px;
    font-weight: 900;
    text-transform: uppercase;
}
td {
    padding: 3px 5px;
}
.font-bold {
    font-weight: bold;
}
.no-exams-box {
    padding: 24px;
    text-align: center;
    border: 1px dashed #666;
    border-radius: 8px;
    font-weight: 800;
    font-size: 12px;
    margin: 12px 0;
}
.signatures-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 16px;
    padding: 0 12px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
}
.sig-box {
    width: 160px;
    text-align: center;
}
.sig-line {
    border-top: 2px dashed #000;
    padding-top: 4px;
    font-weight: 900;
}
.principal-sig-img {
    max-height: 44px;
    max-width: 130px;
    object-fit: contain;
    margin-bottom: 2px;
}
</style>
</head>
<body>
${pagesHTML}
</body>
</html>`;

    let printIframe = document.getElementById('marksheet-print-iframe');
    if (!printIframe) {
        printIframe = document.createElement('iframe');
        printIframe.id = 'marksheet-print-iframe';
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        document.body.appendChild(printIframe);
    }

    const doc = printIframe.contentWindow.document;
    doc.open();
    doc.write(fullHTML);
    doc.close();

    setTimeout(() => {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
    }, 400);
};

// ─── On-Screen Marksheet Card Component ────────────────────────────────────────

const MarksheetCard = ({ result, school }) => {
    const groupedExams = React.useMemo(() => groupExams(result?.exams), [result?.exams]);

    const jeeSubjects = React.useMemo(() => getTableSubjects(groupedExams.jeeExams), [groupedExams.jeeExams]);
    const neetSubjects = React.useMemo(() => getTableSubjects(groupedExams.neetExams), [groupedExams.neetExams]);
    const kcetSubjects = React.useMemo(() => getTableSubjects(groupedExams.kcetExams), [groupedExams.kcetExams]);
    const theorySubjects = React.useMemo(() => getTableSubjects(groupedExams.theoryExams), [groupedExams.theoryExams]);

    const schoolName = school?.name || 'SHRAMA PU SCIENCE COLLEGE.';
    const schoolLocation = school?.address || 'VIDYAGIRI, BAGALKOT.';

    return (
        <div className="student-report-card mb-8">
            <div 
                className="bg-white border-2 border-slate-800 rounded-2xl p-5 md:p-6 max-w-2xl mx-auto shadow-md text-slate-900"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
            >
                {/* Institution Title Header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-slate-900 gap-3">
                    <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                        {school?.logo || school?.logo_url ? (
                            <img 
                                src={school.logo || school.logo_url} 
                                alt="College Logo" 
                                className="max-h-16 max-w-16 object-contain"
                                style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                            />
                        ) : (
                            <div 
                                className="w-14 h-14 rounded-full border-2 border-slate-900 flex flex-col items-center justify-center bg-slate-50 text-center p-1"
                                style={{ width: '56px', height: '56px' }}
                            >
                                <GraduationCap size={16} className="text-slate-900" />
                                <span className="text-[6.5px] font-extrabold text-slate-900 uppercase leading-tight mt-0.5">
                                    COLLEGE<br/>LOGO
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="text-center flex-1">
                        <h1 className="text-xl font-black uppercase tracking-wide text-slate-900 leading-tight">
                            {schoolName}
                        </h1>
                        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-800 mt-0.5">
                            {schoolLocation}
                        </h2>
                    </div>

                    <div className="w-16 flex-shrink-0"></div>
                </div>

                {/* Student Profile Info */}
                <div className="border-b-2 border-slate-900 pb-1.5 mb-3 grid grid-cols-3 gap-1.5 text-left text-[11px] uppercase font-extrabold tracking-wide">
                    <div>CLASS : <span className="text-slate-900 font-bold">{result.student.class_name || '-'}</span></div>
                    <div></div>
                    <div className="text-right">ROLL NO : <span className="text-slate-900 font-bold">{result.student.custom_roll_number || result.student.roll_number || result.student.admission_no || '-'}</span></div>
                    <div className="col-span-3 mt-0.5">STUDENT NAME : <span className="text-slate-900 font-bold">{result.student.name}</span></div>
                </div>

                {/* Fallback if no marks exist */}
                {groupedExams.jeeExams.length === 0 && 
                 groupedExams.neetExams.length === 0 && 
                 groupedExams.kcetExams.length === 0 && 
                 groupedExams.theoryExams.length === 0 && (
                    <div className="py-6 text-center text-slate-600 font-extrabold text-xs uppercase tracking-wider my-3 border border-dashed border-slate-400 rounded-xl">
                        NO EXAM MARKS RECORDED YET FOR THIS STUDENT
                    </div>
                )}

                {/* TABLE 1: JEE EXAMS */}
                {groupedExams.jeeExams.length > 0 && (
                    <div className="mb-3">
                        <div className="text-center mb-1">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">JEE EXAMS MARKS CARD (MAX MARKS – 300)</h3>
                            <p className="text-[9px] font-black uppercase text-slate-800 tracking-widest decoration-dotted underline underline-offset-1">COMPETITIVE TEST RESULTS</p>
                        </div>
                        <div className="border border-slate-900 rounded overflow-hidden">
                            <table className="w-full text-[11px] text-left border-collapse text-slate-900">
                                <thead className="bg-slate-100 text-slate-900 font-extrabold uppercase border-b border-slate-900 text-center">
                                    <tr>
                                        <th className="p-1 border-r border-slate-900 w-12">SL NO</th>
                                        <th className="p-1 border-r border-slate-900 w-24">TEST DATE</th>
                                        {jeeSubjects.map(sub => <th key={sub.name} className="p-1 border-r border-slate-900">{getSubjectDisplayName(sub.name)}</th>)}
                                        <th className="p-1 w-16">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-900 text-center">
                                    {groupedExams.jeeExams.map((exam, index) => {
                                        const dates = getExamDates(exam);
                                        const total = getRowTotal(exam, jeeSubjects);
                                        return (
                                            <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-1 border-r border-slate-900 font-bold">{String(index + 1).padStart(2, '0')}</td>
                                                <td className="p-1 border-r border-slate-900"><div className="flex flex-col">{dates.length > 0 ? dates.map((d, i) => <span key={i}>{d}</span>) : <span>-</span>}</div></td>
                                                {jeeSubjects.map(sub => {
                                                    const subData = getSubjectExamData(exam, sub.name);
                                                    const displayVal = (subData.marks === 'ABSENT' || subData.marks === 'N/A' || subData.marks === 'NA' || subData.marks === null || subData.marks === undefined || subData.marks === '') ? 'N/A' : subData.marks;
                                                    return <td key={sub.name} className="p-1 border-r border-slate-900 font-bold">{displayVal}</td>;
                                                })}
                                                <td className="p-1 font-bold">{total}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TABLE 2: NEET EXAMS */}
                {groupedExams.neetExams.length > 0 && (
                    <div className="mb-3">
                        <div className="text-center mb-1">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">NEET EXAMS MARKS CARD (MAX MARKS – 720)</h3>
                            <p className="text-[9px] font-black uppercase text-slate-800 tracking-widest decoration-dotted underline underline-offset-1">COMPETITIVE TEST RESULTS</p>
                        </div>
                        <div className="border border-slate-900 rounded overflow-hidden">
                            <table className="w-full text-[11px] text-left border-collapse text-slate-900">
                                <thead className="bg-slate-100 text-slate-900 font-extrabold uppercase border-b border-slate-900 text-center">
                                    <tr>
                                        <th className="p-1 border-r border-slate-900 w-12">SL NO</th>
                                        <th className="p-1 border-r border-slate-900 w-24">TEST DATE</th>
                                        {neetSubjects.map(sub => <th key={sub.name} className="p-1 border-r border-slate-900">{getSubjectDisplayName(sub.name)}</th>)}
                                        <th className="p-1 w-16">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-900 text-center">
                                    {groupedExams.neetExams.map((exam, index) => {
                                        const dates = getExamDates(exam);
                                        const total = getRowTotal(exam, neetSubjects);
                                        return (
                                            <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-1 border-r border-slate-900 font-bold">{String(index + 1).padStart(2, '0')}</td>
                                                <td className="p-1 border-r border-slate-900"><div className="flex flex-col">{dates.length > 0 ? dates.map((d, i) => <span key={i}>{d}</span>) : <span>-</span>}</div></td>
                                                {neetSubjects.map(sub => {
                                                    const subData = getSubjectExamData(exam, sub.name);
                                                    const displayVal = (subData.marks === 'ABSENT' || subData.marks === 'N/A' || subData.marks === 'NA' || subData.marks === null || subData.marks === undefined || subData.marks === '') ? 'NA' : subData.marks;
                                                    return <td key={sub.name} className="p-1 border-r border-slate-900 font-bold">{displayVal}</td>;
                                                })}
                                                <td className="p-1 font-bold">{total}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TABLE 3: KCET / CET EXAMS */}
                {groupedExams.kcetExams.length > 0 && (
                    <div className="mb-3">
                        <div className="text-center mb-1">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">KCET EXAMS MARKS CARD (MAX MARKS – 180)</h3>
                            <p className="text-[9px] font-black uppercase text-slate-800 tracking-widest decoration-dotted underline underline-offset-1">COMPETITIVE TEST RESULTS</p>
                        </div>
                        <div className="border border-slate-900 rounded overflow-hidden">
                            <table className="w-full text-[11px] text-left border-collapse text-slate-900">
                                <thead className="bg-slate-100 text-slate-900 font-extrabold uppercase border-b border-slate-900 text-center">
                                    <tr>
                                        <th className="p-1 border-r border-slate-900 w-12">SL NO</th>
                                        <th className="p-1 border-r border-slate-900 w-24">TEST DATE</th>
                                        {kcetSubjects.map(sub => <th key={sub.name} className="p-1 border-r border-slate-900">{getSubjectDisplayName(sub.name)}</th>)}
                                        <th className="p-1 w-16">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-900 text-center">
                                    {groupedExams.kcetExams.map((exam, index) => {
                                        const dates = getExamDates(exam);
                                        const total = getRowTotal(exam, kcetSubjects);
                                        return (
                                            <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-1 border-r border-slate-900 font-bold">{String(index + 1).padStart(2, '0')}</td>
                                                <td className="p-1 border-r border-slate-900"><div className="flex flex-col">{dates.length > 0 ? dates.map((d, i) => <span key={i}>{d}</span>) : <span>-</span>}</div></td>
                                                {kcetSubjects.map(sub => {
                                                    const subData = getSubjectExamData(exam, sub.name);
                                                    const displayVal = (subData.marks === 'ABSENT' || subData.marks === 'N/A' || subData.marks === 'NA' || subData.marks === null || subData.marks === undefined || subData.marks === '') ? 'NA' : subData.marks;
                                                    return <td key={sub.name} className="p-1 border-r border-slate-900 font-bold">{displayVal}</td>;
                                                })}
                                                <td className="p-1 font-bold">{total}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TABLE 4: THEORY UNIT TEST */}
                {groupedExams.theoryExams.length > 0 && (
                    <div className="mb-3">
                        <div className="text-center mb-1">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">THEORY UNIT TEST MARKS LIST</h3>
                            <p className="text-[9px] font-bold text-slate-700">(MAX MARKS – 25)</p>
                        </div>
                        <div className="border border-slate-900 rounded overflow-hidden">
                            <table className="w-full text-[11px] text-left border-collapse text-slate-900">
                                <thead className="bg-slate-100 text-slate-900 font-extrabold uppercase border-b border-slate-900 text-center">
                                    <tr>
                                        <th className="p-1 border-r border-slate-900 w-12">SL NO</th>
                                        <th className="p-1 border-r border-slate-900 w-24">U. T. DATE</th>
                                        {theorySubjects.map(sub => <th key={sub.name} className="p-1 border-r border-slate-900">{getSubjectDisplayName(sub.name)}</th>)}
                                        <th className="p-1 w-16">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-900 text-center">
                                    {groupedExams.theoryExams.map((exam, index) => {
                                        const dates = getExamDates(exam);
                                        const total = getRowTotal(exam, theorySubjects);
                                        return (
                                            <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-1 border-r border-slate-900 font-bold">{String(index + 1).padStart(2, '0')}</td>
                                                <td className="p-1 border-r border-slate-900"><div className="flex flex-col">{dates.length > 0 ? dates.map((d, i) => <span key={i}>{d}</span>) : <span>-</span>}</div></td>
                                                {theorySubjects.map(sub => {
                                                    const subData = getSubjectExamData(exam, sub.name);
                                                    const displayVal = (subData.marks === 'ABSENT' || subData.marks === 'N/A' || subData.marks === 'NA' || subData.marks === null || subData.marks === undefined || subData.marks === '') ? 'NA' : subData.marks;
                                                    return <td key={sub.name} className="p-1 border-r border-slate-900 font-bold">{displayVal}</td>;
                                                })}
                                                <td className="p-1 font-bold">{total}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Footer Signatures */}
                <div className="flex justify-between items-end pt-3 px-3 text-center text-[11px] font-extrabold text-slate-800 tracking-wider uppercase">
                    <div className="w-36">
                        <div className="border-t-2 border-dashed border-slate-700 pt-1">Parent Signature</div>
                    </div>
                    <div className="w-36 flex flex-col items-center">
                        {school?.principal_signature && (
                            <img
                                src={school.principal_signature}
                                alt="Principal Signature"
                                className="h-10 object-contain mb-0.5"
                                style={{ maxHeight: '40px', maxWidth: '120px', objectFit: 'contain' }}
                            />
                        )}
                        <div className="border-t-2 border-dashed border-slate-700 pt-1 text-slate-900 font-black w-full">Principal Signature</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Main AllTestsReport Component ─────────────────────────────────────────────

const AllTestsReport = () => {
    // Mode toggle: 'single' (by Admission Number) or 'multi' (by Class & Section)
    const [mode, setMode] = useState('single');

    // Single mode state
    const [admissionNo, setAdmissionNo] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    // Multi mode state
    const [classes, setClasses] = useState([]);
    const [sections, setSections] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [multiLoading, setMultiLoading] = useState(false);
    const [multiResults, setMultiResults] = useState(null);
    const [classesLoading, setClassesLoading] = useState(false);

    // School details
    const [school, setSchool] = useState(() => {
        try { return JSON.parse(localStorage.getItem('school') || '{}'); } catch { return {}; }
    });

    // Fetch fresh school details on mount
    useEffect(() => {
        const fetchSchoolDetails = async () => {
            try {
                const res = await api.get('/schools/my-school');
                if (res.data) {
                    setSchool(res.data.data || res.data);
                }
            } catch (error) {
                console.error('Error fetching school details:', error);
            }
        };
        fetchSchoolDetails();
    }, []);

    // Fetch classes when in multi mode
    useEffect(() => {
        if (mode !== 'multi') return;
        const fetchClasses = async () => {
            setClassesLoading(true);
            try {
                const res = await api.get('/classes');
                setClasses(res.data || []);
            } catch (error) {
                console.error('Error fetching classes:', error);
                toast.error('Failed to load classes');
            } finally {
                setClassesLoading(false);
            }
        };
        fetchClasses();
    }, [mode]);

    // Fetch sections when selected class changes
    useEffect(() => {
        setSelectedSection('');
        setSections([]);
        if (!selectedClass) return;
        const fetchSections = async () => {
            try {
                const res = await api.get(`/classes/${selectedClass}/sections`);
                setSections(res.data || []);
            } catch (error) {
                console.error('Error fetching sections:', error);
            }
        };
        fetchSections();
    }, [selectedClass]);

    // Single Student Search Handler
    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!admissionNo.trim()) {
            toast.error('Please enter an Admission Number');
            return;
        }

        setLoading(true);
        setResult(null);
        try {
            const res = await api.get('/marks/student-all', {
                params: { admission_no: admissionNo.trim() }
            });
            
            if (res.data) {
                setResult(res.data);
                toast.success('Student records found');
            }
        } catch (error) {
            console.error('Error fetching student result:', error);
            const msg = error.response?.data?.message || 'Failed to fetch results';
            const note = error.response?.data?.note || '';
            toast.error(msg + (note ? ` - ${note}` : ''));
        } finally {
            setLoading(false);
        }
    };

    // Multi Students Class Load Handler
    const handleMultiLoad = async () => {
        if (!selectedClass) {
            toast.error('Please select a class');
            return;
        }

        setMultiLoading(true);
        setMultiResults(null);
        try {
            const params = { class_id: selectedClass };
            if (selectedSection) params.section_id = selectedSection;
            const res = await api.get('/marks/all-tests-report', { params });
            if (res.data) {
                setMultiResults(res.data);
                const count = res.data.studentReports?.length || 0;
                if (count === 0) {
                    toast('No students found for this class/section', { icon: '⚠️' });
                } else {
                    toast.success(`Loaded ${count} student marksheet${count !== 1 ? 's' : ''}`);
                }
            }
        } catch (error) {
            console.error('Error fetching class marks:', error);
            toast.error(error.response?.data?.message || 'Failed to fetch class results');
        } finally {
            setMultiLoading(false);
        }
    };

    // Unified Print Handler using isolated iframe to guarantee 1 student per page
    const handlePrint = () => {
        if (mode === 'single' && result) {
            printMarksheetsViaIframe([result], school);
        } else if (mode === 'multi' && multiResults?.studentReports?.length > 0) {
            printMarksheetsViaIframe(multiResults.studentReports, school);
        } else {
            toast.error('No marksheet records available to print');
        }
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setResult(null);
        setMultiResults(null);
    };

    const hasResults = (mode === 'single' && result) || (mode === 'multi' && multiResults?.studentReports?.length > 0);

    return (
        <div className="space-y-6 h-full flex flex-col font-sans">
            {/* Header section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Sparkles className="text-violet-600 w-5 h-5" /> Consolidated Exams Sheet
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            {mode === 'single'
                                ? 'Search student admission number to view and print individual progress card'
                                : 'Select class to view and bulk print all students progress cards (each student on separate page)'}
                        </p>
                    </div>

                    {/* Mode Toggle Switch: Single / Multi */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 self-start md:self-auto border border-slate-200">
                        <button
                            type="button"
                            onClick={() => switchMode('single')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                mode === 'single'
                                    ? 'bg-white shadow-sm text-violet-700 border border-violet-200'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <User size={13} /> Single Student
                        </button>
                        <button
                            type="button"
                            onClick={() => switchMode('multi')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                mode === 'multi'
                                    ? 'bg-white shadow-sm text-violet-700 border border-violet-200'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Users size={13} /> Multi (Class Print)
                        </button>
                    </div>
                </div>

                {/* Single Mode Search Form */}
                {mode === 'single' && (
                    <form onSubmit={handleSearch} className="flex items-center gap-3 flex-wrap">
                        <div className="relative w-64">
                            <input
                                type="text"
                                value={admissionNo}
                                onChange={e => setAdmissionNo(e.target.value)}
                                placeholder="Enter Admission Number"
                                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none font-medium text-slate-700 bg-slate-50"
                            />
                            <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !admissionNo.trim()}
                            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-md shadow-violet-600/10 flex items-center gap-1.5"
                        >
                            {loading ? <RefreshCw className="animate-spin w-3.5 h-3.5" /> : <Search size={14} />}
                            Search Student
                        </button>
                    </form>
                )}

                {/* Multi Mode Class & Section Selection Form */}
                {mode === 'multi' && (
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Class Dropdown */}
                        <div className="relative">
                            <select
                                value={selectedClass}
                                onChange={e => setSelectedClass(e.target.value)}
                                disabled={classesLoading}
                                className="text-xs pl-3 pr-8 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none font-medium text-slate-700 bg-slate-50 appearance-none min-w-[160px]"
                            >
                                <option value="">{classesLoading ? 'Loading classes...' : 'Select Class'}</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Optional Section Dropdown */}
                        {sections.length > 0 && (
                            <div className="relative">
                                <select
                                    value={selectedSection}
                                    onChange={e => setSelectedSection(e.target.value)}
                                    className="text-xs pl-3 pr-8 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none font-medium text-slate-700 bg-slate-50 appearance-none min-w-[140px]"
                                >
                                    <option value="">All Sections</option>
                                    {sections.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            </div>
                        )}

                        <button
                            type="button"
                            disabled={multiLoading || !selectedClass}
                            onClick={handleMultiLoad}
                            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-md shadow-violet-600/10 flex items-center gap-1.5"
                        >
                            {multiLoading ? <RefreshCw className="animate-spin w-3.5 h-3.5" /> : <Users size={14} />}
                            Load All Students
                        </button>
                    </div>
                )}
            </div>

            {/* Print toolbar */}
            {hasResults && (
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-xs text-slate-500 font-semibold">
                        {mode === 'multi'
                            ? `${multiResults.studentReports.length} student marksheet${multiResults.studentReports.length !== 1 ? 's' : ''} ready to print (1 marksheet per page)`
                            : '1 marksheet ready to print'}
                    </p>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-slate-900/10"
                    >
                        <Printer size={15} /> {mode === 'multi' ? 'Print All Students Marksheets' : 'Print Marksheet'}
                    </button>
                </div>
            )}

            {/* Main Area */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[300px]">
                {/* Loading state */}
                {(loading || multiLoading) && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
                        <RefreshCw className="animate-spin text-violet-600 w-8 h-8" />
                        <p className="text-sm font-semibold">
                            {multiLoading ? 'Fetching all student records and aggregating marks...' : 'Fetching and aggregating marks history...'}
                        </p>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !multiLoading && !result && !multiResults && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                        <FileText size={48} className="text-slate-300 stroke-[1.5]" />
                        <p className="text-sm font-medium">
                            {mode === 'single'
                                ? 'Enter student admission number above to fetch results'
                                : 'Select a class above and click "Load All Students" to fetch all marksheets'}
                        </p>
                    </div>
                )}

                {/* Single Student Marksheet Display */}
                {!loading && mode === 'single' && result && (
                    <div className="flex-1 overflow-auto p-4 md:p-6">
                        <MarksheetCard result={result} school={school} />
                    </div>
                )}

                {/* Multi Students Marksheets Display */}
                {!multiLoading && mode === 'multi' && multiResults && multiResults.studentReports?.length > 0 && (
                    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
                        {multiResults.studentReports.map((item) => (
                            <MarksheetCard
                                key={item.student.id}
                                result={item}
                                school={school}
                            />
                        ))}
                    </div>
                )}

                {/* Multi Mode - Zero Students Found */}
                {!multiLoading && mode === 'multi' && multiResults && multiResults.studentReports?.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                        <AlertCircle size={40} className="text-slate-300" />
                        <p className="text-sm font-medium">No students found for this class / section.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AllTestsReport;
