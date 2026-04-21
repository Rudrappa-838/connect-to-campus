const nodemailer = require('nodemailer');

const createTransporter = () => {
    // 1. Production / External SMTP (e.g. Gmail, Brevo, SendGrid)
    // EMAIL_USER and EMAIL_PASS are required for this to work.
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false, // Use STARTTLS
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            connectionTimeout: 30000, // Wait for 30s
            greetingTimeout: 30000,
            socketTimeout: 30000
        });
    }
    
    // 2. Fallback / Dev (if no credentials provided, return mock)
    return null;
};

const sendEmail = async ({ to, subject, html, fromName = 'School Portal' }) => {
    const transporter = createTransporter();
    
    if (!transporter) {
        console.warn('⚠️ SMTP credentials not found in .env. Skipping real email send.');
        console.log(`[DEV-MODE EMAIL] To: ${to} | Subject: ${subject}`);
        return false;
    }

    try {
        // Use NO_REPLY_EMAIL if provided, else fall back to EMAIL_USER login
        const fromEmail = process.env.NO_REPLY_EMAIL || process.env.EMAIL_USER;
        
        const mailOptions = {
            from: `"${fromName}" <${fromEmail}>`,
            to,
            subject,
            html,
            replyTo: fromEmail.includes('no-reply') ? fromEmail : undefined
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        throw error;
    }
};

const sendOTP = async (recipientEmail, otp, userDetails) => {
    const subject = 'Your Password Reset OTP - Connect to Campus';
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #2563eb; text-align: center;">Account Security Verification</h2>
            <hr style="border: 1px solid #e0e0e0;">
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 10px 0;"><strong>School:</strong> ${userDetails.schoolName || 'N/A'}</p>
                <p style="margin: 10px 0;"><strong>Role:</strong> ${userDetails.role || 'User'}</p>
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
    `;

    return sendEmail({ 
        to: recipientEmail, 
        subject, 
        html, 
        fromName: userDetails.schoolName || 'School Portal' 
    });
};

module.exports = { sendEmail, sendOTP };
