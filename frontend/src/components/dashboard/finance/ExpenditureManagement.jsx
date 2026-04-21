import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, Edit, Calendar, PieChart, TrendingUp, TrendingDown, ArrowUp, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../api/axios';

const ExpenditureManagement = () => {
    const [expenditures, setExpenditures] = useState([]);
    const [stats, setStats] = useState({ today: 0, month: 0, year: 0 });
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [filter, setFilter] = useState('all'); // all, today, month, year
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        category: 'Maintenance',
        description: '',
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash',
        transaction_id: '',
        upi_id: '',
        custom_category: ''
    });

    useEffect(() => {
        fetchExpenditures();
        fetchStats();
    }, []);

    const fetchExpenditures = async () => {
        setLoading(true);
        try {
            const res = await api.get('/finance/expenditures');
            setExpenditures(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load expenditures');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await api.get('/finance/expenditures/stats');
            setStats(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prevent double submit with immediate ref check
        if (isSubmitting || isSubmittingRef.current) return;

        if (!formData.title || !formData.amount) {
            toast.error('Please fill required fields');
            return;
        }

        setIsSubmitting(true);
        isSubmittingRef.current = true;

        try {
            const payload = { ...formData };
            if (payload.category === 'Custom') {
                payload.category = payload.custom_category;
            }

            if (editingId) {
                // Update existing expense
                await api.put(`/finance/expenditures/${editingId}`, payload);
                toast.success('Expenditure updated successfully');
            } else {
                // Add new expense
                await api.post('/finance/expenditures', payload);
                toast.success('Expenditure added successfully');
            }

            setShowModal(false);
            setEditingId(null);
            setFormData({
                title: '',
                amount: '',
                category: 'Maintenance',
                description: '',
                expense_date: new Date().toISOString().split('T')[0],
                payment_method: 'Cash',
                transaction_id: '',
                upi_id: '',
                custom_category: ''
            });
            fetchExpenditures();
            fetchStats();
        } catch (error) {
            console.error(error);
            toast.error(editingId ? 'Failed to update expenditure' : 'Failed to add expenditure');
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const handleEdit = (expense) => {
        setEditingId(expense.id);
        setFormData({
            title: expense.title,
            amount: expense.amount,
            category: expense.category,
            description: expense.description || '',
            expense_date: expense.expense_date.split('T')[0],
            payment_method: expense.payment_method,
            transaction_id: expense.transaction_id || '',
            upi_id: expense.upi_id || '',
            custom_category: ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (isSubmitting) return;
        if (!window.confirm('Are you sure you want to delete this expenditure?')) return;

        setIsSubmitting(true);
        try {
            await api.delete(`/finance/expenditures/${id}`);
            toast.success('Expenditure deleted');
            fetchExpenditures();
            fetchStats();
        } catch (error) {
            toast.error('Failed to delete');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter by selected year and month
    const filteredExpenditures = expenditures.filter(item => {
        const itemDate = new Date(item.expense_date);
        return itemDate.getFullYear() === selectedYear && itemDate.getMonth() === selectedMonth;
    });

    const categoryColors = {
        'Maintenance': 'bg-blue-100 text-blue-700',
        'Supplies': 'bg-green-100 text-green-700',
        'Salary': 'bg-purple-100 text-purple-700',
        'Utilities': 'bg-orange-100 text-orange-700',
        'Other': 'bg-slate-100 text-slate-700'
    };

    const handlePrint = () => {
        const totalAmount = filteredExpenditures.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        const filterTitle = filter === 'all' ? 'All Expenditures' :
            filter === 'today' ? "Today's Expenditures" :
                filter === 'month' ? "This Month's Expenditures" : "This Year's Expenditures";

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Expenditure Report - ${filterTitle}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; padding: 20px; background: white; }
                    h1 { text-align: center; color: #333; font-size: 20px; margin-bottom: 5px; }
                    h2 { text-align: center; color: #666; font-size: 16px; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #4f46e5; color: white; font-weight: bold; }
                    .amount { color: #dc2626; font-weight: bold; text-align: right; }
                    .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 2px dashed #ccc; font-size: 11px; color: #666; }
                    @media print { body { padding: 10px; } @page { margin: 0.5cm; } }
                </style>
            </head>
            <body>
                <h1>Expenditure Report</h1>
                <h2>${filterTitle}</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Title</th>
                            <th>Category</th>
                            <th>Description</th>
                            <th>Payment Method</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredExpenditures.map(item => `
                            <tr>
                                <td>${new Date(item.expense_date).toLocaleDateString('en-GB')}</td>
                                <td>${item.title}</td>
                                <td>${item.category}</td>
                                <td>${item.description || '-'}</td>
                                <td>
                                    ${item.payment_method}
                                    ${item.payment_method !== 'Cash' ? `<div style="font-size:10px; color:#666;">${item.transaction_id ? 'Ref: ' + item.transaction_id : ''} ${item.upi_id ? '<br>UPI: ' + item.upi_id : ''}</div>` : ''}
                                </td>
                                <td class="amount">₹${parseFloat(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #f5f5f5; font-weight: bold;">
                            <td colspan="5" style="text-align: right; padding-right: 15px;">Total Expenditure</td>
                            <td class="amount">₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tfoot>
                </table>
                <div class="footer">
                    <p>Generated on: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <script>window.onload = function() { window.print(); }</script>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Expenditure Management</h2>
                    <p className="text-slate-500">Track and manage school expenses</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handlePrint}
                        className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                        <Printer size={20} /> Print Report
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all"
                    >
                        <Plus size={20} /> Add New Expense
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                            <PieChart size={24} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Monthly Expense</p>
                            <h3 className="text-2xl font-bold text-slate-800">₹{stats.month.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm font-medium">Yearly Expense</p>
                            <h3 className="text-2xl font-bold text-slate-800">₹{stats.year.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart Section ... */}

            {/* Main Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">All Expenses</h3>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-slate-600">Year:</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                            >
                                {Array.from({ length: new Date().getFullYear() - 2020 + 1 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-slate-600">Month:</label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white"
                            >
                                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => (
                                    <option key={index} value={index}>{month}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-3 font-semibold">Title</th>
                                <th className="px-6 py-3 font-semibold">Category</th>
                                <th className="px-6 py-3 font-semibold">Payment Method</th>
                                <th className="px-6 py-3 font-semibold">Date</th>
                                <th className="px-6 py-3 font-semibold">Amount</th>
                                <th className="px-6 py-3 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredExpenditures.length > 0 ? (
                                filteredExpenditures.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-slate-800">
                                            {item.title}
                                            <div className="text-xs text-slate-400 font-normal">{item.description}</div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${categoryColors[item.category] || 'bg-slate-100'}`}>
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-slate-500">
                                            {item.payment_method}
                                            {item.payment_method !== 'Cash' && (
                                                <div className="text-xs text-slate-400 mt-1">
                                                    {item.transaction_id && <div>Ref: {item.transaction_id}</div>}
                                                    {item.upi_id && <div>UPI: {item.upi_id}</div>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-slate-500">
                                            {new Date(item.expense_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-3 font-bold text-red-600">
                                            -₹{parseFloat(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    disabled={isSubmitting}
                                                    className={`text-slate-400 transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-600'}`}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                                        No expenditures found for this period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800">{editingId ? 'Edit Expenditure' : 'Add New Expenditure'}</h3>
                            </div>
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
                                    <input
                                        type="text"
                                        required
                                        autoComplete="off"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g. Office Supplies"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Amount</label>
                                        <input
                                            type="number"
                                            required
                                            autoComplete="off"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            value={formData.amount}
                                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                                        <input
                                            type="date"
                                            required
                                            autoComplete="off"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            value={formData.expense_date}
                                            max={new Date().toISOString().split('T')[0]}
                                            onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                                        <select
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        >
                                            <option value="Maintenance">Maintenance</option>
                                            <option value="Supplies">Supplies</option>
                                            <option value="Utilities">Utilities</option>
                                            <option value="Salary">Salary</option>
                                            <option value="Custom">+ Custom Category</option>
                                        </select>
                                    </div>
                                    {formData.category === 'Custom' && (
                                        <div className="col-span-2">
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">Custom Category Name</label>
                                            <input
                                                type="text"
                                                autoComplete="off"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                value={formData.custom_category}
                                                onChange={e => setFormData({ ...formData, custom_category: e.target.value })}
                                                placeholder="Enter category name"
                                                required
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">Payment Method</label>
                                        <select
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                            value={formData.payment_method}
                                            onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="Bank Transfer">Bank Transfer</option>
                                            <option value="Cheque">Cheque</option>
                                            <option value="UPI">UPI</option>
                                        </select>
                                    </div>
                                </div>

                                {formData.payment_method !== 'Cash' && (
                                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                                {formData.payment_method === 'Cheque' ? 'Cheque Number' : 'Transaction ID / UTR'}
                                            </label>
                                            <input
                                                type="text"
                                                autoComplete="off"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                value={formData.transaction_id}
                                                onChange={e => setFormData({ ...formData, transaction_id: e.target.value })}
                                                placeholder="e.g. TXN12345678"
                                            />
                                        </div>
                                        {formData.payment_method === 'UPI' && (
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1">UPI ID</label>
                                                <input
                                                    type="text"
                                                    autoComplete="off"
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                    value={formData.upi_id}
                                                    onChange={e => setFormData({ ...formData, upi_id: e.target.value })}
                                                    placeholder="e.g. name@upi"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                                    <textarea
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                        rows="3"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Optional details..."
                                    ></textarea>
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium"
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold disabled:opacity-70 disabled:cursor-not-allowed"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Saving...' : 'Save Expenditure'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default ExpenditureManagement;
