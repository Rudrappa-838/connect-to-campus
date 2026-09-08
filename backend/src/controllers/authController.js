const { pool } = require('../config/db');
const { ensureHolidaysForSchool } = require('./holidayController');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');


const STAFF_SUB_ROLES = ['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'];

/**
 * Unified email & ID resolver for authentication flows (Login, Forgot Password, Reset Password, Verify OTP, Get User Details)
 */
const resolveAuthCheckEmails = async (email, role) => {
    let checkEmails = [email];
    if (email) checkEmails.push(email.toLowerCase());

    const isEmail = email && email.includes('@');
    let userDetails = { id: email, role: role, schoolName: '', email: null, name: '' };

    if (!isEmail && role) {
        const normRole = role.toUpperCase();
        if (normRole === 'STUDENT') {
            checkEmails.push(`${email.toLowerCase()}@student.school.com`);
            const sRes = await pool.query('SELECT email, admission_no, first_name, last_name, name FROM students WHERE admission_no ILIKE $1', [email]);
            if (sRes.rows.length > 0) {
                checkEmails.push(sRes.rows[0].email);
                userDetails.id = sRes.rows[0].admission_no;
                userDetails.name = `${sRes.rows[0].first_name || ''} ${sRes.rows[0].last_name || ''}`.trim() || sRes.rows[0].name;
                userDetails.email = sRes.rows[0].email;
            }
        } else if (normRole === 'TEACHER') {
            checkEmails.push(`${email}@teacher.school.com`);
            checkEmails.push(`${email.toLowerCase()}@teacher.school.com`);
            const tRes = await pool.query('SELECT email, employee_id, first_name, last_name, name FROM teachers WHERE employee_id ILIKE $1', [email]);
            if (tRes.rows.length > 0) {
                checkEmails.push(tRes.rows[0].email);
                userDetails.id = tRes.rows[0].employee_id;
                userDetails.name = `${tRes.rows[0].first_name || ''} ${tRes.rows[0].last_name || ''}`.trim() || tRes.rows[0].name;
                userDetails.email = tRes.rows[0].email;
            }
        } else if (STAFF_SUB_ROLES.includes(normRole)) {
            checkEmails.push(`${email}@staff.school.com`);
            checkEmails.push(`${email.toLowerCase()}@staff.school.com`);
            const stRes = await pool.query('SELECT email, employee_id, first_name, last_name, name FROM staff WHERE employee_id ILIKE $1', [email]);
            if (stRes.rows.length > 0) {
                checkEmails.push(stRes.rows[0].email);
                userDetails.id = stRes.rows[0].employee_id;
                userDetails.name = `${stRes.rows[0].first_name || ''} ${stRes.rows[0].last_name || ''}`.trim() || stRes.rows[0].name;
                userDetails.email = stRes.rows[0].email;
            }
        } else if (normRole === 'SCHOOL_ADMIN') {
            const schoolRes = await pool.query('SELECT id, name, contact_email, school_code FROM schools WHERE school_code ILIKE $1', [email]);
            if (schoolRes.rows.length > 0) {
                userDetails.schoolName = schoolRes.rows[0].name;
                userDetails.id = schoolRes.rows[0].school_code;
                userDetails.name = "School Administrator";
                const adminRes = await pool.query('SELECT email FROM users WHERE school_id = $1 AND role = $2', [schoolRes.rows[0].id, 'SCHOOL_ADMIN']);
                if (adminRes.rows.length > 0) {
                    checkEmails.push(adminRes.rows[0].email);
                    userDetails.email = adminRes.rows[0].email;
                }
            }
        }
    } else if (isEmail && role) {
        const normRole = role.toUpperCase();
        if (normRole === 'STUDENT') {
            const sRes = await pool.query('SELECT email, admission_no, first_name, last_name, name FROM students WHERE email ILIKE $1', [email]);
            if (sRes.rows.length > 0) {
                checkEmails.push(sRes.rows[0].admission_no.toLowerCase());
                checkEmails.push(`${sRes.rows[0].admission_no.toLowerCase()}@student.school.com`);
                userDetails.id = sRes.rows[0].admission_no;
                userDetails.name = `${sRes.rows[0].first_name || ''} ${sRes.rows[0].last_name || ''}`.trim() || sRes.rows[0].name;
                userDetails.email = sRes.rows[0].email;
            }
        } else if (normRole === 'TEACHER') {
            const tRes = await pool.query('SELECT email, employee_id, first_name, last_name, name FROM teachers WHERE email ILIKE $1', [email]);
            if (tRes.rows.length > 0) {
                checkEmails.push(tRes.rows[0].employee_id.toLowerCase());
                checkEmails.push(`${tRes.rows[0].employee_id.toLowerCase()}@teacher.school.com`);
                userDetails.id = tRes.rows[0].employee_id;
                userDetails.name = `${tRes.rows[0].first_name || ''} ${tRes.rows[0].last_name || ''}`.trim() || tRes.rows[0].name;
                userDetails.email = tRes.rows[0].email;
            }
        } else if (STAFF_SUB_ROLES.includes(normRole)) {
            const stRes = await pool.query('SELECT email, employee_id, first_name, last_name, name FROM staff WHERE email ILIKE $1', [email]);
            if (stRes.rows.length > 0) {
                checkEmails.push(stRes.rows[0].employee_id.toLowerCase());
                checkEmails.push(`${stRes.rows[0].employee_id.toLowerCase()}@staff.school.com`);
                userDetails.id = stRes.rows[0].employee_id;
                userDetails.name = `${stRes.rows[0].first_name || ''} ${stRes.rows[0].last_name || ''}`.trim() || stRes.rows[0].name;
                userDetails.email = stRes.rows[0].email;
            }
        } else if (normRole === 'SCHOOL_ADMIN') {
            const schoolRes = await pool.query('SELECT id, name, contact_email FROM schools WHERE contact_email ILIKE $1', [email]);
            if (schoolRes.rows.length > 0) {
                userDetails.schoolName = schoolRes.rows[0].name;
                userDetails.name = "School Administrator";
                userDetails.email = schoolRes.rows[0].contact_email;
            }
        }
    }

    return {
        checkEmails: [...new Set(checkEmails.filter(Boolean).map(e => e.trim().toLowerCase()))],
        isEmail,
        userDetails
    };
};

