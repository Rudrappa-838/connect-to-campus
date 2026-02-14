import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';
import { Plus, Search, Book, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const BookManagement = () => {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        book_number: '',
        to_book_number: '',
        quantity: 1,
        title: '',
        author: '',
        category: ''
    });

    useEffect(() => {
        fetchBooks();
    }, []);

    const fetchBooks = async () => {
        try {
            const res = await api.get('/library/books');
            setBooks(res.data);
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch books');
        } finally {
            setLoading(false);
        }
    };

    // Helper to separate prefix and number
    const getPrefixAndNumber = (str) => {
        if (typeof str !== 'string' || !str) return { prefix: '', num: null };
        let i = str.length - 1;
        while (i >= 0) {
            const code = str.charCodeAt(i);
            if (code >= 48 && code <= 57) { // 0-9
                i--;
            } else {
                break;
            }
        }
        const prefix = str.slice(0, i + 1);
        const numberPart = str.slice(i + 1);
        return { prefix, num: numberPart ? parseInt(numberPart, 10) : null };
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        let newFormData = { ...formData, [name]: value };

        // Auto-calculate quantity if From or To changes
        if (name === 'book_number' || name === 'to_book_number') {
            const fromVal = name === 'book_number' ? value : formData.book_number;
            const toVal = name === 'to_book_number' ? value : formData.to_book_number;

            if (fromVal && toVal) {
                const start = getPrefixAndNumber(fromVal);
                const end = getPrefixAndNumber(toVal);

                if (start.prefix === end.prefix && start.num !== null && end.num !== null && end.num >= start.num) {
                    newFormData.quantity = end.num - start.num + 1;
                }
            } else if (!toVal) {
                // If To is cleared, default to 1 (or keep user's manual quantity if we tracked it, but simpler to reset or leave editable)
                // For safety with the "From" logic, let's allow manual quantity if To is empty.
                // We don't force it to 1 here to allow user to type in quantity field freely unless they just cleared To.
                // Actually, if they clear To, we should probably reset Qty to 1 to avoid confusion, or leave it.
                // Let's reset to 1 if it looks like they are switching modes.
                if (name === 'to_book_number') newFormData.quantity = 1;
            }
        }

        if (name === 'quantity') {
            const qty = parseInt(value);
            newFormData.quantity = qty > 0 ? qty : 1;
        }

        setFormData(newFormData);
    };

    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [addMode, setAddMode] = useState('single');

    const handleDuplicate = (book) => {
        setIsEditing(false);
        setEditId(null);
        setFormData({
            book_number: '',
            to_book_number: '',
            quantity: 1,
            title: book.title,
            author: book.author || '',
            category: book.category || ''
        });
        setShowModal(true);
    };

    const handleEdit = (book) => {
        setIsEditing(true);
        setEditId(book.id);
        setFormData({
            book_number: book.book_number,
            to_book_number: '', // Edit usually single book
            quantity: 1,
            title: book.title,
            author: book.author || '',
            category: book.category || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (isSubmitting) return;
        if (!window.confirm('Are you sure you want to delete this book?')) return;
        setIsSubmitting(true);
        try {
            await api.delete(`/library/books/${id}`);
            toast.success('Book deleted successfully');
            fetchBooks();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.error || 'Failed to delete book');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper to generate sequence (Regex-free)
    const generateBookNumbers = (startStr, count) => {
        if (typeof startStr !== 'string' || !startStr) return [];

        const { prefix, num } = getPrefixAndNumber(startStr);
        if (num === null) {
            // No number at end, suffix with -1, -2 etc
            return Array.from({ length: count }, (_, idx) => `${startStr}-${idx + 1}`);
        }

        // We need to preserve padding.
        // Re-extracting number string length for padding
        // This is a bit inefficient but safe:
        // slice(prefix.length) gives the number part string
        const numStr = startStr.slice(prefix.length);
        const len = numStr.length;

        return Array.from({ length: count }, (_, idx) => {
            return `${prefix}${String(num + idx).padStart(len, '0')}`;
        });
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const isSubmittingRef = React.useRef(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isSubmitting || isSubmittingRef.current) return;

        console.log('Submitting Form Data:', formData);

        // Basic Validation
        if (!formData.title?.trim()) {
            toast.error('Book Title is required');
            return;
        }

        setIsSubmitting(true);
        isSubmittingRef.current = true;

        try {
            if (isEditing) {
                try {
                    await api.put(`/library/books/${editId}`, formData);
                    toast.success('Book updated successfully');
                    setShowModal(false);
                    setIsEditing(false);
                    setEditId(null);
                    setFormData({ book_number: '', to_book_number: '', quantity: 1, title: '', author: '', category: '' });
                    fetchBooks();
                } catch (error) {
                    console.error('Update Error:', error);
                    toast.error(error.response?.data?.error || 'Failed to update book');
                }
                return;
            }

            let bookNumbers = [];
            let quantity = parseInt(formData.quantity) || 1;
            const enteredBookNumber = formData.book_number ? formData.book_number.trim() : '';
            const enteredToBookNumber = formData.to_book_number ? formData.to_book_number.trim() : '';

            // STRICT Validation for Range
            if (enteredToBookNumber) {
                if (!enteredBookNumber) {
                    toast.error('Please enter a Start Book Number to use a range.');
                    // Don't just return, we need to unlock. But since the catch will catch errors, or wait, throwing error or handling unlock is better.
                    // Given the structure, let's just throw or return after unlocking.
                    // Instead of complex flow, let's just throw an error-like object or return normally but reset lock in finally.
                    throw new Error('Please enter a Start Book Number to use a range.');
                }
                const start = getPrefixAndNumber(enteredBookNumber);
                const end = getPrefixAndNumber(enteredToBookNumber);

                if (start.prefix !== end.prefix) {
                    throw new Error(`Prefix mismatch! Start: "${start.prefix}", End: "${end.prefix}". They must be same.`);
                }
                if (start.num === null || end.num === null) {
                    throw new Error('Could not detect numbers in the book codes.');
                }
                if (end.num < start.num) {
                    throw new Error('End number cannot be smaller than Start number.');
                }
                // Recalculate quantity to be super safe
                quantity = end.num - start.num + 1;
            }

            console.log('Form Submit:', { quantity, enteredBookNumber, enteredToBookNumber, formData });

            // Generation Logic
            if (!enteredBookNumber) {
                // Auto-generate ID if empty
                // Use a timestamp + random component for basic uniqueness
                const timestamp = Date.now().toString().slice(-6);
                // random 2 chars
                const random = Math.floor(Math.random() * 90 + 10);
                const baseId = `BK-${timestamp}${random}`;

                if (quantity > 1) {
                    bookNumbers = Array.from({ length: quantity }, (_, i) => `${baseId}-${i + 1}`);
                } else {
                    bookNumbers = [baseId];
                }
            } else if (quantity > 1) {
                // Auto-generate sequence starting from entered book_number
                bookNumbers = generateBookNumbers(enteredBookNumber, quantity);
            } else {
                // Single or Comma Separated
                bookNumbers = enteredBookNumber.split(',').map(n => n.trim()).filter(n => n);
            }

            console.log('Generated Book Numbers:', bookNumbers);

            if (bookNumbers.length === 0) return;

            // Show loading toast for large batches
            const toastId = toast.loading(`Adding ${bookNumbers.length} books...`);

            try {
                let successCount = 0;
                let errors = [];

                await Promise.all(bookNumbers.map(async (num) => {
                    try {
                        await api.post('/library/books', {
                            ...formData,
                            book_number: num,
                            // exclude quantity from payload
                        });
                        successCount++;
                    } catch (err) {
                        console.error(`Error adding ${num}:`, err);
                        errors.push(`${num}: ${err.response?.data?.error || err.message}`);
                    }
                }));

                toast.dismiss(toastId);

                if (successCount > 0) {
                    toast.success(`${successCount} book(s) added successfully`);
                    setShowModal(false);
                    setFormData({ book_number: '', to_book_number: '', quantity: 1, title: '', author: '', category: '' });
                    fetchBooks();
                }

                if (errors.length > 0) {
                    console.error('Bulk add errors:', errors);
                    // Show first error reason to user
                    toast.error(`Failed to add ${errors.length} books. Reason: ${errors[0].split(': ')[1]}`);
                }

            } catch (error) {
                toast.dismiss(toastId);
                console.error('Global Add Error:', error);
                toast.error(`Critical error: ${error.message}`);
            }
        } catch (error) {
            // Handle validaton errors thrown above
            if (error.message) toast.error(error.message);
            else console.error(error);
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false;
        }
    };

    const filteredBooks = books.filter(book =>
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.book_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'list'

    // Grouping Logic
    const getGroupedBooks = () => {
        const groups = {};

        filteredBooks.forEach(book => {
            const key = `${book.title.toLowerCase()}-${book.author?.toLowerCase() || ''}-${book.category?.toLowerCase() || ''}`;
            if (!groups[key]) {
                groups[key] = {
                    id: book.id, // use first book's ID as ref
                    title: book.title,
                    author: book.author,
                    category: book.category,
                    total: 0,
                    available: 0,
                    issued: 0,
                    lost: 0,
                    books: []
                };
            }
            groups[key].total++;
            groups[key].books.push(book);
            if (book.status === 'Available') groups[key].available++;
            else if (book.status === 'Issued') groups[key].issued++;
            else groups[key].lost++;
        });

        return Object.values(groups);
    };

    const groupedBooks = getGroupedBooks();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Library Books Catalog</h3>
                    <p className="text-slate-500 text-sm">Manage your library inventory</p>
                </div>
                <button
                    onClick={() => {
                        setIsEditing(false);
                        setEditId(null);
                        setAddMode('single');
                        setFormData({ book_number: '', to_book_number: '', quantity: 1, title: '', author: '', category: '' });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus size={18} />
                    Add New Book
                </button>
            </div>

            {/* Search and Filter */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search by Title, Author, or Book Number..."
                        autoComplete="off"
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''))}
                    />
                </div>

                {/* View Toggles */}
                <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                    <button
                        onClick={() => setViewMode('grouped')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'grouped' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Grouped View
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        Detailed List
                    </button>
                </div>
            </div>

            {/* Books Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                            {viewMode === 'list' ? (
                                <>
                                    <th className="p-4">Book No.</th>
                                    <th className="p-4">Title</th>
                                    <th className="p-4">Author</th>
                                    <th className="p-4">Category</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Added On</th>
                                    <th className="p-4 text-right">Actions</th>
                                </>
                            ) : (
                                <>
                                    <th className="p-4">Title</th>
                                    <th className="p-4">Author</th>
                                    <th className="p-4">Category</th>
                                    <th className="p-4">Inventory Status</th>
                                    <th className="p-4 text-right">Actions</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-500">Loading books...</td></tr>
                        ) : (viewMode === 'list' ? filteredBooks : groupedBooks).length === 0 ? (
                            <tr><td colSpan="7" className="p-8 text-center text-slate-500">No books found.</td></tr>
                        ) : (
                            viewMode === 'list' ? (
                                filteredBooks.map(book => (
                                    <tr key={book.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4 font-medium text-slate-700">{book.book_number}</td>
                                        <td className="p-4 text-slate-800 font-semibold">{book.title}</td>
                                        <td className="p-4 text-slate-600">{book.author || '-'}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                                                {book.category || 'General'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${book.status === 'Available' ? 'bg-green-100 text-green-700' :
                                                book.status === 'Issued' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {book.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-500">{new Date(book.created_at).toLocaleDateString('en-GB')}</td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button
                                                onClick={() => handleDuplicate(book)}
                                                className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Add Another Copy"
                                            >
                                                <Plus size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(book)}
                                                className="text-amber-600 hover:bg-amber-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Edit Book"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(book.id)}
                                                disabled={isSubmitting}
                                                className={`text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ${isSubmitting ? 'cursor-not-allowed opacity-50' : ''}`}
                                                title="Delete Book"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                groupedBooks.map((group, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-slate-800 font-semibold">{group.title}</td>
                                        <td className="p-4 text-slate-600">{group.author || '-'}</td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                                                {group.category || 'General'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                    <span className="text-green-600">{group.available} Available</span>
                                                    <span className="text-slate-300">/</span>
                                                    <span className="text-slate-600">{group.total} Total</span>
                                                </div>
                                                <div className="w-full max-w-[140px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${(group.available / group.total) * 100}%` }}
                                                    />
                                                </div>
                                                {group.issued > 0 && (
                                                    <div className="text-xs text-amber-600 mt-0.5">
                                                        {group.issued} Issued
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleDuplicate({ title: group.title, author: group.author, category: group.category })}
                                                className="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium border border-indigo-100 hover:border-indigo-200"
                                            >
                                                + Add Copies
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Book Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Book className="text-indigo-600" size={20} />
                                {isEditing ? 'Edit Book Details' : (formData.title ? 'Add Another Copy' : 'Add New Book')}
                            </h3>
                            <button onClick={() => { setShowModal(false); setIsEditing(false); setEditId(null); }} className="text-slate-400 hover:text-slate-600">
                                <Plus className="rotate-45" size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Start Book Number <span className="text-slate-400 text-xs font-normal">(e.g. A-01)</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="book_number"
                                        autoComplete="off"
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Start Number"
                                        value={formData.book_number}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                {!isEditing && (
                                    <>
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                End Book Number <span className="text-slate-400 text-xs font-normal">(Optional)</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="to_book_number"
                                                autoComplete="off"
                                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                                placeholder="End Number"
                                                value={formData.to_book_number}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {!isEditing && (
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 transition-all">
                                    {formData.to_book_number ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-600 font-medium">Quantity to Add:</span>
                                                <span className={`text-2xl font-bold ${(() => {
                                                    const s = getPrefixAndNumber(formData.book_number);
                                                    const e = getPrefixAndNumber(formData.to_book_number);
                                                    return s.prefix !== e.prefix || e.num < s.num;
                                                })() ? 'text-red-500' : 'text-indigo-600'
                                                    }`}>
                                                    {(() => {
                                                        const s = getPrefixAndNumber(formData.book_number);
                                                        const e = getPrefixAndNumber(formData.to_book_number);
                                                        if (s.prefix !== e.prefix) return "Error";
                                                        if (e.num < s.num) return "Error";
                                                        return formData.quantity;
                                                    })()}
                                                </span>
                                            </div>
                                            {(() => {
                                                const s = getPrefixAndNumber(formData.book_number);
                                                const e = getPrefixAndNumber(formData.to_book_number);
                                                if (!formData.book_number) return <p className="text-sm text-red-500">Start Book Number is required to calculate range.</p>;
                                                if (s.prefix !== e.prefix) return <p className="text-sm text-red-500">Prefix mismatch! Start and End must share the same prefix (e.g. <b>LIB</b>-01 and <b>LIB</b>-10).</p>;
                                                if (e.num < s.num) return <p className="text-sm text-red-500">End number cannot be smaller than Start number.</p>;
                                                return <p className="text-sm text-indigo-600">Calculated automatically from {formData.book_number} to {formData.to_book_number}</p>;
                                            })()}
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                                            <input
                                                type="number"
                                                name="quantity"
                                                min="1"
                                                max="1000"
                                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                                value={formData.quantity}
                                                onChange={handleInputChange}
                                            />
                                            <p className="text-xs text-slate-400 mt-1">Enter Quantity manually or use 'End Book Number' to auto-calculate.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Book Title <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="title"
                                    required
                                    autoComplete="off"
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. Introduction to Physics"
                                    value={formData.title}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Author</label>
                                <input
                                    type="text"
                                    name="author"
                                    autoComplete="off"
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Author Name"
                                    value={formData.author}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                <input
                                    type="text"
                                    name="category"
                                    autoComplete="off"
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. Science, Fiction, Reference"
                                    value={formData.category}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowModal(false); setIsEditing(false); setEditId(null); }}
                                    className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Processing...' : (isEditing ? 'Update Book' : (formData.quantity > 1 ? `Generates ${formData.quantity} Books` : 'Add Book'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookManagement;
