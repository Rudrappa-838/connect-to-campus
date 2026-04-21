const { pool } = require('../config/db');

// --- Fee Structures ---

// Get Fee Structures (Optionally filtered by class)
exports.getFeeStructures = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id } = req.query;

        let query = `
            SELECT fs.*, c.name as class_name 
            FROM fee_structures fs
            JOIN classes c ON fs.class_id = c.id
            WHERE fs.school_id = $1
        `;
        const params = [school_id];

        if (class_id) {
            query += ` AND fs.class_id = $2`;
            params.push(class_id);
        }

        query += ` ORDER BY fs.due_date ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching fee structures' });
    }
};

// Create Fee Structure
exports.createFeeStructure = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id, title, amount, due_date, type } = req.body;

        const feeType = type || 'CLASS_DEFAULT';

        const result = await pool.query(
            `INSERT INTO fee_structures (school_id, class_id, title, amount, due_date, type)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [school_id, class_id, title, amount, due_date, feeType]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating fee structure' });
    }
};

// Create Fee Structure SPECIFICALLY for a Student
exports.createStudentFeeStructure = async (req, res) => {
    const client = await pool.connect();
    try {
        const school_id = req.user.schoolId;
        const { student_id, title, amount, due_date, type } = req.body;

        await client.query('BEGIN');

        // 1. Get Student Class
        const studRes = await client.query('SELECT class_id FROM students WHERE id = $1', [student_id]);
        if (studRes.rows.length === 0) throw new Error('Student not found');
        const class_id = studRes.rows[0].class_id;

        // 2. Create Fee Structure (INDIVIDUAL or types like TRANSPORT)
        const feeType = type || 'INDIVIDUAL';
        const feeRes = await client.query(
            `INSERT INTO fee_structures (school_id, class_id, title, amount, due_date, type)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, amount, due_date, type`,
            [school_id, class_id, title, amount, due_date, feeType]
        );
        const fee = feeRes.rows[0];

        // 3. Assign to Student
        await client.query(
            `INSERT INTO student_fees (school_id, student_id, fee_structure_id) VALUES ($1, $2, $3)`,
            [school_id, student_id, fee.id]
        );

        await client.query('COMMIT');
        res.status(201).json(fee);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Error creating student fee' });
    } finally {
        client.release();
    }
};

// Delete Fee Structure
exports.deleteFeeStructure = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;

        // ON DELETE CASCADE in schema handles payments deletion if structure is deleted.
        const result = await pool.query(
            `DELETE FROM fee_structures WHERE id = $1 AND school_id = $2 RETURNING *`,
            [id, school_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ message: 'Fee structure not found' });
        res.json({ message: 'Fee structure deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting fee structure' });
    }
};

// Update Fee Structure
exports.updateFeeStructure = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const { title, amount, due_date } = req.body;

        const result = await pool.query(
            `UPDATE fee_structures 
             SET title = $1, amount = $2, due_date = $3 
             WHERE id = $4 AND school_id = $5 
             RETURNING *`,
            [title, amount, due_date, id, school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Fee structure not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating fee structure' });
    }
};

// Get Allocations for a Fee Structure (For INDIVIDUAL type)
exports.getFeeAllocations = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params; // fee_structure_id
        const { section_id } = req.query;

        // 1. Get Fee Info
        const feeRes = await pool.query('SELECT class_id FROM fee_structures WHERE id = $1 AND school_id = $2', [id, school_id]);
        if (feeRes.rows.length === 0) return res.status(404).json({ message: 'Fee not found' });
        const class_id = feeRes.rows[0].class_id;

        // 2. Get Students in Class
        let studentQuery = `SELECT id, name, admission_no, section_id FROM students WHERE school_id = $1 AND class_id = $2`;
        const params = [school_id, class_id];
        if (section_id) {
            studentQuery += ` AND section_id = $3`;
            params.push(section_id);
        }
        studentQuery += ` ORDER BY name ASC`;
        const studentsRes = await pool.query(studentQuery, params);

        // 3. Get Existing Allocations
        const allocRes = await pool.query(`SELECT student_id FROM student_fees WHERE fee_structure_id = $1`, [id]);
        const allocatedIds = new Set(allocRes.rows.map(r => r.student_id));

        // 4. Map
        const students = studentsRes.rows.map(s => ({
            id: s.id,
            name: s.name,
            admission_no: s.admission_no,
            is_assigned: allocatedIds.has(s.id)
        }));

        res.json(students);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching allocations' });
    }
};

