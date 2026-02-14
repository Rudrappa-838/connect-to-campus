import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Calendar, Download, CheckCircle, Clock, Filter, IndianRupee, Search, Printer, X, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { useReactToPrint } from 'react-to-print';

const SalaryManagement = () => {
    const [salaryData, setSalaryData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [filterType, setFilterType] = useState('all'); // 'all', 'teacher', 'staff'
    const [paymentFilter, setPaymentFilter] = useState('all'); // 'all', 'paid', 'unpaid'
    const [searchQuery, setSearchQuery] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [paymentData, setPaymentData] = useState({
        payment_mode: 'Cash',
        notes: '',
        transaction_id: '',
        cheque_number: ''
    });
    const fetchedRef = useRef(false);

    // Pay Slip Modal States
    const [showSlipModal, setShowSlipModal] = useState(false);
    const [selectedSlip, setSelectedSlip] = useState(null);
    const [schoolName, setSchoolName] = useState('');
    const slipRef = useRef();

    const handlePrint = useReactToPrint({
        contentRef: slipRef,
        documentTitle: selectedSlip ? `Salary_Slip_${selectedSlip.name}_${selectedMonth}_${selectedYear}` : 'Salary_Slip',
    });

    useEffect(() => {
        // Prevent duplicate calls in React StrictMode
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchSalaryData();
        fetchSchoolName();

        return () => {
            fetchedRef.current = false;
        };
    }, [selectedMonth, selectedYear]);

    const fetchSchoolName = async () => {
        try {
            const res = await api.get('/schools/my-school');
            setSchoolName(res.data.name);
        } catch (error) {
            console.error('Failed to fetch school name', error);
        }
    };

    const fetchSalaryData = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/salary/overview?month=${selectedMonth}&year=${selectedYear}`);
            setSalaryData(res.data);
        } catch (error) {
            if (!fetchedRef.current) {
                toast.error('Failed to load salary data');
            }
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewSlip = (emp) => {
        setSelectedSlip(emp);
        setShowSlipModal(true);
    };

    const handleMarkPaid = async () => {
        if (isSubmitting) return;
        if (!selectedEmployee) return;

        // Validation for Online Payments
        if (['Bank Transfer', 'UPI'].includes(paymentData.payment_mode) && !paymentData.transaction_id) {
            return toast.error('Transaction ID / UTR is required for online payments');
        }
        if (paymentData.payment_mode === 'Cheque' && !paymentData.cheque_number) {
            return toast.error('Cheque Number is required');
        }

        setIsSubmitting(true);
        try {
            await api.post('/salary/mark-paid', {
                employee_id: selectedEmployee.id,
                employee_type: selectedEmployee.type,
                month: selectedMonth,
                year: selectedYear,
                amount: selectedEmployee.calculated_salary,
                payment_mode: paymentData.payment_mode,
                notes: paymentData.notes,
                transaction_details: {
                    transaction_id: paymentData.transaction_id,
                    cheque_number: paymentData.cheque_number
                }
            });

            toast.success(`Salary marked as paid for ${selectedEmployee.name}`);
            setShowPaymentModal(false);
            setSelectedEmployee(null);
            setPaymentData({ payment_mode: 'Cash', notes: '', transaction_id: '', cheque_number: '' });
            fetchSalaryData();
        } catch (error) {
            toast.error('Failed to mark salary as paid');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredData = salaryData.filter(emp => {
        // Type filter
        if (filterType !== 'all' && emp.type.toLowerCase() !== filterType) return false;

        // Payment filter
        if (paymentFilter === 'paid' && !emp.is_paid) return false;
        if (paymentFilter === 'unpaid' && emp.is_paid) return false;

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                emp.name?.toLowerCase().includes(query) ||
                emp.employee_id?.toLowerCase().includes(query) ||
                emp.role?.toLowerCase().includes(query)
            );
        }

        return true;
    });

    const totalSalary = filteredData.reduce((sum, emp) => sum + parseFloat(emp.calculated_salary || 0), 0);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl shadow-lg p-6 text-white">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <IndianRupee size={28} />
                            Salary Management
                        </h2>
                        <p className="text-emerald-50 mt-1">
                            Manage monthly salaries for {filterType === 'all' ? 'Teachers and Staff' : filterType === 'teacher' ? 'Teachers' : 'Staff'}
                        </p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-4 text-center">
                        <div className="text-emerald-50 text-xs uppercase tracking-wide">Total Payable</div>
                        <div className="text-3xl font-bold mt-1">₹{totalSalary.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex gap-4 items-center w-full md:w-auto">
                        <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-slate-500" />
                            <span className="font-semibold text-slate-700">Period:</span>
                        </div>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            {months.map((month, idx) => (
                                <option key={idx} value={idx + 1}>{month}</option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            {years.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        {/* Search Bar */}
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by name or ID..."
                                autoComplete="off"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''))}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                        </div>

                        <div className="flex gap-2">
                            {['all', 'teacher', 'staff'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all capitalize ${filterType === type
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Salary Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-400">
                        <Clock size={48} className="mx-auto mb-4 animate-spin opacity-50" />
                        <p>Loading salary data...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider border-b border-slate-100">
                                <tr>
                                    <th className="p-4 pl-6">Employee</th>
                                    {filterType === 'all' && <th className="p-4">Type</th>}
                                    <th className="p-4">
                                        {filterType === 'teacher' ? 'Subject' : filterType === 'staff' ? 'Role' : 'Role/Subject'}
                                    </th>
                                    <th className="p-4">Rate/Day</th>
                                    <th className="p-4">Present</th>
                                    <th className="p-4">Absent</th>
                                    <th className="p-4">Leave</th>
                                    <th className="p-4">Holidays</th>
                                    <th className="p-4">Calculated Salary</th>
                                    <th className="p-4 text-right pr-6">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.map(emp => (
                                    <tr key={`${emp.type}-${emp.id}`} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="p-4 pl-6">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-700">{emp.name}</span>
                                                    {emp.is_paid && (
                                                        <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                            <CheckCircle size={10} /> PAID
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-400 font-mono">{emp.employee_id || '-'}</div>
                                            </div>
                                        </td>
                                        {filterType === 'all' && (
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${emp.type === 'Teacher' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                                                    }`}>
                                                    {emp.type}
                                                </span>
                                            </td>
                                        )}
                                        <td className="p-4 text-slate-600">{emp.role || '-'}</td>
                                        <td className="p-4 font-semibold text-slate-700">₹{emp.salary_per_day || 0}</td>
                                        <td className="p-4">
                                            <span className="bg-green-50 text-green-700 px-2 py-1 rounded-lg font-bold text-xs">
                                                {emp.days_present || 0}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-red-50 text-red-700 px-2 py-1 rounded-lg font-bold text-xs">
                                                {emp.days_absent || 0}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-bold text-xs">
                                                {emp.days_leave || 0}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-lg font-bold text-xs">
                                                {emp.days_holiday || 0}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-lg text-emerald-600">
                                                ₹{parseFloat(emp.calculated_salary || 0).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="p-4 pr-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {emp.is_paid ? (
                                                    <>
                                                        <div className="text-right mr-2">
                                                            <div className="text-xs text-slate-500 mb-1">Paid on</div>
                                                            <div className="text-xs font-bold text-emerald-600">
                                                                {new Date(emp.payment_date).toLocaleDateString('en-GB')}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">{emp.payment_mode}</div>
                                                        </div>

                                                        {/* View Slip Button - Only for Paid Employees */}
                                                        <button
                                                            onClick={() => handleViewSlip(emp)}
                                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                                            title="View Pay Slip"
                                                        >
                                                            <FileText size={14} />
                                                            View Slip
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedEmployee(emp);
                                                            setShowPaymentModal(true);
                                                        }}
                                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                                    >
                                                        <CheckCircle size={14} />
                                                        Mark Paid
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredData.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="p-12 text-center text-slate-400">
                                            No salary data found for the selected period.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            {showPaymentModal && selectedEmployee && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 bg-emerald-50">
                            <h3 className="text-lg font-bold text-emerald-900">Mark Salary as Paid</h3>
                            <p className="text-sm text-emerald-700 mt-1">{selectedEmployee.name}</p>
                        </div>
                        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-slate-600">Period</span>
                                    <span className="font-bold text-slate-800">{months[selectedMonth - 1]} {selectedYear}</span>
                                </div>
                                <div className="border-t border-slate-200 mt-3 pt-3 flex justify-between items-center">
                                    <span className="font-bold text-slate-700">Total Payable Amount</span>
                                    <span className="text-2xl font-bold text-emerald-600">
                                        ₹{parseFloat(selectedEmployee.calculated_salary || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Payment Mode</label>
                                <select
                                    value={paymentData.payment_mode}
                                    onChange={(e) => setPaymentData({ ...paymentData, payment_mode: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="UPI">UPI</option>
                                </select>
                            </div>

                            {/* Conditional Fields for Online Payments */}
                            {['Bank Transfer', 'UPI'].includes(paymentData.payment_mode) && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">
                                            Transaction ID / UTR <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            autoComplete="off"
                                            value={paymentData.transaction_id}
                                            onChange={(e) => setPaymentData({ ...paymentData, transaction_id: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="Enter Transaction ID"
                                        />
                                    </div>
                                </div>
                            )}

                            {paymentData.payment_mode === 'Cheque' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">
                                            Cheque Number <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            autoComplete="off"
                                            value={paymentData.cheque_number}
                                            onChange={(e) => setPaymentData({ ...paymentData, cheque_number: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                            placeholder="Enter Cheque Number"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Notes (Optional)</label>
                                <textarea
                                    value={paymentData.notes}
                                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    rows="3"
                                    placeholder="Add any additional notes..."
                                />
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowPaymentModal(false);
                                        setSelectedEmployee(null);
                                        setPaymentData({ payment_mode: 'Cash', notes: '', transaction_id: '', cheque_number: '' });
                                    }}
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleMarkPaid}
                                    disabled={isSubmitting}
                                    className={`flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <CheckCircle size={18} />
                                    {isSubmitting ? 'Confirming...' : 'Confirm Payment'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PAY SLIP MODAL */}
            {showSlipModal && selectedSlip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-700">Salary Slip Preview</h3>
                            <button onClick={() => setShowSlipModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
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
                                        <p className="font-bold text-slate-800">{selectedSlip.is_paid ? new Date(selectedSlip.payment_date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-slate-400 font-bold">Employee ID</p>
                                        <p className="font-bold text-slate-800">{selectedSlip.employee_id || 'N/A'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase text-slate-400 font-bold">Month / Year</p>
                                        <p className="font-bold text-slate-800">{months[selectedMonth - 1]} {selectedYear}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[10px] uppercase text-slate-400 font-bold">Employee Name</p>
                                        <p className="font-bold text-slate-800">{selectedSlip.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-slate-400 font-bold">Type</p>
                                        <p className="font-bold text-slate-800">{selectedSlip.type}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase text-slate-400 font-bold">Role</p>
                                        <p className="font-bold text-slate-800">{selectedSlip.role || 'N/A'}</p>
                                    </div>
                                </div>

                                { /* Attendance Stats Removed as per User Request */}

                                <div className="space-y-3 border-t border-slate-100 pt-4">

                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Payment Mode</span>
                                        <span className="font-bold text-slate-800 capitalize">{selectedSlip.payment_mode || 'Pending'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Status</span>
                                        <span className={`font-bold px-2 py-0.5 rounded text-xs uppercase ${selectedSlip.is_paid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                            {selectedSlip.is_paid ? 'Paid' : 'Unpaid'}
                                        </span>
                                    </div>
                                    <div className="border-t border-dashed border-slate-200 my-4"></div>
                                    <div className="flex justify-between items-center text-lg">
                                        <span className="font-black text-slate-700">NET PAY</span>
                                        <span className="font-black text-emerald-600">₹{parseFloat(selectedSlip.calculated_salary || 0).toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="mt-8 text-center">
                                    <p className="text-[10px] text-slate-400 uppercase font-medium">This is a system generated slip.</p>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                            <button onClick={() => setShowSlipModal(false)} className="px-5 py-2.5 text-slate-600 font-bold text-sm hover:bg-slate-50 rounded-xl transition-colors">
                                Close
                            </button>
                            <button
                                onClick={handlePrint}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 active:scale-95"
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

export default SalaryManagement;
