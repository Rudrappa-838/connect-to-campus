const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testUpdate() {
    try {
        const client = await pool.connect();

        // 1. Get a valid timetable slot ID
        const slotRes = await client.query('SELECT * FROM timetables LIMIT 1');
        if (slotRes.rows.length === 0) {
            console.log('No timetable slots found to test.');
            return;
        }

        const slot = slotRes.rows[0];
        console.log('Testing update for slot ID:', slot.id);

        // 2. Attempt update
        const updateQuery = `
            UPDATE timetables 
            SET subject_id = $1, teacher_id = $2
            WHERE id = $3 AND school_id = $4
            RETURNING *
        `;

        // Use existing values to avoid FK constraint errors, but just test the query logic
        const res = await client.query(updateQuery, [slot.subject_id, slot.teacher_id, slot.id, slot.school_id]);

        console.log('Update result row count:', res.rowCount);
        if (res.rowCount === 1) {
            console.log('SUCCESS: Slot updated.');
        } else {
            console.log('FAILURE: Slot NOT updated (maybe school_id mismatch?)');
        }

        client.release();
    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        pool.end();
    }
}

testUpdate();