// Update Allocations (Add/Remove students)
exports.updateFeeAllocations = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params; // fee_structure_id
        const { action, student_ids } = req.body; // action: 'assign' | 'remove'

        await client.query('BEGIN');

        if (action === 'assign') {
            for (const sid of student_ids) {
                await client.query(
                    `INSERT INTO student_fees (school_id, student_id, fee_structure_id) 
                     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                    [req.user.schoolId, sid, id]
                );
            }
        } else if (action === 'remove') {
            await client.query(
                `DELETE FROM student_fees WHERE fee_structure_id = $1 AND student_id = ANY($2::int[])`,
                [id, student_ids]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Allocations updated' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Error updating allocations' });
    } finally {
        client.release();
    }
};

// --- Student Fee Details ---

// Get Student Fees (Assigned vs Paid)
exports.getStudentFeeDetails = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { student_id } = req.params;

        // 1. Get Student's Class
        const studentRes = await pool.query(`SELECT class_id FROM students WHERE id = $1 AND school_id = $2`, [student_id, school_id]);
        if (studentRes.rows.length === 0) return res.status(404).json({ message: 'Student not found' });
        const class_id = studentRes.rows[0].class_id;

        // 2. Get Fees: (Type='CLASS_DEFAULT' AND class_id=StudentClass) OR (id IN student_fees)
        const query = `
            SELECT 
                fs.id as fee_structure_id,
                fs.title,
                fs.amount as total_amount,
                fs.due_date,
                fs.type,
                COALESCE(SUM(fp.amount_paid), 0) as paid_amount
            FROM fee_structures fs
            LEFT JOIN fee_payments fp ON fs.id = fp.fee_structure_id AND fp.student_id = $2
            WHERE fs.school_id = $1 
            AND (
                (fs.type = 'CLASS_DEFAULT' AND fs.class_id = $3)
                OR 
                (fs.id IN (SELECT fee_structure_id FROM student_fees WHERE student_id = $2))
            )
            GROUP BY fs.id
            ORDER BY fs.due_date ASC
        `;

        const result = await pool.query(query, [school_id, student_id, class_id]);

        // Calculate status for each
        const data = result.rows.map(row => ({
            ...row,
            balance: parseFloat(row.total_amount) - parseFloat(row.paid_amount),
            status: parseFloat(row.paid_amount) >= parseFloat(row.total_amount) ? 'Paid' : (parseFloat(row.paid_amount) > 0 ? 'Partial' : 'Unpaid')
        }));

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching student fees' });
    }
};

exports.getMyFeeStatus = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { email, linkedId } = req.user;
        let student_id = linkedId;
        let class_id = null;

        // Resolve Student ID
        if (student_id) {
            const sRes = await pool.query('SELECT class_id FROM students WHERE id = $1', [student_id]);
            if (sRes.rows.length > 0) {
                class_id = sRes.rows[0].class_id;
            } else {
                return res.status(404).json({ error: 'Student profile not found' });
            }
        } else {
            let studentRes = await pool.query(
                'SELECT id, class_id FROM students WHERE school_id = $1 AND LOWER(email) = LOWER($2)',
                [school_id, email]
            );
            if (studentRes.rows.length === 0) {
                const emailParts = email.split('@');
                if (emailParts.length === 2) {
                    studentRes = await pool.query(
                        'SELECT id, class_id FROM students WHERE school_id = $1 AND LOWER(admission_no) = LOWER($2)',
                        [school_id, emailParts[0]]
                    );
                }
            }
            if (studentRes.rows.length > 0) {
                student_id = studentRes.rows[0].id;
                class_id = studentRes.rows[0].class_id;
            } else {
                return res.status(404).json({ error: 'Student profile not found' });
            }
        }

        // Logic from getStudentFeeDetails
        const query = `
            SELECT 
                fs.id as fee_structure_id,
                fs.title,
                fs.amount as total_amount,
                fs.due_date,
                fs.type,
                COALESCE(SUM(fp.amount_paid), 0) as paid_amount
            FROM fee_structures fs
            LEFT JOIN fee_payments fp ON fs.id = fp.fee_structure_id AND fp.student_id = $2
            WHERE fs.school_id = $1 
            AND (
                (fs.type = 'CLASS_DEFAULT' AND fs.class_id = $3)
                OR 
                (fs.id IN (SELECT fee_structure_id FROM student_fees WHERE student_id = $2))
            )
            GROUP BY fs.id
            ORDER BY fs.due_date ASC
        `;

        const result = await pool.query(query, [school_id, student_id, class_id]);

        const data = result.rows.map(row => ({
            ...row,
            balance: parseFloat(row.total_amount) - parseFloat(row.paid_amount),
            status: parseFloat(row.paid_amount) >= parseFloat(row.total_amount) ? 'Paid' : (parseFloat(row.paid_amount) > 0 ? 'Partial' : 'Unpaid')
        }));

        res.json(data);

    } catch (error) {
        console.error('Error fetching my fees:', error);
        res.status(500).json({ message: 'Error fetching fee status' });
    }
};

// Record Payment
exports.recordPayment = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const school_id = req.user.schoolId;
        let { student_id, fee_structure_id, amount, method, remarks } = req.body;

        // Clean amount: remove commas if string
        if (typeof amount === 'string') {
            amount = amount.replace(/,/g, '');
        }

        console.log('Recording Payment Payload:', { school_id, student_id, fee_structure_id, amount, method });

        // Generate Receipt Number: Format RC-YYYYMMDD-XXXX
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

        // Get the latest receipt number GLOBALLY for today
        const latestRes = await client.query(
            `SELECT receipt_no FROM fee_payments 
             WHERE receipt_no LIKE $1
             ORDER BY receipt_no DESC LIMIT 1`,
            [`RC-${dateStr}-%`]
        );

        let nextSeq = 1;
        if (latestRes.rows.length > 0) {
            const lastReceipt = latestRes.rows[0].receipt_no;
            const parts = lastReceipt.split('-');
            if (parts.length === 3) {
                nextSeq = parseInt(parts[2]) + 1;
            }
        }

        const receiptNo = `RC-${dateStr}-${String(nextSeq).padStart(4, '0')}`;

        console.log('Generated Receipt No:', receiptNo);

        const result = await client.query(
            `INSERT INTO fee_payments (school_id, student_id, fee_structure_id, amount_paid, payment_method, remarks, receipt_no, payment_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE) RETURNING *`,
            [school_id, student_id, fee_structure_id, amount, method, remarks, receiptNo]
        );

        console.log('Payment Recorded Successfully, ID:', result.rows[0].id);

        await client.query('COMMIT');

        // Notification - Isolated so it doesn't fail the request if it errors
        try {
            const { sendPushNotification } = require('../services/notificationService');
            // Use pool (not client) here since transaction is already committed
            const studentRes = await pool.query('SELECT name FROM students WHERE id = $1', [student_id]);
            if (studentRes.rows.length > 0) {
                const studentName = studentRes.rows[0].name;
                // Explicitly use 'Student' as roleHint so it reaches the student's dashboard
                await sendPushNotification(student_id, 'Fee Receipt', `Received payment of ₹${amount} for ${studentName}. Receipt: ${receiptNo}`, 'Student');
            }
        } catch (notifError) {
            console.error('Notification failed (Payment Success):', notifError);
        }

        res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('ERROR RECORDING PAYMENT:', error);
        res.status(500).json({ message: 'Error recording payment: ' + error.message });
    } finally {
        client.release();
    }
};

// Get Payment History for a Student
exports.getPaymentHistory = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { student_id } = req.params;

        const result = await pool.query(`
            SELECT fp.*, fs.title as fee_title
            FROM fee_payments fp
            JOIN fee_structures fs ON fp.fee_structure_id = fs.id
            WHERE fp.school_id = $1 AND fp.student_id = $2
            ORDER BY fp.created_at DESC
        `, [school_id, student_id]);

        // Explicitly fallback in JS to ensure date is never missing (fixes 1970 issue)
        const historyData = result.rows.map(row => ({
            ...row,
            payment_date: row.payment_date || row.created_at
        }));

        res.json(historyData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching history' });
    }
};

// Update Payment Details
exports.updateFeePayment = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const { amount, method, remarks, date } = req.body;

        // Coalesce date to ensure it doesn't break if not provided, though typically date is generated. 
        // We'll allow editing payment_date if provided.
        const result = await pool.query(
            `UPDATE fee_payments 
             SET amount_paid = $1, payment_method = $2, remarks = $3, payment_date = COALESCE($4, payment_date, CURRENT_DATE)
             WHERE id = $5 AND school_id = $6 RETURNING *`,
            [amount, method, remarks, date, id, school_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ message: 'Payment not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating payment' });
    }
};

// Delete Payment
exports.deleteFeePayment = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM fee_payments WHERE id = $1 AND school_id = $2 RETURNING *`,
            [id, school_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ message: 'Payment not found' });
        res.json({ message: 'Payment deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting payment' });
    }
};

