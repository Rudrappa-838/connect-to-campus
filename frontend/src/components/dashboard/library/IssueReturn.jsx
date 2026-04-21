import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import { BookOpen, User, ArrowRight, RotateCcw, Clock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const IssueReturn = () => {
    const [activeTab, setActiveTab] = useState('issue');
    const [transactions, setTransactions] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Issue Form State
    const [issueData, setIssueData] = useState({
        patron_type: 'Student',
        patron_id: '',
        book_number: ''
    });

    // Return Form State
    const [returnData, setReturnData] = useState({
        book_number: ''
    });

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        try {
            const res = await api.get('/library/transactions');
            setTransactions(res.data);
        } catch (error) {
            console.error('Failed to fetch transactions');
        }
    };

    // Verification State
    const [verifiedPatron, setVerifiedPatron] = useState(null);
    const [verifiedBook, setVerifiedBook] = useState(null);
    const [bookSearchResults, setBookSearchResults] = useState([]);
    const [timeFilter, setTimeFilter] = useState('all'); // 'all', 'today', 'week', 'month'

    // Filter transactions by time
    const filteredTransactions = transactions.filter(item => {
        if (timeFilter === 'all') return true;

        const transactionDate = new Date(item.status === 'Issued' ? item.issue_date : item.return_date);
        const now = new Date();

        if (timeFilter === 'today') {
            return transactionDate.toDateString() === now.toDateString();
        } else if (timeFilter === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return transactionDate >= weekAgo;
        } else if (timeFilter === 'month') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return transactionDate >= monthAgo;
        }
        return true;
    });

    const handleBookSearch = async (val) => {
        setIssueData({ ...issueData, book_number: val });
        if (verifiedBook) setVerifiedBook(null);

        if (val.length < 2) {
            setBookSearchResults([]);
            return;
        }

        try {
            const res = await api.get(`/library/search?q=${val}`);
            setBookSearchResults(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const selectBook = (book) => {
        setIssueData({ ...issueData, book_number: book.book_number });
        setVerifiedBook({ valid: true, book: book });
        setBookSearchResults([]);
    };

    const handleVerifyPatron = async () => {
        if (!issueData.patron_id) return;
        try {
            const res = await api.get(`/library/verify-patron?type=${issueData.patron_type}&id=${issueData.patron_id}`);
            if (res.data.valid) {
                setVerifiedPatron({ valid: true, name: res.data.name });
            }
        } catch (error) {
            setVerifiedPatron({ valid: false, error: 'Patron not found' });
        }
    };

    const handleVerifyBook = async () => {
        if (!issueData.book_number) return;
        try {
            const res = await api.get(`/library/verify-book?book_number=${issueData.book_number}`);
            if (res.data.valid) {
                setVerifiedBook({ valid: true, book: res.data.book });
            }
        } catch (error) {
            setVerifiedBook({ valid: false, error: 'Book not found' });
        }
    };

    const handleIssueSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const res = await api.post('/library/issue', issueData);
            toast.success(`Book "${res.data.book}" issued to ${res.data.patron}`);
            setIssueData({ ...issueData, patron_id: '', book_number: '' });
            setVerifiedPatron(null);
            setVerifiedBook(null);
            fetchTransactions();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Failed to issue book');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReturnSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        try {
            const res = await api.post('/library/return', returnData);
            toast.success(`Book "${res.data.book}" returned successfully`);
            setReturnData({ book_number: '' });
            fetchTransactions();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Failed to return book');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Issue / Return Panels */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="flex border-b border-slate-100">
                        <button
                            onClick={() => setActiveTab('issue')}
                            className={`flex-1 py-4 font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${activeTab === 'issue' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            <ArrowRight size={18} /> Issue Book
                        </button>
                        <button
                            onClick={() => setActiveTab('return')}
                            className={`flex-1 py-4 font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${activeTab === 'return' ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-500' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            <RotateCcw size={18} /> Return Book
                        </button>
                    </div>

                    <div className="p-6 flex-1">
                        {activeTab === 'issue' ? (
                            <form onSubmit={handleIssueSubmit} className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Patron Type</label>
                                    <div className="flex gap-4">
                                        {['Student', 'Teacher', 'Staff'].map(type => (
                                            <label key={type} className={`cursor-pointer border-2 rounded-xl px-4 py-2 text-sm font-semibold flex-1 text-center transition-all ${issueData.patron_type === type ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                                }`}>
                                                <input
                                                    type="radio"
                                                    className="hidden"
                                                    value={type}
                                                    checked={issueData.patron_type === type}
                                                    onChange={(e) => {
                                                        setIssueData({ ...issueData, patron_type: e.target.value });
                                                        setVerifiedPatron(null); // Reset verification on type change
                                                    }}
                                                />
                                                {type}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Patron ID (Adm No / Emp ID)</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            required
                                            className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 outline-none ${verifiedPatron?.valid === false ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-indigo-500'}`}
                                            placeholder="Enter ID..."
                                            value={issueData.patron_id}
                                            onChange={(e) => {
                                                setIssueData({ ...issueData, patron_id: e.target.value });
                                                if (verifiedPatron) setVerifiedPatron(null);
                                            }}
                                            onBlur={handleVerifyPatron}
                                        />
                                    </div>
                                    {verifiedPatron && (
                                        <div className={`text-xs mt-1.5 font-medium flex items-center gap-1 ${verifiedPatron.valid ? 'text-green-600' : 'text-red-500'}`}>
                                            {verifiedPatron.valid ? (
                                                <><CheckCircle size={12} /> Found: {verifiedPatron.name}</>
                                            ) : (
                                                <><span className="font-bold">!</span> {verifiedPatron.error}</>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Book Number</label>
                                    <div className="relative">
                                        <BookOpen className="absolute left-3 top-3 text-slate-400" size={18} />

                                        <input
                                            type="text"
                                            required
                                            className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 outline-none ${verifiedBook?.valid === false ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-indigo-500'}`}
                                            placeholder="Search by Title or Number..."
                                            value={issueData.book_number}
                                            onChange={(e) => handleBookSearch(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''))}
                                            onBlur={() => setTimeout(() => setBookSearchResults([]), 200)} // Delay hide to allow click
                                            autoComplete="off"
                                        />
                                        {bookSearchResults.length > 0 && (
                                            <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto custom-scrollbar">
                                                {bookSearchResults.map(book => (
                                                    <div
                                                        key={book.id}
                                                        onClick={() => selectBook(book)}
                                                        className={`px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center ${book.status !== 'Available' ? 'opacity-50 grayscale' : ''}`}
                                                    >
                                                        <div>
                                                            <div className="font-bold text-slate-700 text-sm">{book.title}</div>
                                                            <div className="text-xs text-slate-400">{book.book_number} • {book.author}</div>
                                                        </div>
                                                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${book.status === 'Available' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                            {book.status}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {verifiedBook && (
                                        <div className={`text-xs mt-1.5 font-medium flex items-center gap-1 ${verifiedBook.valid ? 'text-green-600' : 'text-red-500'}`}>
                                            {verifiedBook.valid ? (
                                                <><CheckCircle size={12} /> {verifiedBook.book.title} <span className="text-slate-400">({verifiedBook.book.status})</span></>
                                            ) : (
                                                <><span className="font-bold">!</span> {verifiedBook.error}</>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button type="submit" disabled={isSubmitting || verifiedPatron?.valid === false || verifiedBook?.valid === false} className={`w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 ${isSubmitting ? 'cursor-not-allowed' : ''}`}>
                                    {isSubmitting ? 'Processing...' : 'Confirm Issue'}
                                    {!isSubmitting && <ArrowRight size={18} />}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleReturnSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Book Number to Return</label>
                                    <div className="relative">
                                        <BookOpen className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input
                                            type="text"
                                            required
                                            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-lg"
                                            placeholder="Scan Transaction ID or Book No..."
                                            value={returnData.book_number}
                                            onChange={(e) => setReturnData({ ...returnData, book_number: e.target.value.replace(/[^a-zA-Z0-9 ]/g, '') })}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 ml-1">Currently supporting returns by Book Number only.</p>
                                </div>

                                <button type="submit" disabled={isSubmitting} className={`w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-teal-200 transition-all flex items-center justify-center gap-2`}>
                                    {isSubmitting ? 'Processing...' : 'Confirm Return'}
                                    {!isSubmitting && <CheckCircle size={18} />}
                                </button>
                            </form>
                        )}
                    </div >
                </div >

                {/* Recent Transactions List */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[500px]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Clock size={18} className="text-indigo-500" />
                                Recent Transactions
                            </h3>
                            <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded-full">{filteredTransactions.length} Records</span>
                        </div>
                        {/* Time Filters */}
                        <div className="flex gap-2">
                            {[
                                { key: 'all', label: 'All' },
                                { key: 'today', label: 'Today' },
                                { key: 'week', label: 'Last Week' },
                                { key: 'month', label: 'Last Month' }
                            ].map(filter => (
                                <button
                                    key={filter.key}
                                    onClick={() => setTimeFilter(filter.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeFilter === filter.key
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                        }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                        {filteredTransactions.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <Clock size={48} className="mb-4 opacity-20" />
                                <p>No transactions found.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 sticky top-0 text-slate-500 text-xs uppercase font-semibold">
                                    <tr>
                                        <th className="px-4 py-3">Book</th>
                                        <th className="px-4 py-3">Patron</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Action Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredTransactions.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-700">{item.book_title}</div>
                                                <div className="text-xs text-slate-400">{item.book_number}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-700">{item.patron_name}</div>
                                                <div className="text-xs text-slate-400">{item.patron_type} • {item.patron_id}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${item.status === 'Issued' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-green-50 text-green-600 border border-green-100'
                                                    }`}>
                                                    {item.status === 'Issued' ? <Clock size={12} /> : <CheckCircle size={12} />}
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">
                                                {item.status === 'Issued' ?
                                                    new Date(item.issue_date).toLocaleDateString('en-GB') :
                                                    new Date(item.return_date).toLocaleDateString('en-GB')
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div >
            </div >
        </div >
    );
};

export default IssueReturn;
