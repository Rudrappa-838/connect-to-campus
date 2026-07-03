const axios = require('axios');

async function testUpdate() {
    try {
        const response = await axios.put('http://localhost:5000/api/schools/2', {
            name: 'School Two',
            address: 'Address',
            contactEmail: 'admin@schooltwo.com',
            contactNumber: '1234567890',
            institution_type: 'SCHOOL',
            id_prefix: 'ABC',
            classes: [],
            allowDeletions: true
        });
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testUpdate();
