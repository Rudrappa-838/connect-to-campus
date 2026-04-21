const axios = require('axios');
const { pool } = require('./src/config/db');
require('dotenv').config();
const app = require('./src/app');
const http = require('http');

let server;
const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}/api`;

async function startServer() {
    return new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(PORT, () => {
            console.log(`Test Server running on port ${PORT}`);
            resolve();
        });
    });
}

async function closeServer() {
    return new Promise((resolve) => {
        if (server) {
            server.close(() => {
                console.log('Test Server stopped');
                resolve();
            });
        } else {
            resolve();
        }
    });
}

async function testFixes() {
    try {
        await startServer();
        console.log('--- STARTING VERIFICATION V2 ---');

        // 1. LOGIN
        const userRes = await pool.query("SELECT email FROM users WHERE role = 'SCHOOL_ADMIN' LIMIT 1");
        if (userRes.rows.length === 0) {
            console.error('No SCHOOL_ADMIN found to test with.');
            process.exit(1);
        }
        const email = userRes.rows[0].email;
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET || 'your_jwt_secret';
        const userIdRes = await pool.query("SELECT id, school_id, role FROM users WHERE email = $1", [email]);
        const user = userIdRes.rows[0];

        const token = jwt.sign(
            { id: user.id, schoolId: user.school_id, role: user.role, email: email },
            secret,
            { expiresIn: '1h' }
        );
        console.log(`Generated Test Token for ${email} (School: ${user.school_id})`);
        const headers = { Authorization: `Bearer ${token}` };

        // 2. TEST LOGO UPDATE (JSON Payload)
        console.log('\n--- TESTING LOGO UPDATE ---');
        const logoPayload = {
            logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        };

        try {
            const logoRes = await axios.put(`${BASE_URL}/schools/my-school/logo`, logoPayload, { headers });
            console.log('✅ Logo Update Success:', logoRes.data);
        } catch (err) {
            console.error('❌ Logo Update Failed:', err.response ? err.response.data : err.message);
        }

        // 3. TEST ACADEMIC YEAR CREATION (Valid)
        console.log('\n--- TESTING VALID ACADEMIC YEAR ---');
        const validYear = {
            year_label: `Test-Year-${Date.now()}`,
            start_date: '2026-06-01',
            end_date: '2027-05-31',
            status: 'upcoming'
        };

        try {
            const yearRes = await axios.post(`${BASE_URL}/academic-years`, validYear, { headers });
            console.log('✅ Academic Year Created:', yearRes.data);
            await pool.query('DELETE FROM academic_years WHERE id = $1', [yearRes.data.id]);
        } catch (err) {
            console.error('❌ Academic Year Creation Failed:', err.response ? err.response.data : err.message);
        }

        // 4. TEST ACADEMIC YEAR CREATION (Invalid Date Logic)
        console.log('\n--- TESTING INVALID DATE LOGIC ---');
        const invalidYear = {
            year_label: `Bad-Year-${Date.now()}`,
            start_date: '2027-06-01',
            end_date: '2026-05-31',
            status: 'upcoming'
        };

        try {
            await axios.post(`${BASE_URL}/academic-years`, invalidYear, { headers });
            console.error('❌ FAILURE: Invalid year was successfully created');
        } catch (err) {
            if (err.response && err.response.status === 400) {
                console.log('✅ Correctly Rejected Invalid Year:', err.response.data.message);
            } else {
                console.error('❌ Unexpected Error for Invalid Year:', err.response ? err.response.data : err.message);
            }
        }

    } catch (err) {
        console.error('Fatal Error:', err);
    } finally {
        await closeServer();
        pool.end();
    }
}

testFixes();