/**
 * Unified user query across all auth endpoints ensuring identical row selection & ordering
 */
const findAuthUser = async (checkEmails, role, originalInput, isEmail, extraCondition = '', extraParams = []) => {
    let roleCondition = '';
    let params = [checkEmails];

    if (role) {
        const normRole = role.toUpperCase();
        if (STAFF_SUB_ROLES.includes(normRole)) {
            params.push(STAFF_SUB_ROLES);
            roleCondition = `AND u.role = ANY($${params.length}::text[])`;
        } else {
            params.push(normRole);
            roleCondition = `AND u.role = $${params.length}`;
        }
    }

    let extraClause = '';
    if (extraCondition) {
        let conditionStr = extraCondition;
        for (const ep of extraParams) {
            params.push(ep);
            conditionStr = conditionStr.replace('?', `$${params.length}`);
        }
        extraClause = ` AND ${conditionStr}`;
    }

    const query = `
        SELECT u.* 
        FROM users u 
        LEFT JOIN schools s ON u.school_id = s.id 
        WHERE LOWER(u.email) = ANY($1::text[])
        ${roleCondition}
        ${extraClause}
        AND (u.school_id IS NULL OR s.status IS NULL OR s.status != 'Deleted')
        ORDER BY u.id DESC
    `;

    const result = await pool.query(query, params);

    let user = null;
    if (result.rows.length > 0) {
        if (!isEmail && originalInput) {
            const priorityMatch = result.rows.find(u => 
                u.email.toLowerCase().startsWith(originalInput.toLowerCase() + '@') ||
                u.email.toLowerCase() === originalInput.toLowerCase()
            );
            user = priorityMatch || result.rows[0];
        } else {
            user = result.rows[0];
        }
    }

    return { user, rows: result.rows };
};

