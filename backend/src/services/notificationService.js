const { pool } = require('../config/db');
const { sendPushNotification: sendRealPush } = require('./firebaseService');
const { sendAttendanceWhatsApp } = require('./whatsappService');
const { sendAttendanceSMS } = require('./smsService');

// Mock SMS Service for now
// In production, integrate with Twilio, MSG91, TextLocal, etc.
const sendSMS = async (phoneNumber, message) => {
    try {
        if (!phoneNumber) return;
        console.log(`[SMS GATEWAY] To: ${phoneNumber} | Message: ${message}`);
        return true;
    } catch (error) {
        console.error('Failed to send SMS:', error);
        return false;
    }
};

// Real Push Notification Service (Firebase/FCM)
// AND Save to DB for In-App Notification Center
const sendPushNotification = async (recipientId, title, body, roleHint = null) => {
    const client = await pool.connect();
    try {
        console.log(`[PUSH REQUEST] Recipient: ${recipientId} | Title: ${title}`);

        // 1. Resolve 'users' table ID for DB persistence
        let dbUserId = null;
        let finalRole = roleHint;

        // Handle composite IDs from SalaryController (e.g. "Teacher_5")
        if (!finalRole && typeof recipientId === 'string' && recipientId.includes('_')) {
            const parts = recipientId.split('_');
            if (['Teacher', 'Staff', 'Student'].includes(parts[0])) {
                finalRole = parts[0];
                recipientId = parts[1]; // Extract the numeric ID
            }
        }

        // Default to Student if we assume numeric ID is a student (common case in this system)
        if (!finalRole) finalRole = 'Student';

        // 0. Try direct User ID lookup first (Highest Priority)
        // If recipientId is already a number, it might be a users.id
        if (recipientId && !isNaN(recipientId)) {
            const directRes = await client.query('SELECT id, role FROM users WHERE id = $1', [recipientId]);
            if (directRes.rows.length > 0) {
                const u = directRes.rows[0];
                // Use it if role matches, or if we are in a broad targeting mode
                if (!finalRole ||
                    finalRole === 'DIRECT' ||
                    finalRole === 'All' ||
                    finalRole === 'Class' ||
                    u.role.toUpperCase() === finalRole.toUpperCase() ||
                    (finalRole === 'Staff' && ['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER'].includes(u.role.toUpperCase()))
                ) {
                    dbUserId = u.id;
                    console.log(`[PUSH RESOLVE] Direct User ID match found: ${dbUserId}`);
                }
            }
        }

        // 1. Resolve via Role Tables if not already resolved
        if (!dbUserId && finalRole === 'Student') {
            // Check both standard student ID (numeric) and Admission Number
            const res = await client.query(`
                SELECT u.id 
                FROM users u 
                JOIN students s ON (LOWER(u.email) = LOWER(s.email) OR u.email = LOWER(s.admission_no) || '@student.school.com')
                WHERE (s.id::text = $1 OR s.admission_no ILIKE $1)
                AND u.role = 'STUDENT'
             `, [recipientId.toString()]);
            if (res.rows.length > 0) dbUserId = res.rows[0].id;

        } else if (!dbUserId && finalRole === 'Teacher') {
            const res = await client.query(`
                SELECT u.id 
                FROM users u 
                JOIN teachers t ON (LOWER(u.email) = LOWER(t.email) OR u.email = t.employee_id || '@teacher.school.com')
                WHERE (t.id::text = $1 OR t.employee_id = $1)
                AND u.role = 'TEACHER'
             `, [recipientId.toString()]);
            if (res.rows.length > 0) dbUserId = res.rows[0].id;

        } else if (!dbUserId && finalRole === 'Staff') {
            const res = await client.query(`
                SELECT u.id 
                FROM users u 
                JOIN staff s ON (LOWER(u.email) = LOWER(s.email) OR u.email = s.employee_id || '@staff.school.com')
                WHERE (s.id::text = $1 OR s.employee_id = $1)
                AND u.role IN ('STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER')
             `, [recipientId.toString()]);
            if (res.rows.length > 0) dbUserId = res.rows[0].id;
        }

        // 2. Insert into Notifications Table
        if (dbUserId) {
            await client.query(
                'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
                [dbUserId, title, body, 'ALERT']
            );

            // 3. Send via Firebase
            const userTokenRes = await client.query('SELECT fcm_token FROM users WHERE id = $1', [dbUserId]);
            const token = userTokenRes.rows[0]?.fcm_token;
            if (token) {
                await sendRealPush(token, title, body, { role: finalRole });
            }

            console.log(`[REAL PUSH] Processed for User ID: ${dbUserId}`);
        } else {
            console.warn(`[PUSH WARNING] Could not resolve User Table ID for recipient: ${recipientId} (${finalRole})`);
        }

        return true;
    } catch (error) {
        console.error('Failed to send Push Notification:', error);
        return false;
    } finally {
        client.release();
    }
};

