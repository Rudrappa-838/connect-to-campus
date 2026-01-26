const { pool } = require('../config/db');
const { ensureHolidaysForSchool } = require('./holidayController');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');


const login = async (req, res) => {
    const { password, role } = req.body;
    let { email } = req.body; // Can be Email or ID (Admission No / Emp ID)

    if (email) email = email.trim();

    // Resolve Emails to checks (support ID login)
    let checkEmails = [email];
    if (email) checkEmails.push(email.toLowerCase()); // Case insensitivity support

    const isEmail = email && email.includes('@');

    try {
        if (!isEmail && role) {
            // It's an ID. Resolve to possible emails.
            if (role === 'STUDENT') {
                checkEmails.push(`${email.toLowerCase()}@student.school.com`);
                const sRes = await pool.query('SELECT email FROM students WHERE admission_no ILIKE $1', [email]);
                if (sRes.rows.length > 0) checkEmails.push(sRes.rows[0].email);
            }
            else if (role === 'TEACHER') {
                checkEmails.push(`${email}@teacher.school.com`);
                checkEmails.push(`${email.toLowerCase()}@teacher.school.com`);
                const tRes = await pool.query('SELECT email FROM teachers WHERE employee_id = $1', [email]);
                if (tRes.rows.length > 0) checkEmails.push(tRes.rows[0].email);
            }
            else if (['STAFF', 'DRIVER', 'ACCOUNTANT'].includes(role)) { // Staff roles
                checkEmails.push(`${email}@staff.school.com`);
                checkEmails.push(`${email.toLowerCase()}@staff.school.com`);
                const stRes = await pool.query('SELECT email FROM staff WHERE employee_id = $1', [email]);
                if (stRes.rows.length > 0) checkEmails.push(stRes.rows[0].email);
            }
            else if (role === 'SCHOOL_ADMIN') {
                // Support school_code login for school admins
                const schoolRes = await pool.query('SELECT id, contact_email FROM schools WHERE school_code = $1', [email]);
                if (schoolRes.rows.length > 0) {
                    const schoolId = schoolRes.rows[0].id;
                    // Find school admin user for this school
                    const adminRes = await pool.query('SELECT email FROM users WHERE school_id = $1 AND role = $2', [schoolId, 'SCHOOL_ADMIN']);
                    if (adminRes.rows.length > 0) checkEmails.push(adminRes.rows[0].email);
                }
            }
        }

        // Find user by Email(s) AND Role (if provided)
        let query = `SELECT * FROM users WHERE email = ANY($1::text[])`;
        let params = [checkEmails];

        if (role) {
            if (role === 'STAFF') {
                query += ` AND role IN ('STAFF', 'DRIVER')`; // Allow both for Staff login
            } else {
                query += ` AND role = $2`;
                params.push(role);
            }
        }

        const result = await pool.query(query, params);

        let user = null;
        if (result.rows.length > 0) {
            if (!isEmail) {
                // If login was via ID, prioritize the synthetic email that matches the ID
                // Example: Input 'ADM2'. Result has 'adm2@student.school.com' and 'dad@gmail.com'
                // We want 'adm2@...'
                const priorityMatch = result.rows.find(u => u.email.toLowerCase().startsWith(email.toLowerCase() + '@'));
                user = priorityMatch || result.rows[0];
            } else {
                user = result.rows[0];
            }
        }

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials or role mismatch' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Role verification (Redundant due to SQL filter but good for safety/custom logic)
        if (role) {
            if (role === 'STAFF') {
                // strict check if needed
            } else if (user.role !== role) {
                return res.status(403).json({ message: `Access denied. You are not a ${role}` });
            }
        }

        // Check School Status (Is Active?)
        if (user.school_id) {
            const schoolStatusRes = await pool.query('SELECT is_active FROM schools WHERE id = $1', [user.school_id]);
            if (schoolStatusRes.rows.length > 0 && !schoolStatusRes.rows[0].is_active) {
                return res.status(403).json({ message: 'Contact Super Admin for service' });
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
                const potentialEmpId = user.email.split('@')[0];
                tRes = await pool.query('SELECT id FROM teachers WHERE school_id = $1 AND employee_id = $2', [user.school_id, potentialEmpId]);
            }
            if (tRes.rows.length > 0) linkedId = tRes.rows[0].id;

        } else if (['STAFF', 'DRIVER', 'ACCOUNTANT', 'LIBRARIAN'].includes(user.role)) {
            let stRes = await pool.query('SELECT id FROM staff WHERE school_id = $1 AND email = $2', [user.school_id, user.email]);
            if (stRes.rows.length === 0) {
                const potentialEmpId = user.email.split('@')[0];
                stRes = await pool.query('SELECT id FROM staff WHERE school_id = $1 AND employee_id = $2', [user.school_id, potentialEmpId]);
            }
            if (stRes.rows.length > 0) linkedId = stRes.rows[0].id;
        }

        // Generate Token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                schoolId: user.school_id,
                linkedId: linkedId // Embedded ID for fast access
            },
            process.env.JWT_SECRET,
            { expiresIn: '365d' }
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
    const { oldPassword, newPassword } = req.body;
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
            const eRes = await pool.query('SELECT * FROM users WHERE email = ANY($1::text[])', [checkEmails]);
            user = eRes.rows[0];
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
    const inputId = email; // Store original input (could be ID)

    try {
        console.log('[NEW OTP SYSTEM] ForgotPassword called with:', { email, role });
        // Resolve logic to find the specific user similar to login (Unified ID/Email resolution)
        let checkEmails = [email];
        checkEmails.push(email.toLowerCase());

        const isEmail = email.includes('@');
        let userDetails = { id: inputId, role: role, schoolName: '' };

        if (!isEmail && role) {
            if (role === 'STUDENT') {
                checkEmails.push(`${email.toLowerCase()}@student.school.com`);
                const sRes = await pool.query('SELECT email, admission_no, first_name, last_name FROM students WHERE admission_no ILIKE $1', [email]);
                if (sRes.rows.length > 0) {
                    checkEmails.push(sRes.rows[0].email);
                    userDetails.id = sRes.rows[0].admission_no;
                    userDetails.name = `${sRes.rows[0].first_name || ''} ${sRes.rows[0].last_name || ''}`.trim();
                }
            }
            else if (role === 'TEACHER') {
                checkEmails.push(`${email}@teacher.school.com`);
                checkEmails.push(`${email.toLowerCase()}@teacher.school.com`);
                const tRes = await pool.query('SELECT email, employee_id, first_name, last_name FROM teachers WHERE employee_id = $1', [email]);
                if (tRes.rows.length > 0) {
                    checkEmails.push(tRes.rows[0].email);
                    userDetails.id = tRes.rows[0].employee_id;
                    userDetails.name = `${tRes.rows[0].first_name || ''} ${tRes.rows[0].last_name || ''}`.trim();
                }
            }
            else if (['STAFF', 'DRIVER', 'ACCOUNTANT'].includes(role)) {
                checkEmails.push(`${email}@staff.school.com`);
                checkEmails.push(`${email.toLowerCase()}@staff.school.com`);
                const stRes = await pool.query('SELECT email, employee_id, first_name, last_name FROM staff WHERE employee_id = $1', [email]);
                if (stRes.rows.length > 0) {
                    checkEmails.push(stRes.rows[0].email);
                    userDetails.id = stRes.rows[0].employee_id;
                    userDetails.name = `${stRes.rows[0].first_name || ''} ${stRes.rows[0].last_name || ''}`.trim();
                }
            }
        }

        // Find user
        let query = `SELECT * FROM users WHERE email = ANY($1::text[])`;
        let params = [checkEmails];

        if (role === 'STAFF') {
            query += ` AND role IN ('STAFF', 'DRIVER')`;
        } else {
            query += ` AND role = $2`;
            params.push(role);
        }

        const result = await pool.query(query, params);
        const user = result.rows[0];

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

        // Use the FOUND user's email for sending, not the input (which might be an ID)
        const recipientEmail = user.email;

        // Generate 6-digit OTP
        const crypto = require('crypto');
        const otp = crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
        const otpExpires = Date.now() + 600000; // 10 minutes

        await pool.query('UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3', [otp, otpExpires, user.id]);

        // Log for development (always visible)
        console.log('----- PASSWORD RESET OTP (Dev Mode) -----');
        console.log(`Role: ${role}, ID: ${userDetails.id}, Sent To: ${recipientEmail}`);
        console.log(`OTP: ${otp}`);
        console.log('----------------------------------------');

        // Attempt to send Real Email if configured
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
                    port: parseInt(process.env.SMTP_PORT) || 587,
                    secure: false, // Use STARTTLS
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    },
                    connectionTimeout: 30000,
                    greetingTimeout: 30000,
                    socketTimeout: 30000
                });

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: recipientEmail,
                    subject: 'Password Reset OTP - School Portal',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                            <h2 style="color: #2563eb; text-align: center;">Password Reset Request</h2>
                            <hr style="border: 1px solid #e0e0e0;">
                            
                            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 10px 0;"><strong>School:</strong> ${userDetails.schoolName || 'N/A'}</p>
                                <p style="margin: 10px 0;"><strong>Role:</strong> ${role}</p>
                                <p style="margin: 10px 0;"><strong>ID:</strong> ${userDetails.id}</p>
                                ${userDetails.name ? `<p style="margin: 10px 0;"><strong>Name:</strong> ${userDetails.name}</p>` : ''}
                            </div>
                            
                            <p style="font-size: 16px; color: #374151;">Your One-Time Password (OTP) for password reset is:</p>
                            
                            <div style="background-color: #2563eb; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
                                ${otp}
                            </div>
                            
                            <p style="color: #dc2626; font-weight: bold;">⏰ This OTP expires in 10 minutes.</p>
                            <p style="color: #6b7280; font-size: 14px;">If you did not request this password reset, please ignore this email and your password will remain unchanged.</p>
                            
                            <hr style="border: 1px solid #e0e0e0; margin-top: 30px;">
                            <p style="text-align: center; color: #9ca3af; font-size: 12px;">School Management System - Secure Password Reset</p>
                        </div>
                    `
                };

                await transporter.sendMail(mailOptions);
                console.log('OTP Email sent successfully to ' + recipientEmail);
            } catch (emailErr) {
                console.error('Failed to send OTP email:', emailErr.message);
                // Don't fail the request
            }
        } else {
            console.log('NOTE: Real email sending skipped. Add EMAIL_USER and EMAIL_PASS to .env to enable.');
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

    try {
        let userInfo = { name: '', email: '', id: email, role: role };
        const isEmail = email.includes('@');

        if (!isEmail && role) {
            if (role === 'STUDENT') {
                const sRes = await pool.query('SELECT email, admission_no, first_name, last_name FROM students WHERE admission_no ILIKE $1', [email]);
                if (sRes.rows.length > 0) {
                    const student = sRes.rows[0];
                    userInfo.name = `${student.first_name || ''} ${student.last_name || ''}`.trim();
                    userInfo.email = student.email;
                    userInfo.id = student.admission_no;
                }
            }
            else if (role === 'TEACHER') {
                const tRes = await pool.query('SELECT email, employee_id, first_name, last_name FROM teachers WHERE employee_id = $1', [email]);
                if (tRes.rows.length > 0) {
                    const teacher = tRes.rows[0];
                    userInfo.name = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim();
                    userInfo.email = teacher.email;
                    userInfo.id = teacher.employee_id;
                }
            }
            else if (['STAFF', 'DRIVER', 'ACCOUNTANT'].includes(role)) {
                const stRes = await pool.query('SELECT email, employee_id, first_name, last_name FROM staff WHERE employee_id = $1', [email]);
                if (stRes.rows.length > 0) {
                    const staff = stRes.rows[0];
                    userInfo.name = `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
                    userInfo.email = staff.email;
                    userInfo.id = staff.employee_id;
                }
            }
            else if (role === 'SCHOOL_ADMIN') {
                const schoolRes = await pool.query('SELECT id, name, contact_email FROM schools WHERE school_code = $1', [email]);
                if (schoolRes.rows.length > 0) {
                    userInfo.name = schoolRes.rows[0].name;
                    userInfo.email = schoolRes.rows[0].contact_email;
                }
            }
        }

        if (!userInfo.name && !userInfo.email) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            success: true,
            name: userInfo.name || 'User',
            id: userInfo.id,
            role: userInfo.role
        });

    } catch (error) {
        console.error('Get User Details Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyOTP = async (req, res) => {
    const { otp, role, email } = req.body;

    if (!otp || !role || !email) {
        return res.status(400).json({ message: 'OTP, Role, and ID are required' });
    }

    try {
        // Resolve ID to email similar to forgotPassword
        let checkEmails = [email.trim()];
        checkEmails.push(email.trim().toLowerCase());

        const isEmail = email.includes('@');

        if (!isEmail && role) {
            if (role === 'STUDENT') {
                checkEmails.push(`${email.toLowerCase()}@student.school.com`);
                const sRes = await pool.query('SELECT email FROM students WHERE admission_no ILIKE $1', [email]);
                if (sRes.rows.length > 0) checkEmails.push(sRes.rows[0].email);
            }
            else if (role === 'TEACHER') {
                checkEmails.push(`${email}@teacher.school.com`);
                checkEmails.push(`${email.toLowerCase()}@teacher.school.com`);
                const tRes = await pool.query('SELECT email FROM teachers WHERE employee_id = $1', [email]);
                if (tRes.rows.length > 0) checkEmails.push(tRes.rows[0].email);
            }
            else if (['STAFF', 'DRIVER', 'ACCOUNTANT'].includes(role)) {
                checkEmails.push(`${email}@staff.school.com`);
                checkEmails.push(`${email.toLowerCase()}@staff.school.com`);
                const stRes = await pool.query('SELECT email FROM staff WHERE employee_id = $1', [email]);
                if (stRes.rows.length > 0) checkEmails.push(stRes.rows[0].email);
            }
        }

        // Find user with matching OTP
        let query = `SELECT * FROM users WHERE email = ANY($1::text[]) AND reset_password_token = $2 AND reset_password_expires > $3`;
        let params = [checkEmails, otp.trim(), Date.now()];

        if (role === 'STAFF') {
            query += ` AND role IN ('STAFF', 'DRIVER')`;
        } else {
            query += ` AND role = $4`;
            params.push(role);
        }

        const result = await pool.query(query, params);
        const user = result.rows[0];

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

    if (!otp || !newPassword || !role || !email) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        // Resolve ID to email similar to forgotPassword
        let checkEmails = [email.trim()];
        checkEmails.push(email.trim().toLowerCase());

        const isEmail = email.includes('@');

        if (!isEmail && role) {
            if (role === 'STUDENT') {
                checkEmails.push(`${email.toLowerCase()}@student.school.com`);
                const sRes = await pool.query('SELECT email FROM students WHERE admission_no ILIKE $1', [email]);
                if (sRes.rows.length > 0) checkEmails.push(sRes.rows[0].email);
            }
            else if (role === 'TEACHER') {
                checkEmails.push(`${email}@teacher.school.com`);
                checkEmails.push(`${email.toLowerCase()}@teacher.school.com`);
                const tRes = await pool.query('SELECT email FROM teachers WHERE employee_id = $1', [email]);
                if (tRes.rows.length > 0) checkEmails.push(tRes.rows[0].email);
            }
            else if (['STAFF', 'DRIVER', 'ACCOUNTANT'].includes(role)) {
                checkEmails.push(`${email}@staff.school.com`);
                checkEmails.push(`${email.toLowerCase()}@staff.school.com`);
                const stRes = await pool.query('SELECT email FROM staff WHERE employee_id = $1', [email]);
                if (stRes.rows.length > 0) checkEmails.push(stRes.rows[0].email);
            }
        }

        // Find user with valid OTP and expiry
        let query = `SELECT * FROM users WHERE email = ANY($1::text[]) AND reset_password_token = $2 AND reset_password_expires > $3`;
        let params = [checkEmails, otp.trim(), Date.now()];

        if (role === 'STAFF') {
            query += ` AND role IN ('STAFF', 'DRIVER')`;
        } else {
            query += ` AND role = $4`;
            params.push(role);
        }

        const result = await pool.query(query, params);
        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL, must_change_password = FALSE WHERE id = $2', [hashedPassword, user.id]);

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
