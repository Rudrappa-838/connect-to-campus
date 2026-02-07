const axios = require('axios');

async function testCreate() {
    try {
        const response = await axios.post('http://localhost:5000/api/schools', {
            name: "Test School Recreate",
            address: "Test Address",
            contactEmail: "bgmit@gmail.com", // This is the DELETED one
            contactNumber: "9999999999",
            adminEmail: "newadmin@bgmit.com",
            adminPassword: "password123",
            institution_type: "SCHOOL"
        });
        console.log("Success:", response.data);
    } catch (error) {
        if (error.response) {
            console.log("Error Status:", error.response.status);
            console.log("Error Data:", error.response.data);
        } else {
            console.error("Error:", error.message);
        }
    }
}

testCreate();