const login = async (req, res) => {
    const { password, role } = req.body;
    let { email } = req.body; // Can be Email or ID (Admission No / Emp ID)

    if (email) email = email.trim();

    try {
        const { checkEmails, isEmail } = await resolveAuthCheckEmails(email, role);
        const { user } = await findAuthUser(checkEmails, role, email, isEmail);

        if (!user) {
            console.log(`[LOGIN DEBUG] No user found for ID: ${email}`);
            return res.status(401).json({ message: 'Invalid credentials or role mismatch' });
        }

        console.log(`[LOGIN DEBUG] Attempting login for DB User: ${user.email} (Role: ${user.role}) using provided password.`);

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        
        console.log(`[LOGIN DEBUG] Password match result: ${validPassword}`);

        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Role verification (Redundant due to SQL filter but good for safety/custom logic)
        if (role) {
            if (STAFF_SUB_ROLES.includes(role) && STAFF_SUB_ROLES.includes(user.role)) {
                // Allowed: Any staff sub-role can log in as STAFF or vice-versa
            } else if (user.role !== role) {
                return res.status(403).json({ message: `Access denied. You are not a ${role}` });
            }
        }

        // Check School Status (Is Active?) and Get Institution Type
        let schoolType = 'SCHOOL'; // Default
        if (user.school_id) {
            const schoolStatusRes = await pool.query('SELECT is_active, institution_type FROM schools WHERE id = $1', [user.school_id]);
            if (schoolStatusRes.rows.length > 0) {
                if (!schoolStatusRes.rows[0].is_active) {
                    return res.status(403).json({ message: 'Contact Super Admin for service' });
                }
                schoolType = schoolStatusRes.rows[0].institution_type || 'SCHOOL';
            }
        }

        // Fetch Linked ID (Student/Teacher/Staff ID) to optimize downstream requests
        let linkedId = null;
        if (user.role === 'STUDENT') {
            // Priority: Resolve ID based on LOGIN INPUT (e.g. ADM2) to ensure we get the right sibling
            let resolvedById = false;

            if (!isEmail) {
                // User logged in with ID (e.g. ADM2). Verify this ID belongs to the authenticated user.
                const inputStudentRes = await pool.query('SELECT id, email, admission_no FROM students WHERE school_id = $1 AND TRIM(UPPER(admission_no)) = TRIM(UPPER($2))', [user.school_id, email.trim()]);

                if (inputStudentRes.rows.length > 0) {
                    const st = inputStudentRes.rows[0];

                    // Normalize for comparison
                    const userEmail = (user.email || '').trim().toLowerCase();
                    const stEmail = (st.email || '').trim().toLowerCase();
                    const syntheticEmail = `${st.admission_no.trim().toLowerCase()}@student.school.com`;

                    // Debug Log
                    console.log(`[AuthDebug] User: ${userEmail}, TargetStudent: ${st.admission_no}, StEmail: ${stEmail}, Synthetic: ${syntheticEmail}`);

                    if (userEmail && (userEmail === stEmail || userEmail === syntheticEmail)) {
                        linkedId = st.id;
                        resolvedById = true;
                        console.log(`[AuthDebug] Linked to Student ID: ${linkedId} (via Input ID)`);
                    }
                }
            }

            if (!resolvedById) {
                // Fallback: Resolve by User Email (Standard behavior)
                // Warning: If siblings share email, this picks the first one found.
                let sRes = await pool.query('SELECT id FROM students WHERE school_id = $1 AND email = $2', [user.school_id, user.email]);

                if (sRes.rows.length === 0) {
                    // Synthetic email reverse lookup
                    const potentialAdmNo = user.email.split('@')[0];
                    sRes = await pool.query('SELECT id FROM students WHERE school_id = $1 AND admission_no ILIKE $2', [user.school_id, potentialAdmNo]);
                }

                if (sRes.rows.length > 0) linkedId = sRes.rows[0].id;
            }

        } else if (user.role === 'TEACHER') {
            let tRes = await pool.query('SELECT id FROM teachers WHERE school_id = $1 AND email = $2', [user.school_id, user.email]);
            if (tRes.rows.length === 0) {
                const potentialEmpId = (user.email || '').split('@')[0];
                tRes = await pool.query('SELECT id FROM teachers WHERE school_id = $1 AND employee_id ILIKE $2', [user.school_id, potentialEmpId]);
            }
            if (tRes.rows.length > 0) linkedId = tRes.rows[0].id;

        } else if (['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'].includes(user.role)) {
            // First Priority: Use the linked_id stored directly in the users table
            if (user.linked_id) {
                const stRes = await pool.query('SELECT id, library_access, hostel_access FROM staff WHERE id = $1 AND school_id = $2', [user.linked_id, user.school_id]);
                if (stRes.rows.length > 0) {
                    linkedId = stRes.rows[0].id;
                    user.library_access = stRes.rows[0].library_access;
                    user.hostel_access = stRes.rows[0].hostel_access;
                }
            }
            
            // Second Priority: Fallback to Email / Employee ID matching
            if (!linkedId) {
                let stRes = await pool.query('SELECT id, library_access, hostel_access FROM staff WHERE school_id = $1 AND email = $2', [user.school_id, user.email]);
                if (stRes.rows.length === 0) {
                    const potentialEmpId = (user.email || '').split('@')[0];
                    stRes = await pool.query('SELECT id, library_access, hostel_access FROM staff WHERE school_id = $1 AND employee_id ILIKE $2', [user.school_id, potentialEmpId]);
                }
                if (stRes.rows.length > 0) {
                    linkedId = stRes.rows[0].id;
                    user.library_access = stRes.rows[0].library_access;
                    user.hostel_access = stRes.rows[0].hostel_access;
                }
            }
        }

        // Generate Token
        // Admin roles: short-lived (8h) — they use browser sessions, not mobile app
        // Mobile roles: long-lived (365d) — they stay logged in on device until manual logout
        const ADMIN_ROLES = ['SCHOOL_ADMIN', 'SUPER_ADMIN'];
        const tokenExpiry = ADMIN_ROLES.includes(user.role) ? '8h' : '365d';

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                schoolId: user.school_id,
                linkedId: linkedId // Embedded ID for fast access
            },
            process.env.JWT_SECRET,
            { expiresIn: tokenExpiry }
        );

        // Update user with new session token
        await pool.query('UPDATE users SET current_session_token = $1 WHERE id = $2', [token, user.id]);

        // AUTOMATIC HOLIDAY GENERATION (Lazy Load for Any User with School Linked)
        // Ensures Current + Next Year always have holidays if missing (Triggered by Student/Teacher/Staff/Admin login)
        if (user.school_id) {
            const currentYear = new Date().getFullYear();
            // Fire and forget
            ensureHolidaysForSchool(user.school_id, currentYear).catch(e => console.error('Auto-Gen Holiday Current Failed', e));
            ensureHolidaysForSchool(user.school_id, currentYear + 1).catch(e => console.error('Auto-Gen Holiday Future Failed', e));
        }

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                schoolId: user.school_id,
                institutionType: schoolType,
                libraryAccess: user.library_access || user.role === 'LIBRARIAN' || false,
                hostelAccess: user.hostel_access || user.role === 'WARDEN' || false,
                mustChangePassword: user.must_change_password || false
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        // DEBUG: Return 400 instead of 500 to bypass the "Strict 500 Mask" in the old APK code.
        res.status(400).json({
            message: 'Server Error (Revealed): ' + error.message,
            stack: process.env.NODE_ENV === 'production' ? error.stack : undefined
        });
    }
};

