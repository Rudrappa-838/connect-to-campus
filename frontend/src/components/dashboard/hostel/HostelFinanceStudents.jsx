import React, { useState, useEffect, useMemo } from 'react';
import api from '../../../api/axios';
import {
    Users, CheckSquare, Square, Search, IndianRupee,
    Calendar, Clock, CheckCircle, AlertCircle, X,
    History, Filter, UserCheck, UserX, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';

const numberToWords = (amount) => {
    if (!amount || isNaN(amount)) return '';
    const num = Math.floor(amount);
    if (num === 0) return 'Zero';
    const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim() + ' Rupees Only';
};

/* ─── Assign Fee Modal ─────────────────────────────────────── */
const AssignFeeModal = ({ selected, students, onClose, onSaved }) => {
    const [amount, setAmount] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [remarks, setRemarks] = useState('');
    const [saving, setSaving] = useState(false);

    const targets = students.filter(s => selected.has(s.id));

    const handleSave = async () => {
        if (!amount || parseFloat(amount) <= 0) { toast.error('Enter a valid amount'); return; }
        setSaving(true);
        try {
            await api.post('/hostel/finance/assign-fee', {
                student_ids: Array.from(selected),
                amount: parseFloat(amount),
                due_date: dueDate || null,
                remarks: remarks || null,
            });
            toast.success(`Fee ₹${parseFloat(amount).toLocaleString('en-IN')} assigned to ${targets.length} student(s)`);
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to assign fee');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-lg font-bold text-slate-800">Assign Hostel Fee</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"><X size={18} /></button>
                </div>

                <div className="mb-4 p-3 bg-indigo-50 rounded-xl text-sm text-indigo-700">
                    <span className="font-semibold">{targets.length}</span> student{targets.length !== 1 ? 's' : ''} selected
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Fee Amount (₹) *</label>
                        <input
                            type="number" min="1" required autoFocus
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                            placeholder="e.g. 5000"
                            value={amount} onChange={e => setAmount(e.target.value)}
                        />
                        {amount && <p className="text-[11px] text-indigo-600 mt-1 font-medium">{numberToWords(amount)}</p>}
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Due Date</label>
                        <input
                            type="date"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                            value={dueDate} onChange={e => setDueDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Remarks</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                            placeholder="e.g. Term 1 Fee"
                            value={remarks} onChange={e => setRemarks(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                    <button
                        onClick={handleSave} disabled={saving || !amount}
                        className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? 'Assigning…' : 'Assign Fee'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── Receive Payment Modal ────────────────────────────────── */
const ReceivePaymentModal = ({ student, balance, onClose, onSaved }) => {
    const [paidAmount, setPaidAmount] = useState(balance || '');
    const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);
    const [remarks, setRemarks] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!paidAmount || parseFloat(paidAmount) <= 0) { toast.error('Enter a valid amount'); return; }
        setSaving(true);
        try {
            await api.post(`/hostel/finance/students/${student.id}/pay`, {
                paid_amount: parseFloat(paidAmount),
                paid_date: paidDate,
                remarks
            });
            toast.success('Payment received successfully!');
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Receive Payment</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <div className="mb-4 p-3 bg-green-50 rounded-xl text-sm">
                    <p className="font-semibold text-green-800">{student.name}</p>
                    <p className="text-xs text-green-600 mt-0.5">Pending Balance: ₹{parseFloat(balance).toLocaleString('en-IN')}</p>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Amount Paying (₹) *</label>
                        <input type="number" min="1"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
                            value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
                        {paidAmount && <p className="text-[11px] text-green-600 mt-1 font-medium">{numberToWords(paidAmount)}</p>}
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Payment Date</label>
                        <input type="date"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
                            value={paidDate} onChange={e => setPaidDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Remarks</label>
                        <input type="text" placeholder="e.g. Cash, UPI Reference"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
                            value={remarks} onChange={e => setRemarks(e.target.value)} />
                    </div>
                </div>
                <div className="flex gap-3 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50">
                        {saving ? 'Saving…' : 'Confirm Payment'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── Edit Due Date Modal ──────────────────────────────────── */
const EditDueDateModal = ({ payment, onClose, onSaved }) => {
    const [dueDate, setDueDate] = useState(payment.due_date ? new Date(payment.due_date).toISOString().split('T')[0] : '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put(`/hostel/finance/payments/${payment.id}/due-date`, {
                due_date: dueDate || null
            });
            toast.success('Due date updated successfully!');
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update due date');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Edit Due Date</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">New Due Date</label>
                        <input type="date"
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                            value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    </div>
                </div>
                <div className="flex gap-3 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
                        {saving ? 'Saving…' : 'Update Date'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── Bulk Edit Due Date Modal ───────────────────────────────── */
const BulkEditDueDateModal = ({ selected, students, onClose, onSaved }) => {
    const [dueDate, setDueDate] = useState('');
    const [saving, setSaving] = useState(false);

    const targets = students.filter(s => selected.has(s.id));

    const handleSave = async () => {
        if (!dueDate) { toast.error('Select a date'); return; }
        setSaving(true);
        try {
            await api.put('/hostel/finance/bulk-due-date', {
                student_ids: Array.from(selected),
                due_date: dueDate
            });
            toast.success(`Due date updated for ${targets.length} student(s)`);
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update due dates');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-lg font-bold text-slate-800">Change Due Date</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"><X size={18} /></button>
                </div>

                <div className="mb-4 p-3 bg-amber-50 rounded-xl text-sm text-amber-700">
                    <span className="font-semibold">{targets.length}</span> student{targets.length !== 1 ? 's' : ''} selected
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">New Due Date *</label>
                        <input
                            type="date" required
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                            value={dueDate} onChange={e => setDueDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                    <button
                        onClick={handleSave} disabled={saving || !dueDate}
                        className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? 'Updating…' : 'Update Date'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── History Modal ────────────────────────────────────────── */
const HistoryModal = ({ student, onClose }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingDueDate, setEditingDueDate] = useState(null);

    useEffect(() => { fetchHistory(); }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/hostel/finance/students/${student.id}/history`);
            setHistory(res.data);
        } catch { toast.error('Failed to load history'); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl flex flex-col shadow-2xl" style={{ maxHeight: '85vh' }}>
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Payment History</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{student.name} · Room {student.room_number}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"><X size={20} /></button>
                </div>

                <div className="overflow-y-auto flex-1 p-4">
                    {loading ? (
                        <div className="text-center py-10 text-slate-400">Loading…</div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <History size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No fee records found</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map(p => {
                                const isAssigned = p.payment_status === 'Assigned';
                                const isPaid = p.payment_status === 'Paid';
                                const isOverdue = isAssigned && p.due_date && new Date(p.due_date) < new Date();
                                return (
                                    <div key={p.id} className={`p-4 rounded-xl border ${isPaid ? 'bg-green-50 border-green-100' : isOverdue ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-100'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPaid ? 'bg-green-100 text-green-700' : isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {isPaid ? '✅ Payment Received' : isOverdue ? '🔴 Fee Overdue' : '🕐 Fee Assigned'}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    ₹{parseFloat(isPaid ? p.paid_amount || p.amount : p.amount).toLocaleString('en-IN')}
                                                </p>
                                                {p.remarks && <p className="text-xs text-slate-500 mt-0.5">{p.remarks}</p>}
                                                <div className="flex gap-3 mt-1 text-xs text-slate-400 items-center">
                                                    {p.due_date && !isPaid && (
                                                        <span className="flex items-center gap-1">
                                                            Due: {new Date(p.due_date).toLocaleDateString('en-IN')}
                                                            {isAssigned && (
                                                                <button onClick={() => setEditingDueDate(p)} className="text-indigo-500 hover:text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded ml-1 font-medium">Edit</button>
                                                            )}
                                                        </span>
                                                    )}
                                                    {!p.due_date && isAssigned && (
                                                        <button onClick={() => setEditingDueDate(p)} className="text-indigo-500 hover:text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-medium">Set Due Date</button>
                                                    )}
                                                    {isPaid && p.payment_date && <span>Paid: {new Date(p.payment_date).toLocaleDateString('en-IN')}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100">
                    <button onClick={onClose} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50">Close</button>
                </div>
            </div>

            {editingDueDate && (
                <EditDueDateModal
                    payment={editingDueDate}
                    onClose={() => setEditingDueDate(null)}
                    onSaved={fetchHistory}
                />
            )}
        </div>
    );
};

/* ─── Main Component ───────────────────────────────────────── */
const HostelFinanceStudents = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [genderTab, setGenderTab] = useState('Male'); // 'Male' | 'Female'
    const [search, setSearch] = useState('');
    const [feeFilter, setFeeFilter] = useState('All'); // All | Paid | Unpaid | Overdue
    const [selected, setSelected] = useState(new Set());
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showBulkDueModal, setShowBulkDueModal] = useState(false);
    const [viewHistory, setViewHistory] = useState(null); // student obj
    const [receivingPayment, setReceivingPayment] = useState(null); // { student, balance }

    useEffect(() => { fetchStudents(); }, []);
    // Clear selection when switching tabs
    useEffect(() => { setSelected(new Set()); }, [genderTab]);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await api.get('/hostel/finance/students');
            setStudents(res.data);
        } catch { toast.error('Failed to load students'); }
        finally { setLoading(false); }
    };

    const genderStudents = useMemo(() =>
        students.filter(s => s.gender?.toLowerCase() === genderTab.toLowerCase()),
        [students, genderTab]
    );

    const filtered = useMemo(() => {
        let list = genderStudents;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(s =>
                s.name.toLowerCase().includes(q) ||
                (s.admission_no || '').toLowerCase().includes(q) ||
                (s.room_number || '').toString().includes(q)
            );
        }
        if (feeFilter === 'Paid') list = list.filter(s => parseFloat(s.total_fee_assigned) > 0 && parseFloat(s.total_paid) >= parseFloat(s.total_fee_assigned));
        if (feeFilter === 'Partial') list = list.filter(s => parseFloat(s.total_fee_assigned) > 0 && parseFloat(s.total_paid) > 0 && parseFloat(s.total_paid) < parseFloat(s.total_fee_assigned));
        if (feeFilter === 'Unpaid') list = list.filter(s => parseFloat(s.total_fee_assigned) > 0 && parseFloat(s.total_paid) === 0);
        if (feeFilter === 'Overdue') list = list.filter(s => {
            const assigned = parseFloat(s.total_fee_assigned) > parseFloat(s.total_paid);
            return assigned && s.due_date && new Date(s.due_date) < new Date();
        });
        return list;
    }, [genderStudents, search, feeFilter]);

    const maleCount = students.filter(s => s.gender?.toLowerCase() === 'male').length;
    const femaleCount = students.filter(s => s.gender?.toLowerCase() === 'female').length;

    const toggleStudent = (id) => {
        setSelected(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const toggleAll = () => {
        if (selected.size === filtered.length && filtered.length > 0) {
            setSelected(new Set());
        } else {
            setSelected(new Set(filtered.map(s => s.id)));
        }
    };

    const allSelected = filtered.length > 0 && filtered.every(s => selected.has(s.id));
    const someSelected = filtered.some(s => selected.has(s.id));

    const getStatus = (s) => {
        const assigned = parseFloat(s.total_fee_assigned);
        const paid = parseFloat(s.total_paid);
        if (assigned === 0) return 'no-fee';
        if (paid >= assigned) return 'paid';
        if (paid > 0 && paid < assigned) return 'partial';
        if (s.due_date && new Date(s.due_date) < new Date()) return 'overdue';
        return 'unpaid';
    };

    const statusBadge = (status) => ({
        'no-fee': <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium">No Fee</span>,
        'paid': <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">✅ Paid</span>,
        'partial': <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">◑ Partial</span>,
        'overdue': <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">🔴 Overdue</span>,
        'unpaid': <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">🕐 Pending</span>,
    }[status]);

    // Summary stats for current tab
    const tabStats = useMemo(() => {
        const list = genderStudents;
        const paid = list.filter(s => getStatus(s) === 'paid').length;
        const partial = list.filter(s => getStatus(s) === 'partial').length;
        const overdue = list.filter(s => getStatus(s) === 'overdue').length;
        const unpaid = list.filter(s => getStatus(s) === 'unpaid').length;
        const noFee = list.filter(s => getStatus(s) === 'no-fee').length;
        return { total: list.length, paid, partial, overdue, unpaid, noFee };
    }, [genderStudents]);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Hostel Finance</h2>
                    <p className="text-slate-500 text-sm">Manage fees, track payments</p>
                </div>
                {selected.size > 0 && (
                    <button
                        onClick={() => setShowAssignModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <IndianRupee size={16} /> Assign Fee to {selected.size} Student{selected.size !== 1 ? 's' : ''}
                    </button>
                )}
            </div>

            {/* Gender tabs */}
            <div className="flex gap-0 bg-slate-100 p-1 rounded-xl w-fit">
                {[
                    { label: `👦 Boys (${maleCount})`, val: 'Male' },
                    { label: `👧 Girls (${femaleCount})`, val: 'Female' },
                ].map(t => (
                    <button key={t.val} onClick={() => setGenderTab(t.val)}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${genderTab === t.val ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: 'Total', value: tabStats.total, color: 'bg-slate-50 border-slate-200 text-slate-700', filter: 'All' },
                    { label: 'Paid', value: tabStats.paid, color: 'bg-green-50 border-green-100 text-green-700', filter: 'Paid' },
                    { label: 'Partial', value: tabStats.partial, color: 'bg-blue-50 border-blue-100 text-blue-700', filter: 'Partial' },
                    { label: 'Pending', value: tabStats.unpaid, color: 'bg-amber-50 border-amber-100 text-amber-700', filter: 'Unpaid' },
                    { label: 'Overdue', value: tabStats.overdue, color: 'bg-red-50 border-red-100 text-red-700', filter: 'Overdue' },
                ].map(s => (
                    <div key={s.label}
                        onClick={() => setFeeFilter(feeFilter === s.filter ? 'All' : s.filter)}
                        className={`border rounded-xl px-4 py-3 cursor-pointer hover:shadow-sm transition-all ${s.color} ${feeFilter === s.filter ? 'ring-2 ring-indigo-400' : ''}`}>
                        <p className="text-xs text-slate-500">{s.label}</p>
                        <p className="text-2xl font-bold">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input type="text" placeholder="Search name, admission no, room…"
                        className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 bg-white"
                        value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="relative">
                    <Filter size={14} className="absolute left-3 top-3 text-slate-400" />
                    <select
                        className="pl-8 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 bg-white"
                        value={feeFilter} onChange={e => setFeeFilter(e.target.value)}>
                        <option value="All">All Students</option>
                        <option value="Paid">Fully Paid</option>
                        <option value="Partial">Partially Paid</option>
                        <option value="Unpaid">Unpaid / Pending</option>
                        <option value="Overdue">Overdue</option>
                    </select>
                </div>
            </div>

            {/* Selection bar */}
            {selected.size > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <span className="text-sm font-semibold text-indigo-700">{selected.size} student{selected.size !== 1 ? 's' : ''} selected</span>
                    <div className="flex gap-2">
                        <button onClick={() => setSelected(new Set())} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">Clear</button>
                        <button onClick={() => setShowBulkDueModal(true)}
                            className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-200">
                            Change Due Date
                        </button>
                        <button onClick={() => setShowAssignModal(true)}
                            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-700">
                            Assign Fee
                        </button>
                    </div>
                </div>
            )}

            {/* Student Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <button onClick={toggleAll} className="text-indigo-600">
                                        {allSelected ? <CheckSquare size={16} /> : someSelected ? <CheckSquare size={16} className="opacity-40" /> : <Square size={16} className="text-slate-300" />}
                                    </button>
                                </th>
                                <th className="px-4 py-3">#</th>
                                <th className="px-4 py-3">Student</th>
                                <th className="px-4 py-3">Room</th>
                                <th className="px-4 py-3">Fee Assigned</th>
                                <th className="px-4 py-3">Paid</th>
                                <th className="px-4 py-3">Due Date</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                        Loading students…
                                    </div>
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={9} className="px-4 py-14 text-center text-slate-400">
                                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No {genderTab.toLowerCase()} hostel students found</p>
                                </td></tr>
                            ) : (
                                filtered.map((s, idx) => {
                                    const status = getStatus(s);
                                    const isChecked = selected.has(s.id);
                                    const assigned = parseFloat(s.total_fee_assigned);
                                    const paid = parseFloat(s.total_paid);
                                    const balance = assigned - paid;
                                    return (
                                        <tr key={s.id}
                                            className={`hover:bg-slate-50/60 transition-colors ${isChecked ? 'bg-indigo-50/40' : ''}`}>
                                            <td className="px-4 py-3">
                                                <button onClick={() => toggleStudent(s.id)} className="text-indigo-600">
                                                    {isChecked ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300" />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${genderTab === 'Male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                                        {(s.name || '?')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-800 text-sm">{s.name}</p>
                                                        <p className="text-xs text-slate-400">{s.admission_no}{s.class_name ? ` · ${s.class_name}` : ''}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                                                    Room {s.room_number}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-slate-700">
                                                {assigned > 0 ? `₹${assigned.toLocaleString('en-IN')}` : <span className="text-slate-300">—</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                {paid > 0
                                                    ? <span className="font-semibold text-green-600">₹{paid.toLocaleString('en-IN')}</span>
                                                    : <span className="text-slate-300">₹0</span>
                                                }
                                                {balance > 0 && (
                                                    <div className="text-xs text-red-500 font-medium">bal: ₹{balance.toLocaleString('en-IN')}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                {s.due_date
                                                    ? <span className={new Date(s.due_date) < new Date() && status !== 'paid' ? 'text-red-600 font-semibold' : ''}>
                                                        {new Date(s.due_date).toLocaleDateString('en-IN')}
                                                    </span>
                                                    : <span className="text-slate-300">—</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3">{statusBadge(status)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => setViewHistory(s)}
                                                        className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        <History size={12} /> History
                                                    </button>
                                                    {balance > 0 && (
                                                        <button
                                                            onClick={() => setReceivingPayment({ student: s, balance })}
                                                            className="flex items-center gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                        >
                                                            <CheckCircle size={12} /> Receive
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => { setSelected(new Set([s.id])); setShowAssignModal(true); }}
                                                        className="flex items-center gap-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        <IndianRupee size={12} /> Add Fee
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {showAssignModal && (
                <AssignFeeModal
                    selected={selected}
                    students={students}
                    onClose={() => setShowAssignModal(false)}
                    onSaved={() => { fetchStudents(); setSelected(new Set()); }}
                />
            )}
            {showBulkDueModal && (
                <BulkEditDueDateModal
                    selected={selected}
                    students={students}
                    onClose={() => setShowBulkDueModal(false)}
                    onSaved={() => { fetchStudents(); setSelected(new Set()); }}
                />
            )}
            {viewHistory && (
                <HistoryModal
                    student={viewHistory}
                    onClose={() => setViewHistory(null)}
                />
            )}
            {receivingPayment && (
                <ReceivePaymentModal
                    student={receivingPayment.student}
                    balance={receivingPayment.balance}
                    onClose={() => setReceivingPayment(null)}
                    onSaved={fetchStudents}
                />
            )}
        </div>
    );
};

export default HostelFinanceStudents;
