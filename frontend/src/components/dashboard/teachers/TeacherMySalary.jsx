import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, Download, User, Calendar, DollarSign, CheckCircle, Printer, X, FileText } from 'lucide-react';
import api from '../../../api/axios';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';

const TeacherMySalary = () => {
    const [salaryData, setSalaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedSlip, setSelectedSlip] = useState(null);
    const [loadingSlip, setLoadingSlip] = useState(false);
    const slipRef = useRef();
    const [schoolName, setSchoolName] = useState('');

    useEffect(() => {
        fetchSalary();
        fetchSchoolName();
    }, []);

    const fetchSalary = async () => {
        try {
            const res = await api.get('/salary/my-salary');
            setSalaryData(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSchoolName = async () => {
        try {
            const res = await api.get('/schools/my-school');
            setSchoolName(res.data.name);
        } catch (e) {
            console.error(e);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: slipRef,
        documentTitle: selectedSlip ? `Salary_Slip_${selectedSlip.month}_${selectedSlip.year}` : 'Salary_Slip',
    });

    const openSlip = async (payment) => {
        setLoadingSlip(true);
        setModalOpen(true);
        setSelectedSlip(null); // Clear previous

        try {
            // Fetch Attendance Stats for that month
            const attRes = await api.get('/teachers/attendance/my', {
                params: { month: payment.month, year: payment.year }
            });
            const attData = attRes.data || [];

            // Calculate Stats
            const working = attData.length;
            // Assuming default weekend excluded, or just count recorded days
            const absent = attData.filter(d => d.status === 'Absent').length;

            setSelectedSlip({ ...payment, stats: { working, absent } });
        } catch (e) {
            console.error("Failed to fetch slip details", e);
            setSelectedSlip({ ...payment, stats: { working: 'N/A', absent: 'N/A' } });
        } finally {
            setLoadingSlip(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-slate-400">Loading salary information...</div>;

    if (!salaryData) return (
        <div className="p-12 text-center border-2 border-dashed border-slate-300 rounded-2xl">
            <h3 className="text-lg font-bold text-slate-500">Salary Information Unavailable</h3>
            <p className="text-slate-400 text-sm mt-1">Please contact the admin if you believe this is an error.</p>
        </div>
    );

    const { profile, salary_history } = salaryData;

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header / Current Status */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                    <div>
                        <h2 className="text-2xl font-bold mb-1">My Salary Portal</h2>
                        <div className="flex items-center gap-4 text-indigo-100 text-sm font-medium">
                            <span className="flex items-center gap-1"><User size={14} /> ID: {profile.employee_id || 'N/A'}</span>
                            <span className="flex items-center gap-1"><User size={14} /> Type: {profile.employee_type}</span>
                        </div>
                    </div>

                    <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 border border-white/20">
                        <div className="text-xs text-indigo-100 font-bold uppercase tracking-wider mb-1">Most Recent Payment</div>
                        {salary_history.length > 0 ? (
                            <div>
                                <div className="text-2xl font-bold">₹{salary_history[0].amount}</div>
                                <div className="text-xs text-indigo-100 mt-1 flex items-center gap-1">
                                    <CheckCircle size={10} /> Paid on {new Date(salary_history[0].payment_date).toLocaleDateString('en-GB')}
                                </div>
                            </div>
                        ) : (
                            <div className="text-lg font-bold opacity-75">No payments yet</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Payment History List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <CreditCard className="text-indigo-500" size={18} /> Payment History
                    </h3>
                </div>

                {salary_history.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                        {salary_history.map((payment) => (
                            <div key={payment.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg shadow-sm">
                                        ₹
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-lg">
                                            {new Date(payment.year, payment.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                        </div>
                                        <div className="text-xs text-slate-500 font-medium mt-1">
                                            Processed on {new Date(payment.payment_date).toLocaleDateString('en-GB')}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-end md:items-center gap-6 w-full md:w-auto mt-2 md:mt-0">
                                    <div className="text-right">
                                        <div className="text-sm text-slate-400 font-medium mb-0.5 uppercase text-[10px]">Net Pay</div>
                                        <div className="font-bold text-emerald-600 text-xl">₹{payment.amount}</div>
                                    </div>

                                    <div className="hidden md:block w-px h-10 bg-slate-200"></div>

                                    <div className="text-right min-w-[100px]">
                                        <div className="text-sm text-slate-400 font-medium mb-0.5 uppercase text-[10px]">Mode</div>
                                        <div className="font-bold text-slate-700 text-sm capitalize">{payment.payment_mode || 'Bank Transfer'}</div>
                                    </div>

                                    <button
                                        onClick={() => openSlip(payment)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                        title="View Slip"
                                    >
                                        <FileText size={20} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                        <div className="bg-slate-50 p-4 rounded-full mb-3">
                            <DollarSign className="w-6 h-6 text-slate-300" />
                        </div>
                        <p>No payment history found.</p>
                    </div>
                )}
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
                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50" >
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
                                            <p className="font-bold text-slate-800">{new Date(selectedSlip.payment_date).toLocaleDateString('en-GB')}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-slate-400 font-bold">Employee ID</p>
                                            <p className="font-bold text-slate-800">{profile.employee_id}</p>
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

export default TeacherMySalary;
