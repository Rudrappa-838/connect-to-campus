const { pool } = require('../config/db');

// --- Hostels ---

exports.getAllHostels = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM hostels WHERE school_id = $1 ORDER BY name',
            [req.user.schoolId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching hostels:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createHostel = async (req, res) => {
    const { name, type, address, warden_name, contact_number } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO hostels (name, type, address, warden_name, contact_number, school_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, type, address, warden_name, contact_number, req.user.schoolId]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating hostel:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateHostel = async (req, res) => {
    const { id } = req.params;
    const { name, type, address, warden_name, contact_number } = req.body;
    try {
        const result = await pool.query(
            'UPDATE hostels SET name = $1, type = $2, address = $3, warden_name = $4, contact_number = $5 WHERE id = $6 AND school_id = $7 RETURNING *',
            [name, type, address, warden_name, contact_number, id, req.user.schoolId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Hostel not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating hostel:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteHostel = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'DELETE FROM hostels WHERE id = $1 AND school_id = $2 RETURNING *',
            [id, req.user.schoolId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Hostel not found' });
        }
        res.json({ message: 'Hostel deleted successfully' });
    } catch (error) {
        console.error('Error deleting hostel:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// --- Rooms ---

exports.getHostelRooms = async (req, res) => {
    const { hostelId } = req.params;
    try {
        // Query to get rooms along with current utilization
        const result = await pool.query(`
            SELECT r.*, 
                   COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'Active'), 0) as current_occupancy
            FROM hostel_rooms r
            LEFT JOIN hostel_allocations a ON r.id = a.room_id
            WHERE r.hostel_id = $1
            GROUP BY r.id
            ORDER BY r.room_number
        `, [hostelId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.addRoom = async (req, res) => {
    const { hostelId } = req.params;
    const { room_number, capacity, cost_per_term } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO hostel_rooms (hostel_id, room_number, capacity, cost_per_term) VALUES ($1, $2, $3, $4) RETURNING *',
            [hostelId, room_number, capacity, cost_per_term]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding room:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Room number already in use for this hostel' });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteRoom = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM hostel_rooms WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }
        res.json({ message: 'Room deleted successfully' });
    } catch (error) {
        console.error('Error deleting room:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// --- Allocations ---

exports.allocateRoom = async (req, res) => {
    const { roomId } = req.params;
    const { student_id } = req.body;
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check capacity
            const roomCheck = await client.query(`
                SELECT r.capacity, COUNT(a.id) as occupied
                FROM hostel_rooms r
                LEFT JOIN hostel_allocations a ON r.id = a.room_id AND a.status = 'Active'
                WHERE r.id = $1
                GROUP BY r.capacity
            `, [roomId]);

            if (roomCheck.rows.length === 0) {
                throw new Error('Room not found');
            }

            const { capacity, occupied } = roomCheck.rows[0];
            if (parseInt(occupied) >= capacity) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Room is fully occupied' });
            }

            // Check if student already allocated
            const studentCheck = await client.query(
                "SELECT * FROM hostel_allocations WHERE student_id = $1 AND status = 'Active'",
                [student_id]
            );
            if (studentCheck.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Student already has an active room allocation' });
            }

            const result = await client.query(
                "INSERT INTO hostel_allocations (room_id, student_id, allocation_date, status) VALUES ($1, $2, CURRENT_DATE, 'Active') RETURNING *",
                [roomId, student_id]
            );

            const { sendPushNotification } = require('../services/notificationService');

            // ... existing code ...

            await client.query('COMMIT');

            await sendPushNotification(student_id, 'Hostel Allocation', 'You have been allocated a room in the hostel.');
            res.status(201).json(result.rows[0]);

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error allocating room:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
};

exports.vacateRoom = async (req, res) => {
    const { id } = req.params; // allocation id
    try {
        const result = await pool.query(
            "UPDATE hostel_allocations SET status = 'Vacated', vacating_date = CURRENT_DATE WHERE id = $1 RETURNING *",
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Allocation not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error vacating room:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllocationsByHostel = async (req, res) => {
    const { hostelId } = req.params;
    try {
        const result = await pool.query(`
            SELECT a.*, s.name, r.room_number
            FROM hostel_allocations a
            JOIN hostel_rooms r ON a.room_id = r.id
            JOIN students s ON a.student_id = s.id AND (s.status IS NULL OR s.status != 'Deleted')
            WHERE r.hostel_id = $1 AND a.status = 'Active'
            ORDER BY r.room_number
        `, [hostelId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching allocations:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// --- Finance ---

exports.getStudentHostelDetails = async (req, res) => {
    const { admissionNo } = req.params;
    console.log(`Verifying student with Admission No: '${admissionNo}'`);
    try {
        const studentRes = await pool.query(`
            SELECT s.id, s.name, s.admission_no, 
                   s.parent_name, s.contact_number,
                   c.name as class_name, sec.name as section_name,
                   h.name as hostel_name, r.room_number, r.cost_per_term,
                   a.id as allocation_id
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN sections sec ON s.section_id = sec.id
            LEFT JOIN hostel_allocations a ON s.id = a.student_id AND a.status = 'Active'
            LEFT JOIN hostel_rooms r ON a.room_id = r.id
            LEFT JOIN hostels h ON r.hostel_id = h.id
            WHERE (s.admission_no ILIKE '%' || $1 || '%' OR CAST(s.id AS TEXT) = $1)
               AND s.school_id = $2
            LIMIT 1
        `, [admissionNo, req.user.schoolId]);

        if (studentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const studentData = studentRes.rows[0];

        if (!studentData.allocation_id) {
            return res.json({ ...studentData, is_allocated: false });
        }

        const paymentsRes = await pool.query(
            "SELECT * FROM hostel_payments WHERE student_id = $1 ORDER BY payment_date DESC",
            [studentData.id]
        );

        const billsRes = await pool.query(
            "SELECT * FROM hostel_mess_bills WHERE student_id = $1 ORDER BY year DESC, month DESC",
            [studentData.id]
        );

        res.json({
            ...studentData,
            is_allocated: true,
            payments: paymentsRes.rows,
            bills: billsRes.rows
        });
    } catch (error) {
        console.error('Error fetching student hostel details:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getMyHostelDetails = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { email, linkedId } = req.user;
        let student_admission_no = null;

        console.log(`[Hostel] Fetching details for ${email} (School: ${school_id}, LinkedID: ${linkedId})`);

        // Resolve Student
        if (linkedId) {
            const sRes = await pool.query('SELECT admission_no FROM students WHERE id = $1', [linkedId]);
            if (sRes.rows.length > 0) {
                student_admission_no = sRes.rows[0].admission_no;
            }
        }

        if (!student_admission_no) {
            let studentRes = await pool.query(
                'SELECT admission_no FROM students WHERE school_id = $1 AND LOWER(email) = LOWER($2)',
                [school_id, email]
            );
            if (studentRes.rows.length === 0) {
                const emailParts = email.split('@');
                if (emailParts.length === 2) {
                    studentRes = await pool.query(
                        'SELECT admission_no FROM students WHERE school_id = $1 AND LOWER(admission_no) = LOWER($2)',
                        [school_id, emailParts[0]]
                    );
                }
            }
            if (studentRes.rows.length > 0) {
                student_admission_no = studentRes.rows[0].admission_no;
            }
        }

        if (!student_admission_no) {
            console.log(`[Hostel] Student not found for email: ${email}`);
            return res.status(404).json({ error: 'Student profile not found' });
        }

        console.log(`[Hostel] Found Admission No: ${student_admission_no}`);

        // Fetch Details without strict school_id check in main query (relies on admission_no being correct from step 1)
        const result = await pool.query(`
            SELECT s.id, s.name, s.admission_no, 
                   s.parent_name, s.contact_number,
                   c.name as class_name, sec.name as section_name,
                   h.name as hostel_name, r.room_number, r.cost_per_term,
                   a.id as allocation_id, a.status as allocation_status
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN sections sec ON s.section_id = sec.id
            LEFT JOIN hostel_allocations a ON s.id = a.student_id AND a.status = 'Active'
            LEFT JOIN hostel_rooms r ON a.room_id = r.id
            LEFT JOIN hostels h ON r.hostel_id = h.id
            WHERE s.admission_no = $1
        `, [student_admission_no]);

        if (result.rows.length === 0) {
            console.log(`[Hostel] Main query returned no rows for ${student_admission_no}`);
            return res.status(404).json({ error: 'Student record not found' });
        }

        const studentData = result.rows[0];
        console.log(`[Hostel] Data:`, studentData);

        if (!studentData.allocation_id) {
            console.log(`[Hostel] No active allocation found.`);
            return res.json({ ...studentData, is_allocated: false });
        }

        // Fetch Financials
        const paymentsRes = await pool.query(
            "SELECT * FROM hostel_payments WHERE student_id = $1 ORDER BY payment_date DESC",
            [studentData.id]
        );

        const billsRes = await pool.query(
            "SELECT * FROM hostel_mess_bills WHERE student_id = $1 ORDER BY year DESC, month DESC",
            [studentData.id]
        );

        res.json({
            ...studentData,
            is_allocated: true,
            payments: paymentsRes.rows,
            bills: billsRes.rows
        });

    } catch (error) {
        console.error('Error fetching my hostel details:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.addMessBill = async (req, res) => {
    const { student_id, month, year, amount } = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO hostel_mess_bills (student_id, month, year, amount) VALUES ($1, $2, $3, $4) RETURNING *",
            [student_id, month, year, amount]
        );

        const { sendPushNotification } = require('../services/notificationService');
        await sendPushNotification(student_id, 'Hostel Bill', `New Mess Bill of ₹${amount} generated for ${month} ${year}.`);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding mess bill:', error);
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Bill already exists for this month' });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

exports.recordPayment = async (req, res) => {
    const { student_id, amount, payment_type, related_bill_id, remarks } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Record Payment
        const paymentRes = await client.query(
            "INSERT INTO hostel_payments (student_id, amount, payment_type, related_bill_id, remarks) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [student_id, amount, payment_type, related_bill_id, remarks]
        );

        // If it's a mess bill payment, update the bill status
        if (payment_type === 'Mess Bill' && related_bill_id) {
            // Check totals
            const billRes = await client.query("SELECT amount FROM hostel_mess_bills WHERE id = $1", [related_bill_id]);
            const totalBill = parseFloat(billRes.rows[0].amount);

            const paymentsRes = await client.query(
                "SELECT SUM(amount) as paid FROM hostel_payments WHERE related_bill_id = $1",
                [related_bill_id]
            );
            const totalPaid = parseFloat(paymentsRes.rows[0].paid || 0);

            let newStatus = 'Pending';
            if (totalPaid >= totalBill) newStatus = 'Paid';
            else if (totalPaid > 0) newStatus = 'Partial';

            await client.query("UPDATE hostel_mess_bills SET status = $1 WHERE id = $2", [newStatus, related_bill_id]);
        }

        await client.query('COMMIT');
        res.status(201).json(paymentRes.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error recording payment:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
};

// Get Hostel Statistics (Head Count, Finance)
exports.getHostelStats = async (req, res) => {
    try {
        const stats = {};

        // 1. Head Count (Active Allocations for this school)
        const headcountRes = await pool.query(`
            SELECT COUNT(a.id) as count 
            FROM hostel_allocations a
            JOIN students s ON a.student_id = s.id
            WHERE a.status = 'Active' AND s.school_id = $1
        `, [req.user.schoolId]);
        stats.headCount = parseInt(headcountRes.rows[0].count);

        // 2. Capacity
        const capacityRes = await pool.query("SELECT SUM(capacity) as total_capacity FROM hostel_rooms");
        stats.totalCapacity = parseInt(capacityRes.rows[0].total_capacity || 0);

        // 3. Mess Bills Overview
        const currentMonth = new Date().toLocaleString('default', { month: 'long' });
        const currentYear = new Date().getFullYear();

        // A. Current Month Stats (Revenue/Generation Focus)
        const currentMonthRes = await pool.query(`
            SELECT 
                COUNT(*) as total_bills,
                SUM(b.amount) as total_billed_amount,
                SUM(CASE WHEN b.status = 'Paid' THEN 1 ELSE 0 END) as paid_bills_count,
                SUM(CASE WHEN b.status = 'Paid' THEN b.amount ELSE 0 END) as paid_amount
            FROM hostel_mess_bills b
            JOIN students s ON b.student_id = s.id
            WHERE b.month = $1 AND b.year = $2 AND s.school_id = $3
        `, [currentMonth, currentYear, req.user.schoolId]);

        // B. Global Pending Stats (Liability Focus)
        const globalPendingRes = await pool.query(`
             SELECT 
                COUNT(*) as pending_bills_count,
                SUM(b.amount) as pending_amount
             FROM hostel_mess_bills b
             JOIN students s ON b.student_id = s.id
             WHERE b.status = 'Pending' AND s.school_id = $1
        `, [req.user.schoolId]);

        stats.mess = {
            // Current Month Specifics
            totalBills: parseInt(currentMonthRes.rows[0].total_bills || 0),
            totalBilledAmount: parseFloat(currentMonthRes.rows[0].total_billed_amount || 0),
            paidCount: parseInt(currentMonthRes.rows[0].paid_bills_count || 0),
            paidAmount: parseFloat(currentMonthRes.rows[0].paid_amount || 0),

            // Global Pending
            pendingCount: parseInt(globalPendingRes.rows[0].pending_bills_count || 0),
            pendingAmount: parseFloat(globalPendingRes.rows[0].pending_amount || 0)
        };

        // 4. Room Rent Collection (Overall)
        const activeAllocationsRes = await pool.query(`
             SELECT 
                SUM(r.cost_per_term) as total_expected_rent
             FROM hostel_allocations a
             JOIN hostel_rooms r ON a.room_id = r.id
             JOIN students s ON a.student_id = s.id
             WHERE a.status = 'Active' AND s.school_id = $1
        `, [req.user.schoolId]);
        stats.rent = {
            expectedTermRent: parseFloat(activeAllocationsRes.rows[0].total_expected_rent || 0)
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching hostel stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Generate Bulk Mess Bills
exports.generateBulkMessBills = async (req, res) => {
    const client = await pool.connect();
    try {
        const { month, year, amount } = req.body;

        if (!month || !year || !amount) {
            return res.status(400).json({ error: 'Month, Year and Amount are required' });
        }

        await client.query('BEGIN');

        // Get all active students for this school
        const studentsRes = await client.query(`
            SELECT a.student_id 
            FROM hostel_allocations a
            JOIN students s ON a.student_id = s.id
            WHERE a.status = 'Active' AND s.school_id = $1
        `, [req.user.schoolId]);
        const students = studentsRes.rows;

        let createdCount = 0;
        let skippedCount = 0;

        for (const s of students) {
            // Check if bill already exists
            const checkRes = await client.query(
                "SELECT id FROM hostel_mess_bills WHERE student_id = $1 AND month = $2 AND year = $3",
                [s.student_id, month, year]
            );

            if (checkRes.rows.length === 0) {
                await client.query(
                    "INSERT INTO hostel_mess_bills (student_id, month, year, amount, status) VALUES ($1, $2, $3, $4, 'Pending')",
                    [s.student_id, month, year, amount]
                );
                createdCount++;
            } else {
                skippedCount++;
            }
        }

        await client.query('COMMIT');
        res.json({ message: `Generated ${createdCount} new bills. (${skippedCount} already existed).` });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error generating bulk bills:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
};

// Get Pending Dues (Mess Bills + Room Rent)
exports.getPendingDues = async (req, res) => {
    try {
        const { filterMonth } = req.query;
        console.log('Fetching pending dues. Filter:', filterMonth);

        // 1. Pending Mess Bills
        let messQuery = `
            SELECT b.id, b.student_id, s.name, s.admission_no, b.amount, b.month, b.year 
            FROM hostel_mess_bills b 
            JOIN students s ON b.student_id = s.id 
            WHERE b.status = 'Pending' AND s.school_id = $1 AND (s.status IS NULL OR s.status != 'Deleted')
        `;
        const messParams = [req.user.schoolId];

        if (filterMonth === 'current') {
            const currentMonth = new Date().toLocaleString('default', { month: 'long' });
            const currentYear = new Date().getFullYear();
            messQuery += ` AND b.month = $2 AND b.year = $3`;
            messParams.push(currentMonth, currentYear);
        }
        messQuery += ` ORDER BY b.year DESC, b.month DESC`;
        const messRes = await pool.query(messQuery, messParams);

        const messDues = messRes.rows.map(row => ({
            id: `mess_${row.id}`,
            student_id: row.student_id, // Fixed: Use actual student ID
            name: row.name || 'Unknown',
            admission_no: row.admission_no || '-',
            amount: parseFloat(row.amount || 0).toFixed(2),
            type: 'Mess Bill',
            period: `${row.month} ${row.year}`
        }));

        // 2. Pending Room Rent
        // Logic: Cost Per Term - Total Paid Rent > 0
        // Added CAST to numeric for safety
        const rentQuery = `
            SELECT s.id, s.name, s.admission_no, r.cost_per_term,
                   COALESCE(SUM(p.amount), 0) as paid_amount
            FROM students s
            JOIN hostel_allocations a ON s.id = a.student_id
            JOIN hostel_rooms r ON a.room_id = r.id
            LEFT JOIN hostel_payments p ON s.id = p.student_id AND p.payment_type = 'Room Rent'
            WHERE a.status = 'Active' AND s.school_id = $1 AND (s.status IS NULL OR s.status != 'Deleted')
            GROUP BY s.id, r.id, r.cost_per_term
            HAVING COALESCE(SUM(p.amount), 0) < CAST(r.cost_per_term AS NUMERIC)
        `;
        const rentRes = await pool.query(rentQuery, [req.user.schoolId]);

        const rentDues = rentRes.rows.map(row => ({
            id: `rent_${row.id}`,
            student_id: row.id,
            name: row.name || 'Unknown',
            admission_no: row.admission_no || '-',
            amount: (parseFloat(row.cost_per_term || 0) - parseFloat(row.paid_amount || 0)).toFixed(2),
            type: 'Room Rent',
            period: 'Current Term'
        }));

        // Combine and Sort
        const allDues = [...messDues, ...rentDues].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        res.json(allDues);
    } catch (error) {
        console.error('Error fetching pending dues:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


