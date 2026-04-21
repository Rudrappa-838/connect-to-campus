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
const sendPushNotification = async (recipientId, title, body, roleHint = null, attachment_url = null, attachment_type = null) => {
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

        // 1. RESOLVE USER ID (for DB persistence and FCM Token lookup)
        // This must be robust to handle Numeric IDs, Email logins, and Employee/Admission IDs
        if (recipientId) {
            const STAFF_ROLES = ['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'WARDEN'];
            const searchVal = recipientId.toString().trim();
            const isNumeric = !isNaN(searchVal);

            let res;
            if (finalRole === 'Student') {
                res = await client.query(`
                    SELECT u.id FROM users u 
                    LEFT JOIN students s ON (s.id = u.linked_id OR LOWER(s.email) = LOWER(u.email))
                    WHERE u.role = 'STUDENT' 
                    AND (
                        (u.linked_id::text = $1) OR 
                        (s.id::text = $1) OR
                        (s.admission_no ILIKE $1) OR 
                        (u.email ILIKE $1 || '@student.school.com') OR
                        (LOWER(u.email) = LOWER($1))
                    )
                    LIMIT 1
                `, [searchVal]);
            } else if (finalRole === 'Teacher') {
                res = await client.query(`
                    SELECT u.id FROM users u 
                    LEFT JOIN teachers t ON (t.id = u.linked_id OR LOWER(t.email) = LOWER(u.email))
                    WHERE u.role = 'TEACHER' 
                    AND (
                        (u.linked_id::text = $1) OR 
                        (t.id::text = $1) OR
                        (t.employee_id ILIKE $1) OR 
                        (u.email ILIKE $1 || '@teacher.school.com') OR
                        (LOWER(u.email) = LOWER($1))
                    )
                    LIMIT 1
                `, [searchVal]);
            } else if (finalRole === 'Staff') {
                res = await client.query(`
                    SELECT u.id FROM users u 
                    LEFT JOIN staff st ON (st.id = u.linked_id OR LOWER(st.email) = LOWER(u.email))
                    WHERE u.role IN ('STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'WARDEN') 
                    AND (
                        (u.linked_id::text = $1) OR 
                        (st.id::text = $1) OR
                        (st.employee_id ILIKE $1) OR 
                        (u.email ILIKE $1 || '@staff.school.com') OR
                        (LOWER(u.email) = LOWER($1))
                    )
                    LIMIT 1
                `, [searchVal]);
            } else {
                // Fallback for direct User ID or generic Email
                res = await client.query(`
                    SELECT id FROM users 
                    WHERE (id::text = $1) OR (LOWER(email) = LOWER($1))
                    LIMIT 1
                `, [searchVal]);
            }

            if (res && res.rows.length > 0) {
                dbUserId = res.rows[0].id;
                console.log(`[PUSH RESOLVED] Found User ID: ${dbUserId} for ${finalRole} ${searchVal}`);
            }
        }

        // 2. Insert into Notifications Table
        if (dbUserId) {
            await client.query(
                'INSERT INTO notifications (user_id, title, message, type, attachment_url, attachment_type) VALUES ($1, $2, $3, $4, $5, $6)',
                [dbUserId, title, body, 'ALERT', attachment_url, attachment_type]
            );

            // 3. Send via Firebase
            const userTokenRes = await client.query('SELECT fcm_token FROM users WHERE id = $1', [dbUserId]);
            const token = userTokenRes.rows[0]?.fcm_token;
            if (token) {
                // Calculate Unread Count for badge (Include the current new one)
                const unreadRes = await client.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false', [dbUserId]);
                const badgeCount = parseInt(unreadRes.rows[0].count);

                await sendRealPush(token, title, body, { role: finalRole }, badgeCount);
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

        // Detect Role for Push Logic
        let roleHint = 'Student';
        if (user.employee_id) {
            // Check if user is a teacher or staff (role check or department)
            if (user.role && user.role.toLowerCase().includes('teacher')) roleHint = 'Teacher';
            else roleHint = 'Staff';
        }

        // Always send Mobile App Push Notification (FREE & Real-time)
        await sendPushNotification(user.id, title, `${user.name} has ${message.toLowerCase()}.`, roleHint);

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
