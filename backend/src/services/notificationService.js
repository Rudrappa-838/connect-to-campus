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

// Memory-based cooldown to prevent rapid-fire notifications to the same user (60 seconds)
const notificationCooldowns = new Map();

// Real Push Notification Service (Firebase/FCM)
// AND Save to DB for In-App Notification Center
const sendPushNotification = async (recipientId, title, body, roleHint = null, attachment_url = null, attachment_type = null) => {
    // 0. Check Cooldown (Optional: disable for critical alerts)
    const cooldownKey = `${recipientId}_${title}`;
    const lastSent = notificationCooldowns.get(cooldownKey);
    const now = Date.now();
    if (lastSent && (now - lastSent) < 60000) { // 1 minute cooldown
        console.log(`[PUSH SKIP] Throttling rapid notification for ${recipientId}: ${title}`);
        return true; 
    }
    notificationCooldowns.set(cooldownKey, now);

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

        const todayDate = new Intl.DateTimeFormat('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
        }).format(new Date());

        let title = '';
        let body = '';

        if (status === 'Present') {
            title = `✅ ${user.name} is Present`;
            body = `Attendance marked at ${now} on ${todayDate}`;
        } else if (status === 'Absent') {
            title = `⚠️ ${user.name} is Absent`;
            body = `No attendance recorded for ${todayDate}`;
        } else if (status === 'Late') {
            title = `🕐 ${user.name} arrived Late`;
            body = `Late arrival marked at ${now} on ${todayDate}`;
        }

        if (!title) return;

        // Detect role for push routing
        let roleHint = 'Student';
        if (user.type === 'teacher' || (user.role && user.role.toLowerCase().includes('teacher'))) {
            roleHint = 'Teacher';
        } else if (user.type === 'staff' || user.employee_id) {
            roleHint = 'Staff';
        }

        // Push-only: send FCM push notification directly to the student/teacher/staff app account
        // This shows in the Android/iOS notification bar immediately (outside app)
        await sendPushNotification(user.id, title, body, roleHint);

        console.log(`[ATTENDANCE PUSH] Sent to ${roleHint} ID:${user.id} — "${title}"`);

    } catch (error) {
        console.error('Error sending attendance notification:', error);
    }
};

// Scheduler for 1:00 AM Absenteeism (Checks Yesterday's Attendance)
const checkAndSendAbsentNotifications = async () => {
    console.log('[CRON] Running Next-Day Absentee Check...');
    const client = await pool.connect();
    try {
        // Calculate YESTERDAY's date correctly in IST
        const now = new Date();
        now.setDate(now.getDate() - 1); // Subtract 1 day
        const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now); // YYYY-MM-DD in IST

        console.log(`[CRON] Checking absenteeism for date: ${yesterday}`);

        // 1. Get all students who do NOT have an attendance record for yesterday
        const absentStudents = await client.query(`
            SELECT s.id, s.name, s.contact_number, s.school_id 
            FROM students s
            WHERE s.id NOT IN (
                SELECT student_id FROM attendance WHERE date = $1
            )
        `, [yesterday]);

        console.log(`[CRON] Found ${absentStudents.rows.length} students absent yesterday.`);

        // 2. Mark them as 'Absent' in DB and Send SMS
        for (const student of absentStudents.rows) {
            // A. Insert 'Absent' record to avoid sending SMS twice if script re-runs
            await client.query(`
                INSERT INTO attendance (student_id, date, status, school_id) 
                VALUES ($1, $2, 'Absent', $3)
            `, [student.id, yesterday, student.school_id]);

            // B. Send Notification
            await sendAttendanceNotification(student, 'Absent');
        }

    } catch (error) {
        console.error('[CRON] Error during absentee check:', error);
    } finally {
        client.release();
    }
};

const broadcastNotification = async (title, body, data = {}) => {
    const client = await pool.connect();
    try {
        console.log(`[BROADCAST] Sending to all: ${title}`);
        
        // Get all users with FCM tokens
        const result = await client.query('SELECT id, fcm_token FROM users WHERE fcm_token IS NOT NULL');
        const users = result.rows;
        
        console.log(`[BROADCAST] Found ${users.length} devices to notify`);
        
        let successCount = 0;
        
        // SPEED UP: Process in batches of 50 concurrently
        const BATCH_SIZE = 50;
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = users.slice(i, i + BATCH_SIZE);
            
            // Execute batch concurrently
            const results = await Promise.all(
                batch.map(async (user) => {
                    try {
                        // Save to DB
                        await client.query(
                            'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
                            [user.id, title, body, 'BROADCAST']
                        );
                        // Send Push
                        const success = await sendRealPush(user.fcm_token, title, body, data);
                        return success ? 1 : 0;
                    } catch (e) {
                        return 0;
                    }
                })
            );
            
            // Tally successes
            successCount += results.reduce((a, b) => a + b, 0);
        }
        
        return { total: users.length, success: successCount };
    } catch (error) {
        console.error('Broadcast failed:', error);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { 
    sendSMS, 
    sendAttendanceNotification, 
    checkAndSendAbsentNotifications, 
    sendPushNotification,
    broadcastNotification 
};
