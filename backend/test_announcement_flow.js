const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://52.66.13.31/api';

async function testFlow() {
    try {
        console.log('🔐 Logging in...');
        const creds = fs.readFileSync('rudrappa_creds.txt', 'utf8').trim().split('\n');
        // Assuming format is known or we just try standard admin creds if this fails
        // Actually, let's just try hardcoded standard credentials if file read is complex
        // We will try to parse the file content in the run step or just use known default


        let email = 'debug_admin@test.com';
        let password = 'password123';

        console.log(`Using: ${email} / ***`);

        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: email,
            password: password
        });

        const token = loginRes.data.token;
        console.log('✅ Login Successful. Token obtained.');

        const headers = { Authorization: `Bearer ${token}` };

        // 1. POST Announcement
        console.log('\n📝 Posting Announcement...');
        const payload = {
            title: "API Flow Test " + Date.now(),
            message: "Testing if this persists and returns.",
            target_role: "All",
            priority: "High"
        };

        const postRes = await axios.post(`${API_URL}/calendar/announcements`, payload, { headers });
        console.log('✅ Post Response:', postRes.status, postRes.data.id);

        // 2. GET Announcements
        console.log('\n🔍 Fetching Announcements...');
        const getRes = await axios.get(`${API_URL}/calendar/announcements`, { headers });

        const found = getRes.data.find(a => a.id === postRes.data.id);
        if (found) {
            console.log('✅ SUCCESS: Found the new announcement in the list!');
            console.log(found);
        } else {
            console.error('❌ FAILURE: New announcement ID not found in fetch list!');
            console.log('Total fetched:', getRes.data.length);
            console.log('First 3:', getRes.data.slice(0, 3));
        }

    } catch (err) {
        console.error('❌ Error details:', err.code || err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.error('Full Error:', err);
        }
    }
}

testFlow();
