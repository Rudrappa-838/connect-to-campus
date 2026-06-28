const { pool } = require('./src/config/db');

async function test() {
    try {
        const result = await pool.query(
            'INSERT INTO hostels (name, type, address, warden_name, contact_number, school_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            ["Test Hostel", "Boys", "Test Address", "Test Warden", "1234567890", 2]
        );
        console.log(result.rows[0]);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
test();
