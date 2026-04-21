import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, DollarSign, Calendar, CheckCircle, Printer, X, CreditCard } from 'lucide-react';
import api from '../../../api/axios';
import { useReactToPrint } from 'react-to-print';

const StaffSalarySlips = () => {
    const [slips, setSlips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedSlip, setSelectedSlip] = useState(null);
    const [loadingSlip, setLoadingSlip] = useState(false);
    const slipRef = useRef();
    const [schoolName, setSchoolName] = useState('');
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [slipsRes, schoolRes, profileRes] = await Promise.all([
                api.get('/staff/salary/history'),
                api.get('/schools/my-school'),
                api.get('/staff/profile')
            ]);
            setSlips(slipsRes.data);
            setSchoolName(schoolRes.data.name);
            setProfile(profileRes.data);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: slipRef,
        documentTitle: selectedSlip ? `Salary_Slip_${selectedSlip.month}_${selectedSlip.year}` : 'Salary_Slip',
    });

    const openSlip = async (slip) => {
        setLoadingSlip(true);
        setModalOpen(true);
        setSelectedSlip(null);

        try {
            const attRes = await api.get('/staff/attendance/my', {
                params: { month: slip.month, year: slip.year }
            });
            const attData = attRes.data || [];
            const working = attData.length;
            const absent = attData.filter(d => d.status === 'Absent').length;

            setSelectedSlip({ ...slip, stats: { working, absent } });
        } catch (e) {
            console.error("Failed to fetch slip details", e);
            setSelectedSlip({ ...slip, stats: { working: 'N/A', absent: 'N/A' } });
        } finally {
            setLoadingSlip(false);
        }
    };

    const getMonthName = (m) => new Date(0, m - 1).toLocaleString('default', { month: 'long' });

    if (loading) return <div className="p-12 text-center text-slate-400">Loading records...</div>;

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header / Summary */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold flex items-center gap-3">
                            <DollarSign className="w-8 h-8 opacity-80" /> My Salary Slips
                        </h2>
                        <p className="text-emerald-100 mt-2 font-medium">View and download your monthly payment records.</p>
                        {profile && <p className="text-xs text-emerald-200 mt-1 font-mono">ID: {profile.employee_id}</p>}
                    </div>
                    <div className="hidden md:block bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                        <div className="text-xs font-bold text-emerald-100 uppercase mb-1">Last Payment</div>
                        <div className="text-2xl font-black">{slips.length > 0 ? `₹${slips[0].amount.toLocaleString()}` : '-'}</div>
                        <div className="text-xs text-emerald-200 mt-1">
                            {slips.length > 0 ? `${getMonthName(slips[0].month)} ${slips[0].year}` : 'No records'}
                        </div>
                    </div>
                </div>
                {/* Decorative Circles */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-black/10 rounded-full blur-3xl"></div>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-100">
                            <tr>
                                <th className="p-5 pl-8">Month/Year</th>
                                <th className="p-5">Net Pay</th>
                                <th className="p-5">Mode</th>
                                <th className="p-5">Status</th>
                                <th className="p-5 text-right pr-8">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {slips.length === 0 ? (
                                <tr><td colSpan={5} className="p-12 text-center flex flex-col items-center justify-center text-slate-400">
                                    <FileText size={48} className="mb-4 opacity-20" />
                                    No salary slips found.
                                </td></tr>
                            ) : (
                                slips.map((slip) => (
                                    <tr key={slip.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-5 pl-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                                                    {getMonthName(slip.month).substring(0, 3)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-700">{getMonthName(slip.month)} {slip.year}</div>
                                                    <div className="text-xs text-slate-400 font-mono">ID: #{slip.id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5 font-mono font-bold text-emerald-700">₹{slip.amount.toLocaleString()}</td>
                                        <td className="p-5capitalize text-slate-600">{slip.payment_mode || 'Bank Transfer'}</td>
                                        <td className="p-5">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                <CheckCircle size={12} /> {slip.status}
                                            </span>
                                        </td>
                                        <td className="p-5 text-right pr-8">
                                            <button
                                                onClick={() => openSlip(slip)}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-xs font-bold rounded-lg transition-all shadow-sm"
                                            >
                                                <FileText size={14} /> View Slip
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PAY SLIP MODAL */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-700">Salary Slip Preview</h3>
                            <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                            {loadingSlip || !selectedSlip ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                                    Loading details...
                                </div>
                            ) : (
                                <div ref={slipRef} className="bg-white p-8 shadow-sm border border-slate-200 mx-auto max-w-lg print:shadow-none print:border-none print:p-0">
                                    {/* SLIP LAYOUT */}
                                    <div className="text-center mb-6 border-b-2 border-slate-800 pb-4">
                                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide">{schoolName || 'SCHOOL NAME'}</h1>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Salary Slip</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-4 text-sm mb-6">
                                        <div>
                                            <p className="text-[10px] uppercase text-slate-400 font-bold">Slip Number</p>
                                            <p className="font-bold text-slate-800">SLIP-{selectedSlip.id.toString().padStart(6, '0')}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase text-slate-400 font-bold">Date</p>
                                            <p className="font-bold text-slate-800">{new Date(selectedSlip.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-slate-400 font-bold">Employee ID</p>
                                            <p className="font-bold text-slate-800">{profile?.employee_id || 'N/A'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase text-slate-400 font-bold">Month / Year</p>
                                            <p className="font-bold text-slate-800">{new Date(selectedSlip.year, selectedSlip.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                                        </div>
                                    </div>

                                    { /* Attendance Stats Removed */}

                                    <div className="space-y-3 border-t border-slate-100 pt-4">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500 font-medium">Payment Mode</span>
                                            <span className="font-bold text-slate-800 capitalize">{selectedSlip.payment_mode || 'Bank Transfer'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500 font-medium">Status</span>
                                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs uppercase">{selectedSlip.status}</span>
                                        </div>
                                        <div className="border-t border-dashed border-slate-200 my-4"></div>
                                        <div className="flex justify-between items-center text-lg">
                                            <span className="font-black text-slate-700">NET PAY</span>
                                            <span className="font-black text-emerald-600">₹{selectedSlip.amount.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="mt-8 text-center">
                                        <p className="text-[10px] text-slate-400 uppercase font-medium">This is a system generated slip.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                            <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-bold text-sm hover:bg-slate-50 rounded-xl transition-colors">
                                Close
                            </button>
                            <button
                                onClick={handlePrint}
                                disabled={!selectedSlip}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                            >
                                <Printer size={18} /> Print / Save PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffSalarySlips;
