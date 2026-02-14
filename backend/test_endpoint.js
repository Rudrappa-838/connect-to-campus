const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const API_URL = 'http://localhost:5000/api/hostel/finance/stats';

async function testEndpoint() {
    console.log('Testing endpoint with generated token...');

    // Generate token for User ID 1 (linked to School ID 1)
    // Flattened payload to match authController
    const payload = {
        id: 9, // Hardcoded valid user ID for School 1
        schoolId: 1,
        role: 'admin'
    };

    /* SKIP DB FOR NOW
    const { pool } = require('./src/config/db');
    let userId = null;
    try {
        const client = await pool.connect();
        try {
            const res = await client.query("SELECT id FROM users WHERE school_id = 1 LIMIT 1");
            if (res.rows.length > 0) userId = res.rows[0].id;
        } finally {
            client.release();
        }
    } catch (e) {
        console.error('DB Error:', e);
    }
    */
    let userId = 9; // Hardcoded from previous success log

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    console.log(`Generated Token for User ${userId}, School 1`);

    try {
        const res = await axios.get(API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('Response Status:', res.status);
        console.log('Response Data:', JSON.stringify(res.data, null, 2));
    } catch (error) {
        console.error('Error hitting endpoint:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

testEndpoint();