// Update Fee Structure
exports.updateFeeStructure = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { id } = req.params;
        const { title, amount, due_date } = req.body;

        const result = await pool.query(
            `UPDATE fee_structures 
             SET title = $1, amount = $2, due_date = $3
             WHERE id = $4 AND school_id = $5 RETURNING *`,
            [title, amount, due_date, id, school_id]
        );

        if (result.rows.length === 0) return res.status(404).json({ message: 'Fee structure not found' });
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating fee structure' });
    }
};

// --- Dashboard / Overview ---

// Get Overview for Class & Section
// Get Overview for Class & Section (or All Classes)
exports.getClassSectionFullOverview = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { class_id, section_id } = req.query;

        // 1. Get Students
        let studentQuery = `
            SELECT 
                s.id, s.name, s.admission_no, s.class_id, s.section_id,
                -- Calculate Total Expected Fee
                (
                    COALESCE((SELECT SUM(amount) FROM fee_structures WHERE school_id = $1 AND class_id = s.class_id AND type = 'CLASS_DEFAULT'), 0) 
                    +
                    COALESCE((SELECT SUM(fs.amount) FROM fee_structures fs 
                              JOIN student_fees sf ON fs.id = sf.fee_structure_id 
                              WHERE sf.student_id = s.id), 0)
                ) as total_fee
            FROM students s
            WHERE s.school_id = $1 AND (s.status IS NULL OR s.status != 'Deleted')
        `;

        const params = [school_id];
        let pIdx = 2;

        if (class_id) {
            studentQuery += ` AND s.class_id = $${pIdx++}`;
            params.push(class_id);
        }
        if (section_id) {
            studentQuery += ` AND s.section_id = $${pIdx++}`;
            params.push(section_id);
        }

        studentQuery += ` ORDER BY s.class_id, s.name ASC`;

        const studentsRes = await pool.query(studentQuery, params);
        const students = studentsRes.rows;

        // 2. Get Payments
        // We fetch totals for these students
        const studentIds = students.map(s => s.id);
        let paymentsMap = {};

        if (studentIds.length > 0) {
            const paymentsRes = await pool.query(`
                SELECT student_id, SUM(amount_paid) as total_paid
                FROM fee_payments 
                WHERE school_id = $1 AND student_id = ANY($2::int[])
                GROUP BY student_id
            `, [school_id, studentIds]);

            paymentsRes.rows.forEach(r => {
                paymentsMap[r.student_id] = parseFloat(r.total_paid);
            });
        }

        // 3. Process Data & Counts
        let totalExpected = 0;
        let totalCollected = 0;
        let countPaid = 0;
        let countUnpaid = 0;
        let countPartial = 0;

        const studentData = students.map(s => {
            const paid = paymentsMap[s.id] || 0;
            const total = parseFloat(s.total_fee);
            const balance = total - paid;

            totalExpected += total;
            totalCollected += paid;

            let status = 'Unpaid';
            if (total === 0) status = 'No Fees';
            else if (paid >= total) { status = 'Paid'; countPaid++; }
            else if (paid > 0) { status = 'Partial'; countPartial++; }
            else { status = 'Unpaid'; countUnpaid++; }

            return {
                id: s.id,
                name: s.name,
                admission_no: s.admission_no,
                class_id: s.class_id,
                total_fee: total,
                paid: paid,
                balance: balance,
                status: status
            };
        });

        res.json({
            summary: {
                total_students: students.length,
                total_expected: totalExpected,
                total_collected: totalCollected,
                total_pending: totalExpected - totalCollected,
                count_paid: countPaid,
                count_unpaid: countUnpaid,
                count_partial: countPartial
            },
            students: studentData
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching class overview' });
    }
};