const logout = async (req, res) => {
    try {
        await pool.query('UPDATE users SET current_session_token = NULL WHERE id = $1', [req.user.id]);
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Server error during logout' });
    }
};

const changePassword = async (req, res) => {
    const { oldPassword, newPassword, role } = req.body;
    let { email } = req.body;

    // Use authenticated user ID if available, otherwise rely on email/ID lookup
    const userId = req.user ? req.user.id : null;

    try {
        let user;
        if (userId) {
            const uRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
            user = uRes.rows[0];
        } else if (email) {
            email = email.trim();

            // Resolve ID to Email if necessary (Same logic as Login)
            let checkEmails = [email, email.toLowerCase()];
            const isEmail = email.includes('@');

            if (!isEmail) {
                // Try to resolve ID to email from all possible tables
                // We don't know the role, so we check all.

                // 1. Student
                const sRes = await pool.query('SELECT email FROM students WHERE admission_no ILIKE $1', [email]);
                if (sRes.rows.length > 0) checkEmails.push(sRes.rows[0].email);

                // 2. Teacher
                const tRes = await pool.query('SELECT email FROM teachers WHERE employee_id = $1', [email]);
                if (tRes.rows.length > 0) checkEmails.push(tRes.rows[0].email);

                // 3. Staff
                const stRes = await pool.query('SELECT email FROM staff WHERE employee_id = $1', [email]);
                if (stRes.rows.length > 0) checkEmails.push(stRes.rows[0].email);

                // 4. Fallback synthetic emails
                checkEmails.push(`${email.toLowerCase()}@student.school.com`);

                checkEmails.push(`${email}@teacher.school.com`);
                checkEmails.push(`${email.toLowerCase()}@teacher.school.com`);

                checkEmails.push(`${email}@staff.school.com`);
                checkEmails.push(`${email.toLowerCase()}@staff.school.com`);
            }

            // Find user matching ANY of these emails
            const eRes = await pool.query('SELECT * FROM users WHERE LOWER(email) = ANY($1::text[])', [checkEmails.filter(Boolean).map(e => e.trim().toLowerCase())]);
            
            if (role) {
                if (['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'].includes(role)) {
                    user = eRes.rows.find(u => ['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN'].includes(u.role));
                } else {
                    user = eRes.rows.find(u => u.role === role);
                }
            } else {
                user = eRes.rows[0];
            }
        }

        if (!user) return res.status(404).json({ message: 'User not found' });

        // Verify Old Password
        const match = await bcrypt.compare(oldPassword, user.password);
        if (!match) {
            return res.status(401).json({ message: 'Incorrect current password' });
        }

        // Hash New Password
        const hashedPrice = await bcrypt.hash(newPassword, 10);

        // Update password and clear must_change_password flag
        await pool.query('UPDATE users SET password = $1, must_change_password = FALSE WHERE id = $2', [hashedPrice, user.id]);

        res.json({ message: 'Password updated successfully' });

    } catch (error) {
        console.error('Change Password Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const setupSuperAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Check if Super Admin already exists
        const check = await pool.query("SELECT * FROM users WHERE role = 'SUPER_ADMIN'");
        if (check.rows.length > 0) {
            return res.status(400).json({ message: 'Super Admin already exists. Cannot create another one via this public route.' });
        }

        // 2. Create Password Hash
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Insert User
        const newUser = await pool.query(
            `INSERT INTO users (email, password, role, school_id) 
             VALUES ($1, $2, 'SUPER_ADMIN', NULL) 
             RETURNING id, email, role`,
            [email, hashedPassword]
        );

        res.json({ message: 'Super Admin created successfully!', user: newUser.rows[0] });

    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({ message: 'Server error during setup: ' + error.message });
    }
};


const forgotPassword = async (req, res) => {
    let { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ message: 'ID and Role are required' });

    email = email.trim();
    if (role) role = role.toUpperCase();

    const inputId = email; // Store original input (could be ID)

    try {
        console.log('[NEW OTP SYSTEM] ForgotPassword called with:', { email, role });
        const { checkEmails, isEmail, userDetails } = await resolveAuthCheckEmails(email, role);
        const { user } = await findAuthUser(checkEmails, role, inputId, isEmail);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get School Name
        if (user.school_id) {
            const schoolRes = await pool.query('SELECT name FROM schools WHERE id = $1', [user.school_id]);
            if (schoolRes.rows.length > 0) {
                userDetails.schoolName = schoolRes.rows[0].name;
            }
        }

        // Use the FOUND profile email for sending if available (Priority to Real Email), else User Table email
        const recipientEmail = userDetails.email || user.email;

        // Generate 6-digit OTP
        const crypto = require('crypto');
        const otp = crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
        const otpExpires = Date.now() + 600000; // 10 minutes

        // Update OTP on this user and any duplicate/linked user accounts with the same email or employee_id for this school
        await pool.query(`
            UPDATE users 
            SET reset_password_token = $1, reset_password_expires = $2 
            WHERE id = $3 
               OR (LOWER(email) = ANY($4::text[]) AND (school_id = $5 OR (school_id IS NULL AND $5 IS NULL)))
               OR (linked_id IS NOT NULL AND linked_id = $6 AND role = ANY(ARRAY['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN']))
        `, [otp, otpExpires, user.id, checkEmails, user.school_id, user.linked_id || -1]);

        // Resolve 'users' table ID for DB persistence
        const { sendOTP } = require('../services/emailService');

        // Log for development (always visible)
        if (process.env.NODE_ENV !== 'production') {
            console.log('----- PASSWORD RESET OTP (Dev Mode) -----');
            console.log(`Role: ${role}, ID: ${userDetails.id}, Sent To: ${recipientEmail}`);
            console.log(`OTP: ${otp}`);
            console.log('----------------------------------------');
        }

        // Attempt to send Real Email if configured
        try {
            await sendOTP(recipientEmail, otp, userDetails);
            console.log('OTP Email sent successfully to ' + recipientEmail);
        } catch (emailErr) {
            console.error('Failed to send OTP email:', emailErr.message);
            // Don't fail the request (user can still see OTP in dev logs if needed)
        }

        res.json({
            message: 'OTP sent to your registered email. Please check your inbox.',
            debug_otp: process.env.NODE_ENV === 'development' || true ? otp : undefined // EXPOSED FOR DEBUGGING
        });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getUserDetails = async (req, res) => {
    let { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ message: 'ID and Role are required' });

    email = email.trim();
    if (role) role = role.toUpperCase();

    try {
        const { userDetails } = await resolveAuthCheckEmails(email, role);

        if (!userDetails.name && !userDetails.email) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            success: true,
            name: userDetails.name || 'User',
            id: userDetails.id,
            role: userDetails.role
        });

    } catch (error) {
        console.error('Get User Details Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyOTP = async (req, res) => {
    const { otp, role, email } = req.body;
    let normalizedRole = role ? role.toUpperCase() : role;

    if (!otp || !normalizedRole || !email) {
        return res.status(400).json({ message: 'OTP, Role, and ID are required' });
    }

    try {
        const { checkEmails, isEmail } = await resolveAuthCheckEmails(email.trim(), normalizedRole);
        const { user } = await findAuthUser(checkEmails, normalizedRole, email.trim(), isEmail, 'u.reset_password_token = ? AND u.reset_password_expires > ?', [otp.trim(), Date.now()]);

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        res.json({
            message: 'OTP verified successfully',
            verified: true
        });

    } catch (error) {
        console.error('Verify OTP Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const resetPassword = async (req, res) => {
    const { otp, newPassword, role, email } = req.body;
    let normalizedRole = role ? role.toUpperCase() : role;

    if (!otp || !newPassword || !normalizedRole || !email) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const { checkEmails, isEmail } = await resolveAuthCheckEmails(email.trim(), normalizedRole);
        const { user } = await findAuthUser(checkEmails, normalizedRole, email.trim(), isEmail, 'u.reset_password_token = ? AND u.reset_password_expires > ?', [otp.trim(), Date.now()]);

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Merge the found user's actual email into checkEmails to guarantee the UPDATE hits the correct record
        // This is critical for staff who may login with an employee ID, where checkEmails may only have
        // the synthetic email (empid@staff.school.com) but the users table stores their real email.
        const mergedEmails = [...new Set([...checkEmails, (user.email || '').trim().toLowerCase()].filter(Boolean))];

        console.log(`[ResetPassword] Updating password for user id=${user.id}, role=${user.role}, mergedEmails=${JSON.stringify(mergedEmails)}`);

        // Update password on this user (by id) AND any duplicate/linked user accounts
        // The WHERE id = $2 always guarantees the found user is updated regardless of email matching
        const updateResult = await pool.query(`
            UPDATE users 
            SET password = $1, reset_password_token = NULL, reset_password_expires = NULL, must_change_password = FALSE 
            WHERE id = $2 
               OR (LOWER(email) = ANY($3::text[]) AND (school_id = $4 OR (school_id IS NULL AND $4 IS NULL)))
               OR (linked_id IS NOT NULL AND linked_id = $5 AND role = ANY(ARRAY['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN', 'WARDEN']))
        `, [
            hashedPassword, 
            user.id, 
            mergedEmails, 
            user.school_id, 
            user.linked_id || -1
        ]);

        console.log(`[ResetPassword] Rows updated: ${updateResult.rowCount}`);

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const registerFcmToken = async (req, res) => {
    const { token } = req.body;
    const userId = req.user.id;
    try {
        await pool.query('UPDATE users SET fcm_token = $1 WHERE id = $2', [token, userId]);
        res.json({ message: 'Push notifications linked successfully' });
    } catch (error) {
        console.error('FCM Registration Error:', error);
        res.status(500).json({ message: 'Failed to register device' });
    }
};

module.exports = { login, setupSuperAdmin, logout, forgotPassword, getUserDetails, verifyOTP, resetPassword, registerFcmToken, changePassword };
