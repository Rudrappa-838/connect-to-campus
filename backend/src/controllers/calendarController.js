const { pool } = require('../config/db');
const fs = require('fs');
const path = require('path');

// Events
exports.getEvents = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const role = req.user.role;

        let query = `SELECT * FROM events WHERE school_id = $1`;
        const params = [school_id];

        if (role !== 'SCHOOL_ADMIN' && role !== 'SUPER_ADMIN') {
            let audienceRole = '';
            if (role === 'STUDENT') audienceRole = 'Students';
            else if (role === 'TEACHER') audienceRole = 'Teachers';
            else if (['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'WARDEN'].includes(role)) audienceRole = 'Staff';

            query += ` AND (audience = 'All' OR audience = $2)`;
            params.push(audienceRole);
        }

        query += ` ORDER BY start_date ASC`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.addEvent = async (req, res) => {
    try {
        const school_id = req.user.schoolId;
        const { title, event_type, start_date, end_date, description, audience } = req.body;

        if (!title || !start_date || !end_date) {
            return res.status(400).json({ message: 'Title, start date, and end date are required' });
        }

        if (new Date(end_date) < new Date(start_date)) {
            return res.status(400).json({ message: 'End date cannot be before start date' });
        }

        const result = await pool.query(
            `INSERT INTO events (school_id, title, event_type, start_date, end_date, description, audience)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [school_id, title, event_type, start_date, end_date, description, audience]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        await pool.query('DELETE FROM events WHERE id = $1 AND school_id = $2', [req.params.id, req.user.schoolId]);
        res.json({ message: 'Event deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Announcements
exports.getAnnouncements = async (req, res) => {
    try {
        let school_id = req.user.schoolId;
        // Normalize role to Uppercase to match check logic, but keep original if needed? 
        // No, safe to use Uppercase for logic checks.
        const role = req.user.role ? req.user.role.toUpperCase().trim() : '';
        const user_id = req.user.id;

        console.log(`[getAnnouncements DEBUG] User: ${user_id} | Role: "${role}" | School: ${school_id}`);

        if (role === 'SUPER_ADMIN' && req.query.schoolId) {
            school_id = req.query.schoolId;
        }

        // Auto-delete expired
        if (school_id) {
            await pool.query(`
                DELETE FROM announcements 
                WHERE school_id = $1 
                AND (
                    (valid_until IS NOT NULL AND valid_until < CURRENT_DATE) 
                    OR 
                    (valid_until IS NULL AND created_at < NOW() - INTERVAL '30 days')
                )
            `, [school_id]);
        }

        // Base Query
        let query = `
            SELECT a.*, c.name as class_name, s.name as section_name, a.attachment_url, a.attachment_type
            FROM announcements a
            LEFT JOIN classes c ON a.class_id = c.id
            LEFT JOIN sections s ON a.section_id = s.id
            LEFT JOIN users u ON a.created_by = u.id
            WHERE 1=1
        `;

        const params = [];

        // School Filter
        if (school_id) {
            params.push(school_id);
            query += ` AND (a.school_id = $${params.length} OR a.school_id IS NULL)`;
        } else if (role !== 'SUPER_ADMIN') {
            return res.status(403).json({ message: 'School ID missing' });
        }

        if (role !== 'SCHOOL_ADMIN' && role !== 'SUPER_ADMIN') {
            const roleConditions = ["LOWER(a.target_role) = 'all'"];

            if (role === 'STUDENT') {
                roleConditions.push("LOWER(a.target_role) = 'student'");
                const studentRes = await pool.query(
                    'SELECT class_id, section_id FROM students s JOIN users u ON LOWER(s.email) = LOWER(u.email) WHERE u.id = $1 AND s.school_id = $2',
                    [user_id, school_id]
                );
                if (studentRes.rows.length > 0) {
                    const { class_id, section_id } = studentRes.rows[0];
                    if (class_id) {
                        params.push(class_id);
                        if (section_id) {
                            params.push(section_id);
                            // Student HAS a section: Show "Whole Class" OR "My Section" notices
                            roleConditions.push(`(LOWER(a.target_role) = 'class' AND a.class_id = $${params.length - 1} AND (a.section_id IS NULL OR a.section_id = $${params.length}))`);
                        } else {
                            // Student has NO section: ONLY show "Whole Class" notices
                            roleConditions.push(`(LOWER(a.target_role) = 'class' AND a.class_id = $${params.length} AND a.section_id IS NULL)`);
                        }
                    }
                }
            } else if (role === 'TEACHER') {
                roleConditions.push("LOWER(a.target_role) = 'teacher'");
                // Explicitly check for Teacher-targeted only
            } else if (['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'WARDEN'].includes(role)) {
                roleConditions.push("LOWER(a.target_role) = 'staff'");
            }

            // JOIN POSITIVE CONDITIONS
            query += ` AND (${roleConditions.join(' OR ')})`;

            // HARD BLOCK NEGATIVE CONDITIONS (THE HAMMER V4)
            if (role === 'STUDENT') {
                query += ` AND LOWER(a.target_role) NOT IN ('teacher', 'staff', 'role', 'subject')`;
            } else if (role === 'TEACHER') {
                query += ` AND LOWER(a.target_role) NOT IN ('student', 'staff', 'class', 'role')`;
            } else {
                // Staff/Driver etc.
                query += ` AND LOWER(a.target_role) NOT IN ('student', 'teacher', 'class', 'subject')`;
            }
        }

        query += ` ORDER BY a.created_at DESC`;

        // Final sanity check log (can be seen in terminal if visible)
        console.log(`[getAnnouncements NUCLEAR] User: ${user_id} | Detected Role: "${role}"`);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error("Announcement Fetch Error:", error);

        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

exports.addAnnouncement = async (req, res) => {
    try {
        let school_id = req.user.schoolId;
        if (req.user.role === 'SUPER_ADMIN') {
            school_id = req.body.schoolId || null;
        }

        const { title, message, target_role, priority, valid_until, class_id, section_id, attachment_data, attachment_type } = req.body;

        // Enforce Valid Until Date
        if (!valid_until || valid_until === '') {
            return res.status(400).json({ message: 'Valid Until date is required for auto-deletion.' });
        }

        const effectiveValidUntil = valid_until;
        
        let attachment_url = null;
        let attachment_storage_type = null;

        if (attachment_data) {
            try {
                // If it's a base64 string, save it
                const matches = attachment_data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    attachment_storage_type = matches[1];
                    const buffer = Buffer.from(matches[2], 'base64');
                    
                    const uploadsDir = path.join(__dirname, '../../public/uploads/announcements');
                    if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    
                    const ext = attachment_storage_type.split('/')[1] || 'bin';
                    const filename = `ann_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                    const filepath = path.join(uploadsDir, filename);
                    
                    fs.writeFileSync(filepath, buffer);
                    attachment_url = `/uploads/announcements/${filename}`;
                }
            } catch (err) {
                console.error("Failed to parse and save attachment:", err);
            }
        }

        // 1. Insert Announcement
        const result = await pool.query(
            `INSERT INTO announcements (school_id, title, message, target_role, priority, valid_until, created_by, class_id, section_id, attachment_url, attachment_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [school_id, title, message, target_role, priority, effectiveValidUntil, req.user.id,
                target_role === 'Class' ? class_id : null,
                target_role === 'Class' ? section_id : null,
                attachment_url,
                attachment_storage_type || attachment_type || null]
        );

        const announcement = result.rows[0];

        // 2. BROADCAST: Send Notifications ONLY to targeted users
        // This runs in background to avoid slowing down response
        broadcastAnnouncement(announcement, school_id).catch(e => console.error('Broadcast Error:', e));

        res.status(201).json(announcement);
    } catch (error) {
        console.error("Error adding announcement:", error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
};

async function broadcastAnnouncement(item, school_id) {
    const { sendPushNotification } = require('../services/notificationService');
    let targetUsers = [];

    try {
        if (item.target_role === 'All' || item.target_role === 'all') {
            const res = await pool.query('SELECT id FROM users WHERE school_id = $1', [school_id]);
            targetUsers = res.rows;
        } else if (item.target_role === 'Student' || item.target_role === 'student') {
            const res = await pool.query(`
                SELECT id FROM users 
                WHERE school_id = $1 AND role = 'STUDENT'
            `, [school_id]);
            targetUsers = res.rows;
        } else if (item.target_role === 'Teacher' || item.target_role === 'teacher') {
            const res = await pool.query(`
                SELECT id FROM users 
                WHERE school_id = $1 AND role = 'TEACHER'
            `, [school_id]);
            targetUsers = res.rows;
        } else if (item.target_role === 'Staff' || item.target_role === 'staff') {
            const res = await pool.query(`
                SELECT id FROM users 
                WHERE school_id = $1 AND role IN ('STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'WARDEN')
            `, [school_id]);
            targetUsers = res.rows;
        } else if (item.target_role === 'Class' || item.target_role === 'class') {
            // Students in a class still need the join because class_id is in the students table
            let q = `
                SELECT u.id 
                FROM students s 
                JOIN users u ON (LOWER(s.email) = LOWER(u.email) OR u.email = LOWER(s.admission_no) || '@student.school.com') 
                WHERE s.school_id = $1 AND s.class_id = $2 AND u.role = 'STUDENT'
            `;
            const params = [school_id, item.class_id];
            if (item.section_id) {
                q += ' AND s.section_id = $3';
                params.push(item.section_id);
            }
            const res = await pool.query(q, params);
            targetUsers = res.rows;
        }

        console.log(`[BROADCAST] Sending ${item.title} to ${targetUsers.length} users.`);

        // Parallel sending with limit to avoid overloading connections
        const batchSize = 20;
        for (let i = 0; i < targetUsers.length; i += batchSize) {
            const batch = targetUsers.slice(i, i + batchSize);
            await Promise.all(batch.map(user =>
                sendPushNotification(user.id, item.title, item.message, item.target_role, item.attachment_url, item.attachment_type)
            ));
        }
    } catch (err) {
        console.error('Failed to broadcast announcement:', err);
    }
}

exports.getAudienceCount = async (req, res) => {
    try {
        let school_id = req.user.schoolId;
        if (req.user.role === 'SUPER_ADMIN' && req.query.schoolId) {
            school_id = req.query.schoolId;
        }

        const { target_role, class_id, section_id, subject_name, staff_role } = req.query;
        let count = 0;

        console.log(`[getAudienceCount DEBUG] Target: ${target_role} | Class: ${class_id} | Section: ${section_id}`);

        if (target_role === 'All') {
            const [s, t, st] = await Promise.all([
                pool.query('SELECT COUNT(*) FROM students WHERE school_id = $1', [school_id]),
                pool.query('SELECT COUNT(*) FROM teachers WHERE school_id = $1', [school_id]),
                pool.query('SELECT COUNT(*) FROM staff WHERE school_id = $1', [school_id])
            ]);
            count = parseInt(s.rows[0].count) + parseInt(t.rows[0].count) + parseInt(st.rows[0].count);
        } else if (target_role === 'Student') {
            const res = await pool.query('SELECT COUNT(*) FROM students WHERE school_id = $1', [school_id]);
            count = parseInt(res.rows[0].count);
        } else if (target_role === 'Teacher') {
            const res = await pool.query('SELECT COUNT(*) FROM teachers WHERE school_id = $1', [school_id]);
            count = parseInt(res.rows[0].count);
        } else if (target_role === 'Staff') {
            const res = await pool.query('SELECT COUNT(*) FROM staff WHERE school_id = $1', [school_id]);
            count = parseInt(res.rows[0].count);
        } else if (target_role === 'Class' && class_id && class_id !== '') {
            let query = 'SELECT COUNT(*) FROM students WHERE school_id = $1 AND class_id = $2';
            const params = [school_id, class_id];

            // Explicitly only add section filter if a specific section is chosen
            if (section_id && section_id !== '' && section_id !== 'undefined' && section_id !== 'null') {
                query += ' AND section_id = $3';
                params.push(section_id);
            }

            const res = await pool.query(query, params);
            count = parseInt(res.rows[0].count);
        }

        res.json({ count });
    } catch (error) {
        console.error("Audience Count Error:", error);
        res.status(500).json({ count: 0 }); // Fail gracefully
    }
};

exports.getAnnouncementOptions = async (req, res) => {
    try {
        let school_id = req.user.schoolId;

        // Allow Super Admin to fetch options for a specific school
        if (req.user.role === 'SUPER_ADMIN' && req.query.schoolId) {
            school_id = req.query.schoolId;
        }

        // Fetch all distinct options in parallel for speed
        const [subjectsRes, rolesRes] = await Promise.all([
            pool.query('SELECT DISTINCT subject_specialization FROM teachers WHERE school_id = $1 AND subject_specialization IS NOT NULL', [school_id]),
            pool.query('SELECT DISTINCT role FROM staff WHERE school_id = $1 AND role IS NOT NULL', [school_id])
        ]);

        res.json({
            subjects: subjectsRes.rows.map(r => r.subject_specialization),
            roles: rolesRes.rows.map(r => r.role)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching options' });
    }
};

exports.deleteAnnouncement = async (req, res) => {
    try {
        let school_id = req.user.schoolId;
        const role = req.user.role;

        if (role === 'SUPER_ADMIN') {
            // Super Admin can delete ANY announcement regardless of school_id
            await pool.query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
        } else {
            // Standard users can only delete their school's announcements
            await pool.query('DELETE FROM announcements WHERE id = $1 AND school_id = $2', [req.params.id, school_id]);
        }
        res.json({ message: 'Announcement deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
