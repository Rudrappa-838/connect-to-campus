const axios = require('axios');

async function testCreate() {
    try {
        // First login as super admin
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            identifier: 'superadmin@school.com',
            password: 'Super@2026'
        });

        const token = loginRes.data.token;
        console.log("✅ Logged in successfully");

        // Now create school
        const createRes = await axios.post('http://localhost:5000/api/schools', {
            name: "Test College XYZ",
            address: "123 Test Street",
            contactEmail: "testcollegexyz@example.com",
            contactNumber: "8888888888",
            adminEmail: "admin@testcollegexyz.com",
            adminPassword: "Test@123",
            institution_type: "COLLEGE",
            classes: []
        }, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log("✅ School created:", createRes.data);
    } catch (error) {
        console.error("❌ Full Error:", error);
        if (error.response) {
            console.log("❌ Error Status:", error.response.status);
            console.log("❌ Error Data:", error.response.data);
        } else {
            console.error("❌ Error Message:", error.message);
        }
    }
}

testCreate();
