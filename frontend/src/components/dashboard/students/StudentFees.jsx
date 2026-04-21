import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, AlertCircle, CheckCircle, Clock, Eye, Printer, X } from 'lucide-react';
import api from '../../../api/axios';
import { useReactToPrint } from 'react-to-print';

const StudentFees = ({ student, schoolName }) => {
    const [fees, setFees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState([]);
    // State for the selected receipt to show in the modal
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    // Ref for the receipt content to be printed
    const receiptRef = useRef();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statusRes, historyRes] = await Promise.all([
                    api.get('/fees/my-status'),
                    api.get('/students/my-fees')
                ]);
                setFees(statusRes.data);
                setHistory(historyRes.data.paymentHistory || []);
            } catch (error) {
                console.error("Failed to load fee data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Function to format date as dd-mm-yyyy
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    };

    // Print handler using react-to-print
    const handlePrint = useReactToPrint({
        content: () => receiptRef.current,
        documentTitle: selectedReceipt ? `Receipt_${selectedReceipt.receipt_no}` : 'Receipt',
    });

    if (loading) return <div className="p-8 text-center text-slate-500">Loading fee details...</div>;

    const totalDue = fees.reduce((sum, f) => sum + parseFloat(f.balance), 0);

    return (
        <div className="space-y-8 animate-in fade-in">
            {/* Summary Card */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex justify-between items-center">
                <div>
                    <p className="text-slate-400 font-medium mb-1">Total Outstanding Fees</p>
                    <h2 className="text-4xl font-black">₹{totalDue.toLocaleString()}</h2>
                </div>
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                    <DollarSign size={32} className="text-emerald-400" />
                </div>
            </div>

            {/* Fee List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">Fee Structure & Status</h3>
                        <p className="text-xs text-slate-500 mt-1">Breakdown of applicable fees and their payment status</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Fee Title</th>
                                <th className="px-6 py-4">Due Date</th>
                                <th className="px-6 py-4 text-right">Total Amount</th>
                                <th className="px-6 py-4 text-right">Paid</th>
                                <th className="px-6 py-4 text-right">Balance</th>
                                <th className="px-6 py-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {fees.length > 0 ? (
                                fees.map((fee) => (
                                    <tr key={fee.fee_structure_id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800">{fee.title}</div>
                                            <div className="text-xs text-slate-400 font-medium">{fee.type === 'CLASS_DEFAULT' ? 'Class Fee' : 'Individual Fee'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 text-sm font-medium">
                                            {formatDate(fee.due_date)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-800">
                                            ₹{parseFloat(fee.total_amount).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-emerald-600">
                                            ₹{parseFloat(fee.paid_amount).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-rose-600">
                                            ₹{parseFloat(fee.balance).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${fee.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                fee.status === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                    'bg-rose-50 text-rose-700 border-rose-100'
                                                }`}>
                                                {fee.status === 'Paid' && <CheckCircle size={12} />}
                                                {fee.status === 'Partial' && <Clock size={12} />}
                                                {fee.status === 'Unpaid' && <AlertCircle size={12} />}
                                                {fee.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                                        No fee records found for the current session.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payment History / Receipts */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-lg text-slate-800">Payment History (Receipts)</h3>
                    <p className="text-xs text-slate-500 mt-1">Record of all successful transactions</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Receipt No</th>
                                <th className="px-6 py-4">Fee Type</th>
                                <th className="px-6 py-4">Method</th>
                                <th className="px-6 py-4 text-right">Amount Paid</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {history.length > 0 ? (
                                history.map((record, index) => (
                                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-slate-600 font-medium">
                                            {formatDate(record.date)}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">
                                            {record.receipt_no || '-'}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-800">
                                            {record.feeType}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 text-sm capitalize">
                                            {record.payment_method}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-emerald-600">
                                            ₹{parseFloat(record.amount).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => setSelectedReceipt(record)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                                                title="View Receipt"
                                            >
                                                <Eye size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                                        No payment history found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="text-center text-xs text-slate-400 mt-4">
                Note: Online fee payment is currently disabled. Please visit the school office for payments.
            </p>

            {/* Receipt Modal */}
            {selectedReceipt && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed print:inset-0">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh] print:shadow-none print:w-full print:max-w-none print:h-auto print:rounded-none">

                        {/* Modal Header - Hidden in Print */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center print:hidden">
                            <h3 className="font-bold text-lg text-slate-800">Receipt Details (v2)</h3>
                            <button
                                onClick={() => setSelectedReceipt(null)}
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Receipt Content - Scrollable */}
                        <div className="overflow-y-auto p-6 flex-1 bg-slate-50 print:p-0 print:bg-white print:overflow-visible">
                            <div
                                ref={receiptRef}
                                className="bg-white p-8 shadow-sm border border-slate-200 mx-auto max-w-sm print:shadow-none print:border-none print:max-w-none"
                                style={{ fontFamily: "'Courier New', Courier, monospace" }}
                            >
                                <div className="text-center mb-6">
                                    <h1 className="text-xl font-bold uppercase text-slate-900 m-0">Payment Receipt</h1>
                                    <div className="text-sm font-bold text-slate-600 mt-1 mb-4">{schoolName || 'School Name'}</div>
                                    <div className="inline-block bg-slate-800 text-white px-3 py-1 text-xs font-bold rounded mb-4">
                                        RECEIPT #{selectedReceipt.receipt_no || 'N/A'}
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between border-b border-dashed border-slate-200 pb-2">
                                        <span className="font-bold text-slate-500 text-xs">Date:</span>
                                        <span className="font-bold text-slate-900">{new Date(selectedReceipt.date).toLocaleDateString('en-GB')}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-slate-200 pb-2">
                                        <span className="font-bold text-slate-500 text-xs">Student Name:</span>
                                        <span className="font-bold text-slate-900">{student?.name || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-slate-200 pb-2">
                                        <span className="font-bold text-slate-500 text-xs">Admission No:</span>
                                        <span className="font-bold text-slate-900">{student?.admission_no || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-slate-200 pb-2">
                                        <span className="font-bold text-slate-500 text-xs">Class:</span>
                                        <span className="font-bold text-slate-900">{student?.class_name || ''} {student?.section_name || ''}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-slate-200 pb-2">
                                        <span className="font-bold text-slate-500 text-xs">Fee Type:</span>
                                        <span className="font-bold text-slate-900">{selectedReceipt.feeType}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-dashed border-slate-200 pb-2">
                                        <span className="font-bold text-slate-500 text-xs">Payment Method:</span>
                                        <span className="font-bold text-slate-900 capitalize">{selectedReceipt.payment_method}</span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-4 border border-dashed border-slate-800 mt-6 mb-6">
                                    <div className="text-xs text-slate-500 mb-1">Total Amount Paid</div>
                                    <div className="text-2xl font-bold text-emerald-600">
                                        ₹{parseFloat(selectedReceipt.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>

                                <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-4 text-center">
                                    <p>This is a computer-generated receipt.</p>
                                    <p>Generated on: {new Date().toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer - Hidden in Print */}
                        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 rounded-b-2xl print:hidden">
                            <button
                                onClick={() => setSelectedReceipt(null)}
                                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={handlePrint}
                                className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
                            >
                                <Printer size={18} />
                                Print Receipt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentFees;
