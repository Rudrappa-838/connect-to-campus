const axios = require('axios');
const FormData = require('form-data');
const xlsx = require('xlsx');

async function testUpload() {
    try {
        // Create a dummy Excel file in memory
        const wb = xlsx.utils.book_new();
        const headers = ['Student Name', 'Class', 'Admission No'];
        const data = [headers, ['Test Val', 'Class 10', 'TESTUP123']]; // Assumes 'Class 10' exists
        const ws = xlsx.utils.aoa_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const form = new FormData();
        form.append('file', buffer, 'test_students.xlsx');

        // Login first? Bulk upload is protected.
        // I need a token.
        // Let's assume I can login as admin using env creds or default admin.
        // Or I can disable auth middleware temporarily? No.

        console.log('Please provide a valid Bearer Token for testing...');
        // I can't easily automated login without credentials.
        // I'll skip this unless I have credentials.

    } catch (err) {
        console.error(err);
    }
}
// Checking DB directly is faster.
