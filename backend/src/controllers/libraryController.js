const { pool } = require('../config/db');

// Get all books for a school
exports.getBooks = async (req, res) => {
    const { schoolId } = req.user;
    try {
        const result = await pool.query(
            'SELECT * FROM library_books WHERE school_id = $1 ORDER BY created_at DESC',
            [schoolId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ error: 'Server error fetching books' });
    }
};

// Search Books (by Title or Number)
exports.searchBooks = async (req, res) => {
    const { schoolId } = req.user;
    const { q } = req.query;

    if (!q) return res.json([]); // Return empty if no query

    try {
        const searchTerm = `%${q.trim()}%`;
        const result = await pool.query(
            `SELECT * FROM library_books 
             WHERE school_id = $1 
             AND (title ILIKE $2 OR book_number ILIKE $2)
             LIMIT 20`,
            [schoolId, searchTerm]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error searching books:', error);
        res.status(500).json({ error: 'Server error searching books' });
    }
};

// Add a new book (or multiple copies conceptually if we loop, but here just one entry)
// Add a new book
exports.addBook = async (req, res) => {
    console.log('Add Book Payload:', req.body);
    const { schoolId } = req.user;
    console.log('Context School ID:', schoolId);
    const { book_number, title, author, category } = req.body;

    if (!book_number || !title) {
        return res.status(400).json({ error: 'Book Number and Title are required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO library_books (school_id, book_number, title, author, category, status)
             VALUES ($1, $2, $3, $4, $5, 'Available')
             RETURNING *`,
            [schoolId, book_number, title, author, category]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding book:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Book with this number already exists' });
        }
        res.status(500).json({ error: `Server error adding book: ${error.message}` });
    }
};

// Update a book data
exports.updateBook = async (req, res) => {
    const { schoolId } = req.user;
    const { id } = req.params;
    const { title, author, category, book_number } = req.body;

    // Optional: Validate that book exists and belongs to school
    // The UPDATE ... WHERE school_id = $x ensures safety implicitly

    try {
        const result = await pool.query(
            `UPDATE library_books 
             SET title = $1, author = $2, category = $3, book_number = $4
             WHERE id = $5 AND school_id = $6
             RETURNING *`,
            [title, author, category, book_number, id, schoolId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Book number already in use' });
        }
        console.error('Error updating book:', error);
        res.status(500).json({ error: 'Server error updating book' });
    }
};

// Delete a book
exports.deleteBook = async (req, res) => {
    const { schoolId } = req.user;
    const { id } = req.params;

    try {
        // Check status first to prevent deleting issued books
        const checkRes = await pool.query(
            'SELECT status FROM library_books WHERE id = $1 AND school_id = $2',
            [id, schoolId]
        );

        if (checkRes.rows.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        if (checkRes.rows[0].status === 'Issued') {
            return res.status(400).json({ error: 'Cannot delete an issued book. Return it first.' });
        }

        // Proceed to delete
        // Note: constraint violations (e.g. transaction history) might prevent deletion unless we cascade or soft delete.
        // For strict integrity, let's assume we allow deletion if not issued, but DB foreign key might block if history exists.
        // If history exists, we probably shouldn't delete the book completely, or we should cascade delete transactions.
        // Assuming strict history, let's try delete and catch foreign key error.

        const deleteRes = await pool.query(
            'DELETE FROM library_books WHERE id = $1 AND school_id = $2 RETURNING *',
            [id, schoolId]
        );

        res.json({ message: 'Book deleted successfully' });

    } catch (error) {
        if (error.code === '23503') { // Foreign key violation
            return res.status(400).json({ error: 'Cannot delete book with transaction history.' });
        }
        console.error('Error deleting book:', error);
        res.status(500).json({ error: 'Server error deleting book' });
    }
};

// Issue a book
exports.issueBook = async (req, res) => {
    const { schoolId } = req.user;
    const { patron_type, patron_id, book_number } = req.body; // patron_id here is the user-visible ID (Admission No / Emp ID)

    if (!patron_type || !patron_id || !book_number) {
        return res.status(400).json({ error: 'All fields (Patron Type, ID, Book Number) are required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Find the Book
        const bookRes = await client.query(
            'SELECT * FROM library_books WHERE school_id = $1 AND book_number = $2',
            [schoolId, book_number]
        );

        if (bookRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Book not found' });
        }

        const book = bookRes.rows[0];
        if (book.status !== 'Available') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Book is currently ${book.status}` });
        }

        // 2. Find the Patron
        let patronName = '';
        let validPatron = false;

        const searchId = patron_id.trim();

        if (patron_type === 'Student') {
            console.log(`Looking for Student: ${searchId} in School: ${schoolId}`);
            // Check ID, Admission No (Case Insensitive), and Attendance ID
            const studentRes = await client.query(
                'SELECT name FROM students WHERE school_id = $1 AND (cast(id as varchar) = $2 OR LOWER(admission_no) = LOWER($2) OR attendance_id = $2)',
                [schoolId, searchId]
            );
            if (studentRes.rows.length > 0) {
                validPatron = true;
                patronName = studentRes.rows[0].name;
            }
        } else if (patron_type === 'Teacher') {
            console.log(`Looking for Teacher: ${searchId} in School: ${schoolId}`);
            // Check ID and Employee ID (Case Insensitive)
            const teacherRes = await client.query(
                'SELECT name FROM teachers WHERE school_id = $1 AND (cast(id as varchar) = $2 OR LOWER(employee_id) = LOWER($2))',
                [schoolId, searchId]
            );
            if (teacherRes.rows.length > 0) {
                validPatron = true;
                patronName = teacherRes.rows[0].name;
            }
        } else if (patron_type === 'Staff') {
            console.log(`Looking for Staff: ${searchId} in School: ${schoolId}`);
            // Check ID and Employee ID (Case Insensitive)
            const staffRes = await client.query(
                'SELECT name FROM staff WHERE school_id = $1 AND (cast(id as varchar) = $2 OR LOWER(employee_id) = LOWER($2))',
                [schoolId, searchId]
            );
            if (staffRes.rows.length > 0) {
                validPatron = true;
                patronName = staffRes.rows[0].name;
            }
        }

        if (!validPatron) {
            console.log(`Patron not found for type ${patron_type} and ID ${patron_id}`);
            await client.query('ROLLBACK');
            return res.status(404).json({ error: `Patron (${patron_type} with ID ${patron_id}) not found` });
        }

        // 3. Create Transaction
        // Calculate due date (e.g., 14 days from now)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        await client.query(
            `INSERT INTO library_transactions 
             (school_id, book_id, patron_type, patron_id, patron_name, due_date, issue_date, status)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 'Issued')`,
            [schoolId, book.id, patron_type, patron_id, patronName, dueDate]
        );

        // 4. Update Book Status
        await client.query(
            "UPDATE library_books SET status = 'Issued' WHERE id = $1",
            [book.id]
        );

        const { sendPushNotification } = require('../services/notificationService');

        // ... existing code ...

        await client.query('COMMIT');

        await sendPushNotification(patron_id, 'Library Update', `Book "${book.title}" Issued. Due: ${dueDate.toLocaleDateString()}`);
        res.json({ message: 'Book issued successfully', book: book.title, patron: patronName, due_date: dueDate });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error issuing book:', error);
        res.status(500).json({ error: 'Server error issuing book' });
    } finally {
        client.release();
    }
};