const sendAttendanceNotification = async (user, status) => {
    try {
        // Force IST (Asia/Kolkata) regardless of server timezone
        const now = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        }).format(new Date());

        let message = '';
        let title = 'Attendance Update';

        // Customized messages based on role (implicitly handled by user object structure or could be explicit)
        // Here we assume student/parent usage primarily.

        if (status === 'Present') {
            message = `Reached school at ${now}`;
        } else if (status === 'Absent') {
            message = `Marked ABSENT today (${new Date().toLocaleDateString()})`;
        } else if (status === 'Late') {
            message = `Arrived late at ${now}`;
        }

        if (!message) return;

        // Configuration: Choose your messaging channel
        const USE_SMS = process.env.ENABLE_SMS !== 'false'; // Default: enabled (cheap ₹0.10/msg)
        const USE_WHATSAPP = process.env.ENABLE_WHATSAPP === 'true'; // Default: disabled (expensive ₹0.50-1.50/msg)

        if (user.contact_number) {
            // Option 1: SMS (Recommended - Cheap & Reliable)
            if (USE_SMS) {
                await sendAttendanceSMS(user, status);
            }

            // Option 2: WhatsApp (Optional - Expensive but Rich)
            if (USE_WHATSAPP) {
                await sendAttendanceWhatsApp(user, status);
            }

            // Fallback: Old SMS function (if new services not configured)
            if (!USE_SMS && !USE_WHATSAPP) {
                await sendSMS(user.contact_number, `Dear Parent, your ward ${user.name} has ${message.toLowerCase()}. - School Admin`);
            }
        }

        // Always send Mobile App Push Notification (FREE & Real-time)
        await sendPushNotification(user.id, title, `${user.name} has ${message.toLowerCase()}.`);

    } catch (error) {
        console.error('Error sending attendance notification:', error);
    }
};

// Scheduler for 10 AM Absenteeism
const checkAndSendAbsentNotifications = async () => {
    console.log('[CRON] Running 10 AM Absentee Check...');
    const client = await pool.connect();
    try {
        const today = new Date().toISOString().split('T')[0];

        // 1. Get all students who do NOT have an attendance record for today
        // (Assuming "no record" = "absent" by 10 AM)
        const absentStudents = await client.query(`
            SELECT s.id, s.name, s.contact_number, s.school_id 
            FROM students s
            WHERE s.id NOT IN (
                SELECT student_id FROM attendance WHERE date = $1
            )
        `, [today]);

        console.log(`[CRON] Found ${absentStudents.rows.length} students currently absent.`);

        // 2. Mark them as 'Absent' in DB and Send SMS
        for (const student of absentStudents.rows) {
            // A. Insert 'Absent' record to avoid sending SMS twice if script re-runs
            await client.query(`
                INSERT INTO attendance (student_id, date, status, school_id) 
                VALUES ($1, $2, 'Absent', $3)
            `, [student.id, today, student.school_id]);

            // B. Send Notification
            await sendAttendanceNotification(student, 'Absent');
        }

    } catch (error) {
        console.error('[CRON] Error during absentee check:', error);
    } finally {
        client.release();
    }
};

module.exports = { sendSMS, sendAttendanceNotification, checkAndSendAbsentNotifications, sendPushNotification };
