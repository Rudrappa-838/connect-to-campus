const axios = require('axios');
const { pool } = require('../config/db');

/**
 * SMS Service using Indian SMS Providers
 * Supports: MSG91, Fast2SMS, TextLocal
 * Cost: ₹0.10-0.25 per SMS (very affordable)
 */

// Initialize SMS provider based on environment
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'MSG91'; // MSG91, FAST2SMS, TEXTLOCAL

/**
 * Send SMS via MSG91 (Recommended for India)
 * Cost: ~₹0.15 per SMS
 * Sign up: https://msg91.com/
 */
const sendViaMSG91 = async (phoneNumber, message, schoolConfig) => {
    try {
        const authKey = schoolConfig.sms_api_key || process.env.MSG91_AUTH_KEY;
        const senderId = schoolConfig.sms_sender_id || process.env.MSG91_SENDER_ID || 'SCHOOL';
        const route = process.env.MSG91_ROUTE || '4'; // 4 = Transactional

        if (!authKey) {
            console.warn('[SMS] MSG91 auth key not configured');
            return false;
        }

        const url = 'https://api.msg91.com/api/sendhttp.php';
        const params = {
            authkey: authKey,
            mobiles: phoneNumber,
            message: message,
            sender: senderId,
            route: route,
            country: '91'
        };

        const response = await axios.get(url, { params });

        if (response.data.type === 'success') {
            console.log(`[SMS-MSG91] Sent to ${phoneNumber} | Response: ${response.data.message}`);
            return true;
        } else {
            console.error('[SMS-MSG91] Failed:', response.data);
            return false;
        }
    } catch (error) {
        console.error('[SMS-MSG91] Error:', error.message);
        return false;
    }
};

/**
 * Send SMS via Fast2SMS
 * Cost: ~₹0.10 per SMS (cheapest option)
 * Route 'v3' = Quick SMS (NO GST / DLT registration needed - good for testing)
 * Sign up: https://www.fast2sms.com/
 */
const sendViaFast2SMS = async (phoneNumber, message, schoolConfig) => {
    try {
        const apiKey = schoolConfig.sms_api_key || process.env.FAST2SMS_API_KEY;

        if (!apiKey) {
            console.warn('[SMS] Fast2SMS API key not configured');
            return false;
        }

        // Remove +91 or leading zeros, keep only 10 digits
        const cleanNumber = phoneNumber.replace(/^\+91/, '').replace(/\D/g, '').slice(-10);

        if (cleanNumber.length !== 10) {
            console.warn(`[SMS-Fast2SMS] Invalid phone number: ${phoneNumber}`);
            return false;
        }

        const url = 'https://www.fast2sms.com/dev/bulkV2';
        const response = await axios.post(url, {
            route: 'v3',          // v3 = Quick SMS (NO DLT/GST needed!)
            message: message,
            language: 'english',
            flash: 0,
            numbers: cleanNumber
        }, {
            headers: {
                'authorization': apiKey,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.return === true) {
            console.log(`[SMS-Fast2SMS] ✅ Sent to ${cleanNumber} | Request ID: ${response.data.request_id}`);
            return true;
        } else {
            console.error('[SMS-Fast2SMS] ❌ Failed:', JSON.stringify(response.data));
            return false;
        }
    } catch (error) {
        console.error('[SMS-Fast2SMS] Error:', error.response?.data || error.message);
        return false;
    }
};

/**
 * Send SMS via TextLocal
 * Cost: ~₹0.20 per SMS
 * Sign up: https://www.textlocal.in/
 */
const sendViaTextLocal = async (phoneNumber, message, schoolConfig) => {
    try {
        const apiKey = schoolConfig.sms_api_key || process.env.TEXTLOCAL_API_KEY;
        const sender = schoolConfig.sms_sender_id || process.env.TEXTLOCAL_SENDER || 'SCHOOL';

        if (!apiKey) {
            console.warn('[SMS] TextLocal API key not configured');
            return false;
        }

        // Remove +91 if present
        const cleanNumber = phoneNumber.replace(/^\+91/, '').replace(/\D/g, '');

        const url = 'https://api.textlocal.in/send/';
        const params = new URLSearchParams({
            apikey: apiKey,
            numbers: cleanNumber,
            message: message,
            sender: sender
        });

        const response = await axios.post(url, params);

        if (response.data.status === 'success') {
            console.log(`[SMS-TextLocal] Sent to ${phoneNumber} | Messages: ${response.data.messages.length}`);
            return true;
        } else {
            console.error('[SMS-TextLocal] Failed:', response.data);
            return false;
        }
    } catch (error) {
        console.error('[SMS-TextLocal] Error:', error.message);
        return false;
    }
};

/**
 * Main SMS sending function - routes to configured provider
 * @param {string} phoneNumber - Phone number (with or without +91)
 * @param {string} message - SMS content
 * @returns {Promise<boolean>}
 */
const sendSMS = async (schoolId, phoneNumber, message) => {
    try {
        if (!phoneNumber || !message) {
            console.warn('[SMS] Missing phone number or message');
            return false;
        }

        // Fetch school config if schoolId is provided
        let schoolConfig = {};
        if (schoolId) {
            const configRes = await pool.query('SELECT sms_provider, sms_api_key, sms_sender_id FROM schools WHERE id = $1', [schoolId]);
            if (configRes.rows.length > 0) {
                schoolConfig = configRes.rows[0];
            }
        }

        const providerToUse = schoolConfig.sms_provider || SMS_PROVIDER;

        // Format phone number
        let formattedNumber = phoneNumber.trim();
        if (!formattedNumber.startsWith('+91') && !formattedNumber.startsWith('91')) {
            formattedNumber = formattedNumber.replace(/^0+/, ''); // Remove leading zeros
        }

        // Route to appropriate provider
        switch (providerToUse.toUpperCase()) {
            case 'MSG91':
                return await sendViaMSG91(formattedNumber, message, schoolConfig);
            case 'FAST2SMS':
                return await sendViaFast2SMS(formattedNumber, message, schoolConfig);
            case 'TEXTLOCAL':
                return await sendViaTextLocal(formattedNumber, message, schoolConfig);
            default:
                console.log(`[SMS] Provider ${providerToUse} not configured. Message: ${message}`);
                return false;
        }
    } catch (error) {
        console.error('[SMS] Error:', error);
        return false;
    }
};

/**
 * Send attendance notification via SMS
 * @param {Object} user - User object with name and contact_number
 * @param {string} status - Attendance status
 * @returns {Promise<boolean>}
 */
const sendAttendanceSMS = async (user, status) => {
    try {
        const now = new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        const today = new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short'
        });

        let message = '';

        if (status === 'Present') {
            message = `Dear Parent, ${user.name} reached school at ${now} on ${today}. -School`;
        } else if (status === 'Absent') {
            message = `Dear Parent, ${user.name} is marked ABSENT on ${today}. Please contact school if unexpected. -School`;
        } else if (status === 'Late') {
            message = `Dear Parent, ${user.name} arrived late at ${now} on ${today}. -School`;
        }

        if (!message) return false;

        return await sendSMS(user.school_id, user.contact_number, message);
    } catch (error) {
        console.error('[SMS] Error sending attendance notification:', error);
        return false;
    }
};

module.exports = {
    sendSMS,
    sendAttendanceSMS
};
