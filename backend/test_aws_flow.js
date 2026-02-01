const axios = require('axios');

const API_URL = 'http://52.66.13.31/api';

async function testAWSFlow() {
    try {
        console.log(`🌍 Connecting to AWS: ${API_URL}`);

        let email = 'debug_admin@test.com';
        let password = 'password123';

        console.log(`🔐 Logging in as: ${email}`);

        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: email,
            password: password
        });

        const token = loginRes.data.token;
        console.log('✅ AWS Login Successful. Token obtained.');

        const headers = { Authorization: `Bearer ${token}` };

        // 2. GET Announcements
        console.log('\n🔍 Fetching Announcements from AWS...');
        const getRes = await axios.get(`${API_URL}/calendar/announcements`, { headers });

        // We look for the one we JUST created locally (Title starts with "API Flow Test")
        const found = getRes.data.find(a => a.title.startsWith("API Flow Test"));

        if (found) {
            console.log('✅ SUCCESS: Found the locally-created announcement on AWS!');
            console.log('   (This proves they share the same DB and AWS is working)');
            console.log(JSON.stringify(found, null, 2));
        } else {
            console.error('❌ FAILURE: Did not find the recent announcement.');
            console.log('Total fetched:', getRes.data.length);
        }

    } catch (err) {
        console.error('❌ Error details:', err.code || err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            // console.error('Data:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.error('Full Error:', err);
        }
    }
}

testAWSFlow();
