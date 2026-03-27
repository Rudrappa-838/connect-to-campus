import React, { useState, useEffect } from 'react';
import { Search, CreditCard, History, CheckCircle, AlertCircle, Edit, Trash2, IndianRupee, Users, Printer, Receipt, Bus } from 'lucide-react';
import api from '../../../api/axios';
import toast from 'react-hot-toast';

const FeeCollection = ({ config: initialConfig }) => {
    // Fallback: If config is not passed, try to use a local state that we fetch ourselves
    const [config, setConfig] = useState(initialConfig || {});

    // Safety check: Update local config when prop changes
    useEffect(() => {
        if (initialConfig) setConfig(initialConfig);
    }, [initialConfig]);

    // Safety fallback: Fetch my-school if config is empty (handle missing props case)
    useEffect(() => {
        if (!initialConfig?.name) {
            api.get('/schools/my-school').then(res => setConfig(res.data)).catch(console.error);
        }
    }, []);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Data
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(false);

    // Selected Student for Detailed Payment View
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [feeDetails, setFeeDetails] = useState([]);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('dues');

    // Submission Lock
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);

    // Payment Modal
    const [payModal, setPayModal] = useState(null);
    const [editModal, setEditModal] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [remarks, setRemarks] = useState('');
    const [transactionId, setTransactionId] = useState('');

    // Transport Fee Modal
    const [transportModal, setTransportModal] = useState(false);
    const [routes, setRoutes] = useState([]);
    const [transportForm, setTransportForm] = useState({ route: '', amount: '' });

    const openTransportModal = async () => {
        setTransportModal(true);
        try {
            const res = await api.get('/transport/routes');
            setRoutes(res.data || []);
        } catch (e) {
            console.error('Failed to fetch routes', e);
            toast.error('Could not load transport routes');
        }
    };

    const handleAddTransportFee = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await api.post('/fees/student-structure', {
                student_id: selectedStudent.id,
                title: `Transport Fee - ${transportForm.route_name || 'Custom'}`,
                amount: transportForm.amount,
                due_date: new Date().toISOString().split('T')[0], // Due immediately
                type: 'TRANSPORT'
            });
            toast.success('Transport Fee Assigned');
            setTransportModal(false);
            setTransportForm({ route: '', amount: '' });
            fetchStudentFees(selectedStudent.id);
            fetchOverview();
        } catch (e) {
            console.error(e);
            toast.error('Failed to assign transport fee');
        } finally {
            setIsSubmitting(false);
        }
    };

    const sections = config?.classes?.find(c => c.class_id === parseInt(selectedClass))?.sections || [];

    const formatCurrency = (amount) => {
        return parseFloat(amount || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    useEffect(() => {
        fetchOverview();
    }, [selectedClass, selectedSection]);

    const fetchOverview = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/fees/overview?class_id=${selectedClass}&section_id=${selectedSection}`);
            setOverview(res.data);
        } catch (e) { console.error('Overview Fetch Error:', e); }
        finally { setLoading(false); }
    };

    const handleSelectStudent = (student) => {
        setSelectedStudent(student);
        fetchStudentFees(student.id);
        fetchHistory(student.id);
    };

    const fetchStudentFees = async (id) => {
        try {
            const res = await api.get(`/fees/student/${id}`);
            setFeeDetails(res.data);
        } catch (e) { toast.error('Failed to load fees'); }
    };

    const fetchHistory = async (id) => {
        try {
            const res = await api.get(`/fees/student/${id}/history`);
            setHistory(res.data);
        } catch (e) { console.error(e); }
    };

    const handleDeletePayment = async () => {
        if (isSubmitting || isSubmittingRef.current) return;
        setIsSubmitting(true);
        isSubmittingRef.current = true;

        try {
            await api.delete(`/fees/payment/${deleteConfirm.id}`);
            toast.success('Payment Deleted');
            setDeleteConfirm(null);
            fetchStudentFees(selectedStudent.id);
            fetchHistory(selectedStudent.id);
            fetchOverview();
        } catch (e) {
            console.error(e);
            toast.error('Deletion failed');
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();

        if (isSubmitting || isSubmittingRef.current) return;
        setIsSubmitting(true);
        isSubmittingRef.current = true;

        try {
            if (editModal.type === 'structure') {
                await api.put(`/fees/structures/${editModal.data.fee_structure_id}`, {
                    title: editModal.data.title,
                    amount: editModal.data.total_amount,
                    due_date: editModal.data.due_date
                });
                toast.success('Fee Structure Updated');
            } else {
                await api.put(`/fees/payment/${editModal.data.id}`, {
                    amount: editModal.data.amount_paid,
                    method: editModal.data.payment_method,
                    remarks: editModal.data.remarks,
                    date: editModal.data.payment_date
                });
                toast.success('Payment Updated');
            }
            setEditModal(null);
            fetchStudentFees(selectedStudent.id);
            fetchHistory(selectedStudent.id);
            fetchOverview();
        } catch (e) {
            console.error(e);
            toast.error('Update failed');
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const handlePayment = async (e) => {
        e.preventDefault();

        if (isSubmitting || isSubmittingRef.current) return;

        if (['Bank Transfer', 'UPI', 'Cheque'].includes(method) && !transactionId) {
            return toast.error(`${method === 'Cheque' ? 'Cheque Number' : 'Transaction ID / UTR'} is required`);
        }

        setIsSubmitting(true);
        isSubmittingRef.current = true;

        try {
            await api.post('/fees/pay', {
                student_id: selectedStudent.id,
                fee_structure_id: payModal.fee_structure_id,
                amount: parseFloat(amount),
                method,
                remarks: transactionId ? `${method}: ${transactionId}${remarks ? ' - ' + remarks : ''}` : remarks
            });
            toast.success('Payment Recorded');
            setPayModal(null);
            setAmount('');
            setTransactionId('');
            setRemarks('');
            fetchStudentFees(selectedStudent.id);
            fetchHistory(selectedStudent.id);
            fetchOverview();
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.message || 'Payment failed');
        }
        finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const generateReceiptHTML = (payment, student) => {
        const schoolName = config?.name || 'School Name';
        const schoolAddress = config?.address || '';
        const schoolContact = [config?.contact_number, config?.contact_email].filter(Boolean).join(' | ');

        const classObj = config?.classes?.find(c => c.class_id == student.class_id);
        const className = classObj?.class_name || 'N/A';
        // Attempt to find section name if section_id is available in student object or if we can infer it
        // Note: student object here is the selectedStudent state
        const sectionName = classObj?.sections?.find(s => s.id == student.section_id)?.name || '';
        const fullClass = sectionName ? `${className} - ${sectionName}` : className;

        const totalPending = feeDetails.reduce((sum, f) => sum + Math.max(0, parseFloat(f.balance)), 0);

        return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Fee Receipt - ${payment.receipt_no}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.page{max-width:660px;margin:28px auto;background:white;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.10);overflow:hidden;}
.print-bar{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:11px 22px;display:flex;justify-content:space-between;align-items:center;}
.print-bar span{font-size:13px;color:#64748b;font-weight:600;}
.print-btn{background:#4f46e5;color:white;border:none;padding:9px 22px;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;}
.body{padding:30px 38px;}
.school-header{text-align:center;padding-bottom:14px;border-bottom:2px solid #1e293b;margin-bottom:16px;}
.school-name{font-size:21px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:.5px;}
.school-meta{font-size:11px;color:#64748b;margin-top:4px;line-height:1.7;}
.badge{text-align:center;font-size:10px;font-weight:800;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin-bottom:14px;}
.class-strip{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;text-align:center;padding:7px 12px;margin-bottom:18px;font-size:12px;font-weight:800;color:#1d4ed8;text-transform:uppercase;}
.dtable{width:100%;border-collapse:collapse;margin-bottom:20px;}
.dtable tr{border-bottom:1px solid #f1f5f9;}
.dtable tr:last-child{border-bottom:none;}
.dtable td{padding:9px 5px;font-size:13px;vertical-align:middle;}
.lbl{color:#64748b;font-weight:600;width:38%;}
.sep{color:#cbd5e1;width:5%;text-align:center;font-size:15px;}
.val{color:#0f172a;font-weight:700;}
.amount-box{background:#f0fdf4;border:2px solid #86efac;border-radius:10px;padding:14px 20px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;}
.albl{font-size:13px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.5px;}
.aval{font-size:25px;font-weight:900;color:#16a34a;}
.pending-box{background:#fff1f2;border:1px dashed #fca5a5;border-radius:8px;padding:9px 16px;margin-bottom:18px;text-align:center;font-size:12px;font-weight:800;color:#b91c1c;}
.sigs{display:flex;justify-content:space-between;margin-top:34px;}
.sbox{text-align:center;}
.sline{width:120px;border-bottom:1px solid #94a3b8;margin:0 auto 5px auto;}
.slbl{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;}
.rfooter{text-align:center;margin-top:20px;padding-top:13px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;line-height:1.7;}
@media print{
  @page{size:A4 portrait;margin:14mm 16mm;}
  body{background:white;}
  .page{box-shadow:none;border-radius:0;max-width:100%;margin:0;}
  .print-bar{display:none!important;}
  .body{padding:0;}
}
</style></head>
<body>
<div class="page">
  <div class="print-bar">
    <span>🧾 Fee Receipt</span>
    <button class="print-btn" onclick="window.print()">🖨️ Print Receipt</button>
  </div>
  <div class="body">
    <div class="school-header">
      <div class="school-name">${schoolName}</div>
      <div class="school-meta">${schoolAddress ? schoolAddress + '<br/>' : ''}${schoolContact || ''}</div>
    </div>
    <div class="badge">— Fee Payment Receipt —</div>
    <div class="class-strip">📚 Class: ${fullClass}</div>
    <table class="dtable">
      <tr><td class="lbl">Receipt No.</td><td class="sep">:</td><td class="val"><strong>#${payment.receipt_no}</strong></td></tr>
      <tr><td class="lbl">Payment Date</td><td class="sep">:</td><td class="val">${new Date(payment.payment_date).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'})}</td></tr>
      <tr><td class="lbl">Student Name</td><td class="sep">:</td><td class="val">${student.name}</td></tr>
      <tr><td class="lbl">Fee Description</td><td class="sep">:</td><td class="val">${payment.fee_title}</td></tr>
      <tr><td class="lbl">Payment Mode</td><td class="sep">:</td><td class="val">${payment.payment_method}</td></tr>
      ${payment.remarks ? `<tr><td class="lbl">Reference / Notes</td><td class="sep">:</td><td class="val">${payment.remarks}</td></tr>` : ''}
    </table>
    <div class="amount-box">
      <span class="albl">✅ Amount Paid</span>
      <span class="aval">₹${parseFloat(payment.amount_paid).toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
    </div>
    ${totalPending > 0 ? `<div class="pending-box">⚠️ Outstanding Balance: ₹${totalPending.toLocaleString('en-IN',{minimumFractionDigits:2})}</div>` : ''}
    <div class="sigs">
      <div class="sbox"><div class="sline"></div><div class="slbl">Depositor Signature</div></div>
      <div class="sbox"><div class="sline"></div><div class="slbl">Cashier / Auth. Sign</div></div>
    </div>
    <div class="rfooter">Generated on ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; Computer generated receipt.<br/>${schoolName}</div>
  </div>
</div>
</body></html>`;
    };

    const handlePrintOverview = () => {
        const className = config?.classes?.find(c => c.class_id === parseInt(selectedClass))?.class_name || 'All Classes';
        const sectionName = sections.find(s => s.id === parseInt(selectedSection))?.name || 'All Sections';
        const filteredStudents = overview.students.filter(s => statusFilter === 'All' || s.status === statusFilter);

        const now = new Date();
        const currentMonth = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        const totalExpected = overview.summary.total_expected || 0;
        const totalCollected = overview.summary.total_collected || 0;
        const totalOutstanding = filteredStudents.reduce((acc, s) => acc + Math.max(0, s.balance), 0);
        const countPaid = overview.summary.count_paid || 0;
        const countPartial = overview.summary.count_partial || 0;
        const countUnpaid = overview.summary.count_unpaid || 0;

        const printContent = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Fee Collection Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Segoe UI',Arial,sans-serif;padding:24px;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.school-header{text-align:center;padding-bottom:14px;border-bottom:2px solid #1e293b;margin-bottom:18px;}
.school-name{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;}
.school-meta{font-size:11px;color:#64748b;margin-top:4px;line-height:1.7;}
.report-title{font-size:15px;font-weight:800;color:#0f172a;margin-bottom:3px;}
.report-sub{font-size:11px;color:#64748b;margin-bottom:16px;}
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}
.scard{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;}
.scard .slbl{font-size:9px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;}
.scard .sval{font-size:17px;font-weight:900;color:#0f172a;margin-top:2px;}
.scard.green{border-color:#86efac;background:#f0fdf4;}.scard.green .sval{color:#16a34a;}
.scard.red{border-color:#fca5a5;background:#fff1f2;}.scard.red .sval{color:#dc2626;}
.scard.blue{border-color:#bfdbfe;background:#eff6ff;}.scard.blue .sval{color:#1d4ed8;}
.section-title{font-size:12px;font-weight:800;text-transform:uppercase;color:#475569;letter-spacing:.5px;margin:18px 0 8px 0;padding-bottom:5px;border-bottom:1px solid #e2e8f0;}
table{width:100%;border-collapse:collapse;font-size:11px;}
thead tr{background:#4f46e5;color:white;}
th{padding:9px 8px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;}
td{padding:8px;border-bottom:1px solid #f1f5f9;font-size:11px;}
tr:nth-child(even) td{background:#f8fafc;}
.s-paid{background:#dcfce7;color:#15803d;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:800;white-space:nowrap;}
.s-partial{background:#fef9c3;color:#854d0e;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:800;white-space:nowrap;}
.s-unpaid{background:#fee2e2;color:#991b1b;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:800;white-space:nowrap;}
.total-row td{background:#f1f5f9!important;font-weight:800;border-top:2px solid #e2e8f0;border-bottom:none;}
.monthly-table th{background:#0f172a;}
.monthly-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px;}
.mcard{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;text-align:center;}
.mcard .mlbl{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;}
.mcard .mval{font-size:14px;font-weight:900;color:#0f172a;margin-top:1px;}
.footer{text-align:center;margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;}
@media print{
  @page{size:A4 portrait;margin:12mm 14mm;}
  body{padding:0;}
  .no-break{page-break-inside:avoid;}
}
</style></head>
<body>

<!-- School Header -->
<div class="school-header">
  <div class="school-name">${config?.name || 'School Name'}</div>
  <div class="school-meta">
    ${config?.address ? config.address + '<br/>' : ''}
    ${[config?.contact_number, config?.contact_email].filter(Boolean).join(' &nbsp;|&nbsp; ')}
  </div>
</div>

<div class="report-title">Fee Collection Report</div>
<div class="report-sub">
  ${className}${sectionName !== 'All Sections' ? ' &nbsp;—&nbsp; ' + sectionName : ' &nbsp;—&nbsp; All Sections'}
  &nbsp;|&nbsp; Filter: ${statusFilter}
  &nbsp;|&nbsp; Generated: ${now.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})} ${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
</div>

<!-- Summary Cards -->
<div class="summary-grid no-break">
  <div class="scard blue">
    <div class="slbl">Total Students</div>
    <div class="sval">${filteredStudents.length}</div>
    <div style="font-size:9px;color:#475569;margin-top:3px;">${countPaid} Paid &nbsp;·&nbsp; ${countPartial} Partial &nbsp;·&nbsp; ${countUnpaid} Unpaid</div>
  </div>
  <div class="scard">
    <div class="slbl">Total Expected</div>
    <div class="sval">₹${formatCurrency(totalExpected)}</div>
  </div>
  <div class="scard green">
    <div class="slbl">Total Collected</div>
    <div class="sval">₹${formatCurrency(totalCollected)}</div>
  </div>
  <div class="scard red">
    <div class="slbl">Outstanding Dues</div>
    <div class="sval">₹${formatCurrency(totalOutstanding)}</div>
  </div>
</div>

<!-- Monthly Collection Summary -->
<div class="section-title">📅 Monthly Collections Summary — ${currentMonth}</div>
<div class="monthly-grid no-break">
  <div class="mcard">
    <div class="mlbl">Collection Rate</div>
    <div class="mval" style="color:${totalExpected > 0 && (totalCollected/totalExpected)*100 >= 75 ? '#16a34a' : '#dc2626'}">
      ${totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : 0}%
    </div>
  </div>
  <div class="mcard">
    <div class="mlbl">Avg per Student</div>
    <div class="mval">₹${filteredStudents.length > 0 ? formatCurrency(totalCollected / filteredStudents.length) : '0.00'}</div>
  </div>
  <div class="mcard">
    <div class="mlbl">Fully Paid Students</div>
    <div class="mval" style="color:#16a34a;">${countPaid} / ${filteredStudents.length}</div>
  </div>
</div>

<!-- Student Transactions Table -->
<div class="section-title">📋 Student-wise Fee Status</div>
<table class="no-break">
  <thead>
    <tr>
      <th>#</th>
      <th>Student Name</th>
      <th>Admission No.</th>
      <th>Total Fee</th>
      <th>Paid</th>
      <th>Balance</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    ${filteredStudents.map((s, i) => `<tr>
      <td style="color:#94a3b8;">${i + 1}</td>
      <td><strong>${s.name}</strong></td>
      <td style="color:#64748b;font-size:10px;font-family:monospace;">${s.admission_no}</td>
      <td style="font-weight:600;">₹${formatCurrency(s.total_fee)}</td>
      <td style="color:#15803d;font-weight:700;">₹${formatCurrency(s.paid)}</td>
      <td style="color:${s.balance > 0 ? '#dc2626' : '#94a3b8'};font-weight:${s.balance > 0 ? '700' : '400'};">₹${formatCurrency(Math.max(0, s.balance))}</td>
      <td><span class="s-${s.status.toLowerCase()}">${s.status}</span></td>
    </tr>`).join('')}
  </tbody>
  <tfoot>
    <tr class="total-row">
      <td colspan="3"><strong>Grand Total (${filteredStudents.length} students)</strong></td>
      <td><strong>₹${formatCurrency(totalExpected)}</strong></td>
      <td><strong style="color:#15803d;">₹${formatCurrency(totalCollected)}</strong></td>
      <td><strong style="color:#dc2626;">₹${formatCurrency(totalOutstanding)}</strong></td>
      <td></td>
    </tr>
  </tfoot>
</table>

<div class="footer">
  Generated on ${now.toLocaleString('en-IN')} &nbsp;|&nbsp; ${config?.name || 'School'} — Fee Management System &nbsp;|&nbsp; This is a computer generated report.
</div>

<script>window.onload = function() { window.print(); }</script>
</body></html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    const handlePrintReceipt = (payment, student) => {
        const printWindow = window.open('', '_blank', 'width=720,height=850,scrollbars=yes');
        if (!printWindow) {
            toast.error('Popup blocked! Please allow popups for this site.');
            return;
        }
        printWindow.document.open();
        printWindow.document.write(generateReceiptHTML(payment, student));
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    if (selectedStudent) {
        return (
            <div className="space-y-6 animate-in fade-in">
                <button onClick={() => setSelectedStudent(null)} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 font-bold mb-4">
                    <History size={16} /> Back to Class List
                </button>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-3 bg-indigo-600 text-white p-6 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-bold">{selectedStudent.name}</h2>
                            <p className="text-indigo-100">Class {selectedStudent.class_name || (selectedClass ? config?.classes.find(c => c.class_id == selectedClass)?.class_name : '')} • {selectedStudent.admission_no}</p>
                        </div>
                        <div className="text-center md:text-right">
                            <p className="text-xs text-indigo-200 uppercase font-bold">Total Dues Available</p>
                            <p className="text-3xl font-bold">₹{formatCurrency(feeDetails.reduce((sum, f) => sum + Math.max(0, f.balance), 0))}</p>
                        </div>
                    </div>

                    <div className="lg:col-span-3">
                        <div className="flex bg-white rounded-t-xl border-b border-gray-200">
                            <button onClick={() => setActiveTab('dues')} className={`flex-1 p-4 font-bold text-sm ${activeTab === 'dues' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>Current Dues</button>
                            <button onClick={() => setActiveTab('history')} className={`flex-1 p-4 font-bold text-sm ${activeTab === 'history' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}>Payment History</button>
                            <button onClick={openTransportModal} className="px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 border-l border-gray-100">
                                <Bus size={16} /> Add Transport Fee
                            </button>
                        </div>

                        <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 p-6 min-h-[300px] overflow-x-auto">
                            {activeTab === 'dues' ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                                        <tr><th>Fee Title</th><th>Due Date</th><th>Amount</th><th>Paid</th><th>Balance</th><th className="text-right">Action</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {feeDetails.map(f => (
                                            <tr key={f.fee_structure_id}>
                                                <td className="p-4 font-bold text-gray-700">{f.title}</td>
                                                <td className="p-4 text-gray-500">{new Date(f.due_date).toLocaleDateString('en-GB')}</td>
                                                <td className="p-4 font-mono">₹{formatCurrency(f.total_amount)}</td>
                                                <td className="p-4 text-green-600 font-mono">₹{formatCurrency(f.paid_amount)}</td>
                                                <td className="p-4 text-red-600 font-bold font-mono">₹{formatCurrency(Math.max(0, f.balance))}</td>
                                                <td className="p-4 text-right">
                                                    {f.balance > 0 && (
                                                        <button onClick={() => { setPayModal(f); setAmount(f.balance); }} className="btn-primary py-1.5 text-xs">
                                                            Pay Now
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {feeDetails.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400">No fees assigned</td></tr>}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                                        <tr><th>Date</th><th>Receipt#</th><th>Fee</th><th>Amount</th><th>Method</th><th>Remarks</th><th className="text-right">Action</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {history.map(h => (
                                            <tr key={h.id}>
                                                <td className="p-4 text-gray-500 text-xs">{new Date(h.payment_date).toLocaleDateString('en-GB')}</td>
                                                <td className="p-4"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-mono font-bold">{h.receipt_no || 'N/A'}</span></td>
                                                <td className="p-4 font-bold text-gray-700 text-xs">{h.fee_title}</td>
                                                <td className="p-4 text-green-600 font-bold font-mono">₹{formatCurrency(h.amount_paid)}</td>
                                                <td className="p-4 text-xs">{h.payment_method}</td>
                                                <td className="p-4 text-gray-400 italic text-xs">{h.remarks || '-'}</td>
                                                <td className="p-4 text-right flex justify-end gap-1">
                                                     <button onClick={() => handlePrintReceipt(h, selectedStudent)} className="bg-green-50 text-green-600 p-1.5 rounded-lg hover:bg-green-100" title="Print Receipt">
                                                        <Receipt size={14} />
                                                    </button>
                                                    <button onClick={() => setEditModal({ type: 'payment', data: h })} className="bg-blue-50 text-blue-600 p-1.5 rounded-lg hover:bg-blue-100">
                                                        <Edit size={14} />
                                                    </button>
                                                    <button onClick={() => setDeleteConfirm({ id: h.id })} className="bg-red-50 text-red-600 p-1.5 rounded-lg hover:bg-red-100">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {history.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-400">No payment history</td></tr>}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modals */}
                {payModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                            <h3 className="text-lg font-bold mb-4">Record Payment: {payModal.title}</h3>
                            <form onSubmit={handlePayment} className="space-y-4">
                                <div>
                                    <label className="label">Amount</label>
                                    <div className="relative">
                                        <input
                                            className="input"
                                            type="text"
                                            autoComplete="off"
                                            value={amount !== undefined && amount !== null ? (() => {
                                                const valStr = String(amount);
                                                const parts = valStr.split('.');
                                                parts[0] = parseInt(parts[0] || 0).toLocaleString('en-IN');
                                                return parts.join('.');
                                            })() : ''}
                                            onChange={e => {
                                                const raw = e.target.value.replace(/,/g, '');
                                                if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                                    setAmount(raw);
                                                }
                                            }}
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-right text-gray-500 mt-1">Max: ₹{formatCurrency(payModal.balance)}</p>
                                </div>
                                <div>
                                    <label className="label">Payment Method</label>
                                    <select className="input" value={method} onChange={e => { setMethod(e.target.value); setTransactionId(''); }}>
                                        <option>Cash</option><option>Bank Transfer</option><option>UPI</option><option>Cheque</option>
                                    </select>
                                </div>
                                {['Bank Transfer', 'UPI', 'Cheque'].includes(method) && (
                                    <div>
                                        <label className="label">
                                            {method === 'Cheque' ? 'Cheque Number' : 'Transaction ID / UTR'} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            className="input"
                                            required
                                            autoComplete="off"
                                            placeholder={method === 'Cheque' ? 'Enter Cheque Number' : 'Enter UTR / Transaction ID'}
                                            value={transactionId}
                                            onChange={e => setTransactionId(e.target.value)}
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="label">Remarks (Optional)</label>
                                    <textarea className="input" rows="2" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Any additional notes..." />
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setPayModal(null)} className="btn-secondary w-1/2" disabled={isSubmitting}>Cancel</button>
                                    <button type="submit" className="btn-primary w-1/2" disabled={isSubmitting}>{isSubmitting ? 'Processing...' : 'Confirm Payment'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {deleteConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 text-center">
                            <div className="mx-auto bg-red-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 text-red-600">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Payment?</h3>
                            <p className="text-gray-500 text-sm mb-6">This action cannot be undone. The payment record will be permanently removed.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1" disabled={isSubmitting}>Cancel</button>
                                <button onClick={handleDeletePayment} className="btn-primary bg-red-600 hover:bg-red-700 flex-1" disabled={isSubmitting}>{isSubmitting ? 'Deleting...' : 'Delete'}</button>
                            </div>
                        </div>
                    </div>
                )}
                {editModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold">Edit {editModal.type === 'structure' ? 'Fee Structure' : 'Payment'}</h3>
                                <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-gray-600" disabled={isSubmitting}>×</button>
                            </div>
                            <form onSubmit={handleUpdate} className="space-y-4">
                                {editModal.type === 'structure' ? (
                                    <>
                                        <div>
                                            <label className="label">Title</label>
                                            <input className="input" autoComplete="off" value={editModal.data.title} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, title: e.target.value } })} />
                                        </div>
                                        <div>
                                            <label className="label">Total Amount</label>
                                            <input className="input" type="number" autoComplete="off" value={editModal.data.total_amount} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, total_amount: e.target.value } })} />
                                        </div>
                                        <div>
                                            <label className="label">Due Date</label>
                                            <input className="input" type="date" autoComplete="off" value={editModal.data.due_date ? new Date(editModal.data.due_date).toISOString().split('T')[0] : ''} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, due_date: e.target.value } })} />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="label">Amount Paid</label>
                                            <input className="input" type="number" autoComplete="off" value={editModal.data.amount_paid} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, amount_paid: e.target.value } })} required />
                                        </div>
                                        <div>
                                            <label className="label">Payment Method</label>
                                            <select className="input" value={editModal.data.payment_method} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, payment_method: e.target.value } })}>
                                                <option>Cash</option><option>Bank Transfer</option><option>UPI</option><option>Cheque</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label">Remarks / UTR</label>
                                            <input className="input" autoComplete="off" value={editModal.data.remarks || ''} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, remarks: e.target.value } })} />
                                        </div>
                                        <div>
                                            <label className="label">Date</label>
                                            <input className="input" type="date" autoComplete="off" value={editModal.data.payment_date ? new Date(editModal.data.payment_date).toISOString().split('T')[0] : ''} onChange={e => setEditModal({ ...editModal, data: { ...editModal.data, payment_date: e.target.value } })} />
                                        </div>
                                    </>
                                )}
                                <button type="submit" className="btn-primary w-full py-3 bg-gray-800 hover:bg-gray-900" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update Changes'}</button>
                            </form>
                        </div>
                    </div>
                )}

                {transportModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                            <h3 className="text-lg font-bold mb-4">Assign Transport Fee</h3>
                            <form onSubmit={handleAddTransportFee} className="space-y-4">
                                <div>
                                    <label className="label">Select Route (Optional)</label>
                                    <select
                                        className="input"
                                        onChange={e => {
                                            const r = routes.find(x => x.id == e.target.value);
                                            if (r) {
                                                setTransportForm({ route: r.id, route_name: r.route_name, amount: r.monthly_fee || transportForm.amount });
                                            } else {
                                                setTransportForm({ ...transportForm, route: '', route_name: '' });
                                            }
                                        }}
                                    >
                                        <option value="">-- Select Route --</option>
                                        {routes.map(r => (
                                            <option key={r.id} value={r.id}>{r.route_name} {r.vehicle_number ? `(${r.vehicle_number})` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">Fee Amount (₹)</label>
                                    <input
                                        className="input"
                                        type="number"
                                        required
                                        value={transportForm.amount}
                                        onChange={e => setTransportForm({ ...transportForm, amount: e.target.value })}
                                        placeholder="Enter Amount"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setTransportModal(false)} className="btn-secondary w-1/2" disabled={isSubmitting}>Cancel</button>
                                    <button type="submit" className="btn-primary w-1/2" disabled={isSubmitting}>{isSubmitting ? 'Assigning...' : 'Assign Fee'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header / Filter */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 md:items-end">
                <div className="flex-1 w-full relative">
                    <h2 className="text-lg font-bold text-gray-800 mb-1">Fee Collection Dashboard</h2>
                    <p className="text-gray-500 text-sm mb-4">Select a Class & Section or Search</p>

                    {/* SEARCH INPUT */}
                    <div className="relative max-w-md">
                        <input
                            type="text"
                            placeholder="Search by Student Name or ID..."
                            autoComplete="off"
                            className="input w-full bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''))}
                        />
                    </div>
                </div>
                <div className="w-full md:w-auto">
                    <select className="input w-full md:min-w-[150px]" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }}>
                        <option value="">All Classes</option>
                        {config?.classes
                            ?.slice()
                            .sort((a, b) => {
                                const numA = parseInt(a.class_name.replace(/\D/g, '') || '0', 10);
                                const numB = parseInt(b.class_name.replace(/\D/g, '') || '0', 10);
                                return numA === numB ? a.class_name.localeCompare(b.class_name) : numA - numB;
                            })
                            .map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
                    </select>
                </div>
                {sections.length > 0 && (
                    <div className="w-full md:w-auto">
                        <select className="input w-full md:min-w-[150px]" value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
                            <option value="">All Sections</option>
                            {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                )}
                <div className="w-full md:w-auto">
                    <select className="input w-full md:min-w-[150px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="All">All Status</option>
                        <option value="Paid">Paid</option>
                        <option value="Unpaid">Unpaid</option>
                        <option value="Partial">Partial</option>
                        <option value="No Fees">No Fees</option>
                    </select>
                </div>
                {overview && (
                    <button
                        onClick={handlePrintOverview}
                        className="bg-slate-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-500/20 hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 w-full md:w-auto"
                    >
                        <Printer size={20} /> Print Report
                    </button>
                )}
            </div>

            {loading && <div className="p-8 text-center text-gray-500 animate-pulse">Loading fee data...</div>}

            {/* Overview Cards */}
            {overview && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Students</p>
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                <Users size={16} />
                            </div>
                        </div>
                        <div className="flex justify-between items-end mt-1">
                            <p className="text-2xl font-bold text-slate-800">{overview.summary.total_students}</p>
                            <div className="text-xs text-right text-slate-500 flex flex-col items-end gap-1">
                                <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">{overview.summary.count_paid} Paid</span>
                                <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">{overview.summary.count_partial} Partial</span>
                                <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">{overview.summary.count_unpaid} Unpaid</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Expected</p>
                            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                                <IndianRupee size={16} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-slate-800">₹{formatCurrency(overview.summary.total_expected)}</p>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Collected</p>
                            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                <CheckCircle size={16} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600">₹{formatCurrency(overview.summary.total_collected)}</p>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Pending Dues</p>
                            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                                <AlertCircle size={16} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-rose-600">₹{
                            formatCurrency(overview.students.reduce((acc, s) => acc + Math.max(0, s.balance), 0))
                        }</p>
                    </div>
                </div>
            )}

            {/* Student List */}
            {overview && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="p-4 pl-6">Student Details</th>
                                    <th className="p-4">Total Fee</th>
                                    <th className="p-4">Paid</th>
                                    <th className="p-4">Balance</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 pr-6 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {overview.students
                                    .filter(s => {
                                        const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
                                        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            s.admission_no.toLowerCase().includes(searchQuery.toLowerCase());
                                        return matchesStatus && matchesSearch;
                                    })
                                    .slice(0, (statusFilter === 'Paid' && !searchQuery) ? 10 : undefined)
                                    .map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="p-2 md:p-4 pl-4 md:pl-6">
                                                <div className="font-bold text-slate-800">{s.name}</div>
                                                <div className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-500">#{s.admission_no}</span>
                                                    {s.class_id && !selectedClass && (
                                                        <>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="text-slate-500">Class {config?.classes?.find(c => c.class_id == s.class_id)?.class_name || 'N/A'}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-2 md:p-4 font-mono text-slate-600 font-medium">₹{formatCurrency(s.total_fee)}</td>
                                            <td className="p-2 md:p-4 font-mono text-emerald-600 font-medium">₹{formatCurrency(s.paid)}</td>
                                            <td className="p-2 md:p-4 font-mono">
                                                {s.balance > 0 ? (
                                                    <span className="text-rose-600 font-bold">₹{formatCurrency(s.balance)}</span>
                                                ) : (
                                                    <span className="text-slate-400">₹0.00</span>
                                                )}
                                            </td>
                                            <td className="p-2 md:p-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${s.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    s.status === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${s.status === 'Paid' ? 'bg-emerald-500' :
                                                        s.status === 'Partial' ? 'bg-amber-500' : 'bg-rose-500'
                                                        }`}></span>
                                                    {s.status}
                                                </span>
                                            </td>
                                            <td className="p-2 md:p-4 pr-4 md:pr-6 text-right">
                                                <button
                                                    onClick={() => handleSelectStudent(s)}
                                                    className="bg-white border border-slate-200 text-indigo-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm hover:shadow active:scale-95"
                                                >
                                                    View & Pay
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                {overview.students.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <Search size={48} className="mb-4 text-slate-200" />
                                                <p className="text-lg font-medium text-slate-500">No students found</p>
                                                <p className="text-sm">Try adjusting your filters</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}</div>
    );
};

export default FeeCollection;