// Return a Book
exports.returnBook = async (req, res) => {
    const { schoolId } = req.user;
    const { book_number } = req.body;

    if (!book_number) {
        return res.status(400).json({ error: 'Book Number is required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Find the Book
        const bookRes = await client.query(
            'SELECT id, status, title FROM library_books WHERE school_id = $1 AND book_number = $2',
            [schoolId, book_number]
        );

        if (bookRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Book not found' });
        }

        const book = bookRes.rows[0];
        if (book.status !== 'Issued') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Book is not currently issued' });
        }

        // 2. Find active transaction
        const transRes = await client.query(
            `SELECT id FROM library_transactions 
             WHERE book_id = $1 AND status = 'Issued' 
             ORDER BY issue_date DESC LIMIT 1`,
            [book.id]
        );

        if (transRes.rows.length === 0) {
            // Should not happen if data is consistent
            await client.query('ROLLBACK');
            return res.status(500).json({ error: 'No active transaction found for this issued book' });
        }

        const transactionId = transRes.rows[0].id;

        // 3. DELETE Transaction (Do not keep history as per requirement)
        await client.query(
            `DELETE FROM library_transactions WHERE id = $1`,
            [transactionId]
        );

        // 4. Update Book Status
        await client.query(
            "UPDATE library_books SET status = 'Available' WHERE id = $1",
            [book.id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Book returned successfully (Transaction removed)', book: book.title });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error returning book:', error);
        res.status(500).json({ error: 'Server error returning book' });
    } finally {
        client.release();
    }
};

// Get Book Transactions (History)
exports.getTransactions = async (req, res) => {
    const { schoolId } = req.user;
    try {
        const result = await pool.query(
            `SELECT t.*, b.title as book_title, b.book_number 
             FROM library_transactions t
             JOIN library_books b ON t.book_id = b.id
             WHERE t.school_id = $1 
             ORDER BY t.issue_date DESC`,
            [schoolId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Server error fetching transactions' });
    }
};

// Helper to verify patron details
exports.verifyPatron = async (req, res) => {
    const { schoolId } = req.user;
    const { type, id } = req.query;

    if (!type || !id) return res.status(400).json({ error: 'Type and ID required' });

    try {
        const searchId = id.trim();
        let name = null;

        if (type === 'Student') {
            const res = await pool.query(
                'SELECT name FROM students WHERE school_id = $1 AND (cast(id as varchar) = $2 OR LOWER(admission_no) = LOWER($2) OR attendance_id = $2)',
                [schoolId, searchId]
            );
            if (res.rows.length > 0) name = res.rows[0].name;
        } else if (type === 'Teacher') {
            const res = await pool.query(
                'SELECT name FROM teachers WHERE school_id = $1 AND (cast(id as varchar) = $2 OR LOWER(employee_id) = LOWER($2))',
                [schoolId, searchId]
            );
            if (res.rows.length > 0) name = res.rows[0].name;
        } else if (type === 'Staff') {
            const res = await pool.query(
                'SELECT name FROM staff WHERE school_id = $1 AND (cast(id as varchar) = $2 OR LOWER(employee_id) = LOWER($2))',
                [schoolId, searchId]
            );
            if (res.rows.length > 0) name = res.rows[0].name;
        }

        if (name) {
            res.json({ valid: true, name });
        } else {
            res.status(404).json({ valid: false, error: 'Patron not found' });
        }
    } catch (error) {
        console.error('Verify Patron Error:', error);
        res.status(500).json({ error: 'Server error verifying patron' });
    }
};

// Helper to verify book details
exports.verifyBook = async (req, res) => {
    const { schoolId } = req.user;
    const { book_number } = req.query;

    if (!book_number) return res.status(400).json({ error: 'Book Number required' });

    try {
        const resDb = await pool.query(
            'SELECT title, status, author FROM library_books WHERE school_id = $1 AND book_number = $2',
            [schoolId, book_number.trim()]
        );

        if (resDb.rows.length > 0) {
            res.json({ valid: true, book: resDb.rows[0] });
        } else {
            res.status(404).json({ valid: false, error: 'Book not found' });
        }
    } catch (error) {
        console.error('Verify Book Error:', error);
        res.status(500).json({ error: 'Server error verifying book' });
    }
};
// Get My Issued Books (for Students/Teachers/Staff)
exports.getMyIssuedBooks = async (req, res) => {
    const { id, role, schoolId, linkedId } = req.user;

    try {
        let potentialIds = [id.toString()]; // Always include internal user ID string
        let patronType = '';

        if (role === 'TEACHER') {
            patronType = 'Teacher';
            if (linkedId) {
                const teacherRes = await pool.query('SELECT employee_id FROM teachers WHERE id = $1', [linkedId]);
                if (teacherRes.rows.length > 0 && teacherRes.rows[0].employee_id) potentialIds.push(teacherRes.rows[0].employee_id);
            } else {
                const teacherRes = await pool.query('SELECT employee_id FROM teachers WHERE id = $1', [id]); // Fallback if id was mapped manually
                if (teacherRes.rows.length > 0) potentialIds.push(teacherRes.rows[0].employee_id);
            }

        } else if (role === 'STUDENT') {
            patronType = 'Student';

            // Robust Student ID Resolution
            let student_id = linkedId || id;

            if (!linkedId && req.user.role === 'STUDENT') { // Fallback Logic
                const { email } = req.user;
                let studentRes = await pool.query(
                    'SELECT id FROM students WHERE school_id = $1 AND LOWER(email) = LOWER($2)',
                    [schoolId, email]
                );
                if (studentRes.rows.length === 0) {
                    const emailParts = email.split('@');
                    if (emailParts.length === 2) {
                        studentRes = await pool.query(
                            'SELECT id FROM students WHERE school_id = $1 AND LOWER(admission_no) = LOWER($2)',
                            [schoolId, emailParts[0]]
                        );
                    }
                }
                if (studentRes.rows.length > 0) student_id = studentRes.rows[0].id;
            }

            // Now fetch details using the resolved student_id
            if (student_id) {
                const studentDetailsRes = await pool.query('SELECT admission_no, attendance_id FROM students WHERE id = $1', [student_id]);
                if (studentDetailsRes.rows.length > 0) {
                    if (studentDetailsRes.rows[0].admission_no) potentialIds.push(studentDetailsRes.rows[0].admission_no);
                    if (studentDetailsRes.rows[0].attendance_id) potentialIds.push(studentDetailsRes.rows[0].attendance_id);
                }
            }

        } else if (['STAFF', 'DRIVER', 'TRANSPORT_MANAGER'].includes(role)) {
            patronType = 'Staff';
            if (linkedId) {
                const staffRes = await pool.query('SELECT employee_id FROM staff WHERE id = $1', [linkedId]);
                if (staffRes.rows.length > 0) potentialIds.push(staffRes.rows[0].employee_id);
            } else {
                const staffRes = await pool.query('SELECT employee_id FROM staff WHERE id = $1', [id]);
                if (staffRes.rows.length > 0 && staffRes.rows[0].employee_id) potentialIds.push(staffRes.rows[0].employee_id);
            }
        } else {
            return res.json({ books: [] }); // Admins or other roles might not have "issued books" in this context
        }

        const result = await pool.query(
            `SELECT t.*, b.title as book_title, b.book_number, b.author, b.category, b.book_number as isbn
             FROM library_transactions t
             JOIN library_books b ON t.book_id = b.id
             WHERE t.school_id = $1 
             AND t.patron_type = $2
             AND t.patron_id = ANY($3::text[])
             AND t.status = 'Issued'
             ORDER BY t.due_date ASC`,
            [schoolId, patronType, potentialIds]
        );

        // Map fields to match specific UI needs if any (e.g. title logic from join)
        const books = result.rows.map(row => ({
            ...row,
            title: row.book_title,
            isbn: row.isbn || row.book_number // Use book_number as proxy for ISBN if not standard
        }));

        res.json({ books });

    } catch (error) {
        console.error('Error fetching my issued books:', error);
        res.status(500).json({ error: 'Server error fetching your books' });
    }
};
