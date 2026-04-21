import React, { useState, useEffect } from 'react';
import { Calendar, Printer } from 'lucide-react';
import api from '../../../api/axios';

const StudentAttendanceReports = ({ config }) => {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [filterClass, setFilterClass] = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [report, setReport] = useState([]);

    // Generate dates for the selected month
    const daysInMonth = new Date(year, month, 0).getDate();
    const dates = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Sort classes numerically
    const sortedClasses = React.useMemo(() => {
        return [...(config.classes || [])].sort((a, b) => {
            const numA = parseInt(a.class_name.replace(/\D/g, '') || '0', 10);
            const numB = parseInt(b.class_name.replace(/\D/g, '') || '0', 10);
            return numA === numB ? a.class_name.localeCompare(b.class_name) : numA - numB;
        });
    }, [config.classes]);

    const availableSections = sortedClasses.find(c => c.class_id === parseInt(filterClass))?.sections || [];

    // Auto-select section
    useEffect(() => {
        if (filterClass && availableSections.length > 0) {
            setFilterSection(availableSections[0].id);
        } else {
            setFilterSection('');
        }
    }, [filterClass]);

    useEffect(() => {
        const hasSections = availableSections.length > 0;
        if (filterClass && (filterSection || !hasSections)) {
            fetchReport();
        }
    }, [filterClass, filterSection, month, year]);

    const fetchReport = async () => {
        try {
            const params = { class_id: filterClass, month, year };
            if (filterSection) params.section_id = filterSection;

            const res = await api.get('/students/attendance', { params });
            console.log('Raw attendance data:', res.data); // Debug

            // Process data for grid: keys: student_id, values: { name, attendance: { date: status } }
            const processed = {};
            res.data.forEach(row => {
                if (!processed[row.student_id]) processed[row.student_id] = {
                    name: row.name,
                    attendance: {},
                    totalP: 0,
                    totalA: 0,
                    workingDays: 0
                };
                if (row.date) {
                    // Fix timezone issue by parsing YYYY-MM-DD directly
                    const dateParts = row.date.split('T')[0].split('-');
                    const d = parseInt(dateParts[2]);
                    processed[row.student_id].attendance[d] = row.status;
                    if (row.status === 'Present') processed[row.student_id].totalP++;
                    else if (row.status === 'Absent') processed[row.student_id].totalA++;

                    if (row.status !== 'Holiday') {
                        processed[row.student_id].workingDays++;
                    }
                }
            });

            const finalReport = Object.values(processed);
            console.log('Processed report:', finalReport); // Debug
            setReport(finalReport);
        } catch (error) {
            console.error('Failed to load report:', error);
        }
    };

    const handlePrint = () => {
        const className = config.classes?.find(c => c.class_id === parseInt(filterClass))?.class_name || '';
        const sectionName = availableSections.find(s => s.id === parseInt(filterSection))?.name || '';
        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Attendance Report - ${className} ${sectionName} - ${monthName} ${year}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; padding: 20px; background: white; }
                    h1 { text-align: center; color: #333; font-size: 20px; margin-bottom: 5px; }
                    h2 { text-align: center; color: #666; font-size: 16px; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th, td { border: 1px solid #ddd; padding: 6px; text-align: center; }
                    th { background-color: #4f46e5; color: white; font-weight: bold; }
                    th.name { text-align: left; min-width: 150px; }
                    .p { background-color: #d1fae5; color: #065f46; font-weight: bold; }
                    .a { background-color: #fee2e2; color: #991b1b; font-weight: bold; }
                    .l { background-color: #fef3c7; color: #92400e; font-weight: bold; }
                    .total-p { background-color: #d1fae5; font-weight: bold; }
                    .total-a { background-color: #fee2e2; font-weight: bold; }
                    .h { background-color: #f3f4f6; color: #374151; font-weight: bold; }
                    .s { background-color: #fee2e2; color: #991b1b; font-weight: bold; }
                    @media print {
                        body { padding: 10px; }
                        @page { margin: 0.5cm; size: landscape; }
                    }
                </style>
            </head>
            <body>
                <h1>Attendance Report</h1>
                <h2>${className} - ${sectionName} | ${monthName} ${year}</h2>
                <table>
                    <thead>
                        <tr>
                            <th class="name">Student Name</th>
                            ${dates.map(d => {
                                const dayName = new Date(year, month - 1, d).toLocaleDateString('en-US', { weekday: 'narrow' });
                                const isSunday = new Date(year, month - 1, d).getDay() === 0;
                                return `<th style="${isSunday ? 'color: #ef4444; background: #fef2f2;' : ''}">${dayName}<br/><span style="font-size: 8px; font-weight: normal; opacity: 0.8">${d}</span></th>`;
                            }).join('')}
                            <th class="total-p">P</th>
                            <th class="total-a">A</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.map(student => `
                            <tr>
                                <td style="text-align: left;">${student.name}</td>
                                 ${dates.map(d => {
            const status = student.attendance[d];
            const isSunday = new Date(year, month - 1, d).getDay() === 0;
            let cls = '';
            let content = '-';
            
            if (isSunday) { cls = 's'; content = 'S'; }
            else if (status === 'Present') { cls = 'p'; content = 'P'; }
            else if (status === 'Absent') { cls = 'a'; content = 'A'; }
            else if (status === 'Late') { cls = 'l'; content = 'L'; }
            else if (status === 'Holiday') { cls = 'h'; content = 'H'; }
            
            return `<td class="${cls}">${content}</td>`;
        }).join('')}
                                <td class="total-p">${student.totalP}</td>
                                <td class="total-a">${student.totalA}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-wrap items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                    <Calendar size={18} className="text-slate-400" />
                    <select className="bg-transparent text-sm outline-none font-bold text-slate-700 cursor-pointer" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                        {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                    </select>
                    <div className="w-px h-4 bg-slate-300 mx-2"></div>
                    <select className="bg-transparent text-sm outline-none font-bold text-slate-700 cursor-pointer" value={year} onChange={e => setYear(parseInt(e.target.value))}>
                        {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                <select className="input max-w-[200px] bg-slate-50 border-slate-200" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
                    <option value="">Select Class</option>
                    {sortedClasses.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                </select>
                {availableSections.length > 0 && (
                    <select
                        className="input max-w-[200px] disabled:bg-slate-100 disabled:text-slate-400 bg-slate-50 border-slate-200"
                        value={filterSection}
                        onChange={e => setFilterSection(e.target.value)}
                        disabled={availableSections.length === 0}
                    >
                        <option value="">Select Section</option>
                        {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                )}
                {report.length > 0 && (
                    <button
                        onClick={handlePrint}
                        className="bg-slate-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-500/20 hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Printer size={20} /> Print Report
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {filterClass && (filterSection || availableSections.length === 0) ? (
                    <div className="w-full">
                        <table className="w-full text-xs border-collapse table-fixed">
                            <thead>
                                <tr>
                                    <th className="p-2 border-b border-slate-200 text-left w-40 bg-slate-50 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Student Name</th>
                                    {dates.map(d => {
                                        const dayName = new Date(year, month - 1, d).toLocaleDateString('en-US', { weekday: 'narrow' });
                                        const isSunday = new Date(year, month - 1, d).getDay() === 0;
                                        return (
                                            <th key={d} className={`border-b border-l border-slate-100 text-center font-semibold bg-slate-50/50 text-[9px] p-0.5 ${isSunday ? 'text-red-500 bg-red-50/30' : 'text-slate-500'}`}>
                                                <div className="flex flex-col items-center">
                                                    <span>{dayName}</span>
                                                    <span className="text-[8px] opacity-70">{d}</span>
                                                </div>
                                            </th>
                                        );
                                    })}
                                    <th className="border-b border-l border-slate-200 bg-emerald-50 text-emerald-700 font-bold w-8 text-center text-[10px] p-0.5">P</th>
                                    <th className="border-b border-slate-200 bg-rose-50 text-rose-700 font-bold w-8 text-center text-[10px] p-0.5">A</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {report.map((student, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                                        <td className="p-2 border-b border-slate-100 font-medium text-slate-700 text-[11px] truncate" title={student.name}>
                                            {student.name}
                                        </td>
                                        {dates.map(d => {
                                            const status = student.attendance[d];
                                            let bg = '';
                                            let text = '';
                                            let content = '';

                                            const isSunday = new Date(year, month - 1, d).getDay() === 0;

                                             if (isSunday) {
                                                bg = 'bg-red-50';
                                                text = 'text-red-600';
                                                content = 'S'; // Sunday prioritized
                                            } else if (status === 'Present') {
                                                bg = 'bg-emerald-100/70';
                                                text = 'text-emerald-700';
                                                content = 'P';
                                            } else if (status === 'Absent') {
                                                bg = 'bg-rose-100/70';
                                                text = 'text-rose-700';
                                                content = 'A';
                                            } else if (status === 'Late') {
                                                bg = 'bg-amber-100/70';
                                                text = 'text-amber-700';
                                                content = 'L';
                                            } else if (status === 'Holiday') {
                                                bg = 'bg-slate-100/70';
                                                text = 'text-slate-700';
                                                content = 'H';
                                            } else {
                                                content = '-';
                                                text = 'text-slate-200';
                                            }

                                            return (
                                                <td key={d} className="border-l border-slate-100 text-center h-8 p-0">
                                                    <div className={`w-full h-full flex items-center justify-center font-bold text-[9px] ${bg} ${text}`}>
                                                        {content}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td className="border-l border-slate-100 text-center font-bold text-emerald-600 bg-emerald-50/30 text-[10px] p-0.5">{student.totalP || 0}</td>
                                        <td className="border-l border-slate-100 text-center font-bold text-rose-600 bg-rose-50/30 text-[10px] p-0.5">{student.totalA || 0}</td>
                                    </tr>
                                ))}
                                {report.length === 0 && (
                                    <tr><td colSpan={dates.length + 3} className="p-12 text-center text-slate-400">No attendance data found for this selection</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-20 text-center flex flex-col items-center justify-center text-slate-400">
                        <Calendar size={48} className="text-slate-200 mb-4" />
                        <p className="text-lg font-medium text-slate-500">View Attendance Report</p>
                        <p className="text-sm">Please select Class and Section to view the monthly report</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentAttendanceReports;
