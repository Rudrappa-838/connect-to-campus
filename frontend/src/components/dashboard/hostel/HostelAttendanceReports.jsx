import React, { useState, useEffect } from 'react';
import { Calendar, Printer, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

const HostelAttendanceReports = () => {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [hostels, setHostels] = useState([]);
    const [selectedHostel, setSelectedHostel] = useState('');
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState('');
    const [report, setReport] = useState([]);

    const daysInMonth = new Date(year, month, 0).getDate();
    const dates = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    useEffect(() => { fetchHostels(); }, []);

    const fetchHostels = async () => {
        try {
            const res = await api.get('/hostel');
            setHostels(res.data);
            if (res.data.length > 0) setSelectedHostel(res.data[0].id);
        } catch { toast.error('Failed to load hostels'); }
    };

    useEffect(() => {
        if (selectedHostel) fetchRooms(selectedHostel);
        else setRooms([]);
    }, [selectedHostel]);

    const fetchRooms = async (hostelId) => {
        try {
            const res = await api.get(`/hostel/${hostelId}/rooms`);
            setRooms(res.data);
        } catch { toast.error('Failed to load rooms'); }
    };

    useEffect(() => {
        if (selectedHostel && month && year) {
            fetchReport();
        }
    }, [selectedHostel, selectedRoom, month, year]);

    const fetchReport = async () => {
        try {
            const params = { hostel_id: selectedHostel, month, year };
            if (selectedRoom) params.room_id = selectedRoom;

            const res = await api.get('/hostel/attendance/monthly', { params });

            const processed = {};
            res.data.forEach(row => {
                if (!processed[row.student_id]) processed[row.student_id] = {
                    name: row.name,
                    room: row.room_number,
                    attendance: {},
                    totalP: 0,
                    totalA: 0
                };
                if (row.date) {
                    const dateParts = row.date.split('T')[0].split('-');
                    const d = parseInt(dateParts[2], 10);
                    processed[row.student_id].attendance[d] = row.status;
                    if (row.status === 'Present') processed[row.student_id].totalP++;
                    else if (row.status === 'Absent') processed[row.student_id].totalA++;
                }
            });

            const finalReport = Object.values(processed);
            setReport(finalReport);
        } catch (error) {
            console.error('Failed to load report:', error);
            toast.error('Failed to fetch report');
        }
    };

    const handlePrint = () => {
        const hostelName = hostels.find(h => h.id === parseInt(selectedHostel))?.name || '';
        const roomName = rooms.find(r => r.id === parseInt(selectedRoom))?.room_number || 'All Rooms';
        const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Hostel Attendance - ${hostelName} - ${monthName} ${year}</title>
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
                <h1>Hostel Attendance Report</h1>
                <h2>${hostelName} | Room: ${roomName} | ${monthName} ${year}</h2>
                <table>
                    <thead>
                        <tr>
                            <th class="name">Student Name</th>
                            <th>Room</th>
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
                                <td>${student.room}</td>
                                ${dates.map(d => {
                                    const status = student.attendance[d];
                                    const isSunday = new Date(year, month - 1, d).getDay() === 0;
                                    let cls = '';
                                    let content = '-';
                                    
                                    if (isSunday) { cls = 's'; content = 'S'; }
                                    else if (status === 'Present') { cls = 'p'; content = 'P'; }
                                    else if (status === 'Absent') { cls = 'a'; content = 'A'; }
                                    else if (status === 'Late') { cls = 'l'; content = 'L'; }
                                    
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
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
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

                <select className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 min-w-[150px] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" 
                    value={selectedHostel} onChange={e => setSelectedHostel(e.target.value)}>
                    <option value="">Select Hostel</option>
                    {hostels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>

                {rooms.length > 0 && (
                    <select
                        className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 min-w-[150px] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        value={selectedRoom}
                        onChange={e => setSelectedRoom(e.target.value)}
                    >
                        <option value="">All Rooms</option>
                        {rooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
                    </select>
                )}
                {report.length > 0 && (
                    <button
                        onClick={handlePrint}
                        className="bg-slate-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-slate-500/20 hover:bg-slate-700 active:scale-95 transition-all flex items-center gap-2 ml-auto"
                    >
                        <Printer size={18} /> Print
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {selectedHostel ? (
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-xs border-collapse table-fixed min-w-[800px]">
                            <thead>
                                <tr>
                                    <th className="p-2 border-b border-slate-200 text-left w-32 bg-slate-50 font-bold text-slate-600 uppercase tracking-wider text-[10px] sticky left-0 z-10 shadow-[1px_0_0_#e2e8f0]">Student Name</th>
                                    <th className="p-2 border-b border-l border-slate-200 text-left w-16 bg-slate-50 font-bold text-slate-600 uppercase tracking-wider text-[10px]">Room</th>
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
                                        <td className="p-2 border-b border-slate-100 font-medium text-slate-700 text-[11px] truncate bg-white sticky left-0 z-10 shadow-[1px_0_0_#e2e8f0]" title={student.name}>
                                            {student.name}
                                        </td>
                                        <td className="p-2 border-l border-b border-slate-100 font-medium text-slate-500 text-[11px] text-center">
                                            {student.room}
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
                                                content = 'S';
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
                                    <tr><td colSpan={dates.length + 4} className="p-12 text-center text-slate-400">No attendance data found for this selection</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-20 text-center flex flex-col items-center justify-center text-slate-400">
                        <Calendar size={48} className="text-slate-200 mb-4" />
                        <p className="text-lg font-medium text-slate-500">View Attendance Report</p>
                        <p className="text-sm">Please select a hostel to view the monthly report</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HostelAttendanceReports;
