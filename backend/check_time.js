require('dotenv').config();
const { pool } = require('./src/config/db');

async function checkAllLogs() {
    try {
        console.log('=== ALL GEOFENCE LOGS ===');
        const res = await pool.query(`
            SELECT id, school_id, teacher_id, date, event_type, timestamp, distance
            FROM teacher_attendance_geofence_logs 
            ORDER BY id ASC
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkAllLogs();
