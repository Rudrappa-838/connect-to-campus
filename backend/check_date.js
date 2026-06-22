const { pool } = require('./src/config/db');

async function test() {
    try {
        await pool.query("INSERT INTO hostel_attendance (school_id, hostel_id, student_id, date, status) VALUES (1, 1, 1, '2026-06-22', 'Present') ON CONFLICT DO NOTHING");
        const res = await pool.query(`
            SELECT 
                s.id as student_id,
                s.name,
                s.admission_no,
                r.room_number,
                TO_CHAR(ha.date, 'YYYY-MM-DD') as date,
                ha.status
            FROM hostel_allocations a
            JOIN students s ON a.student_id = s.id
            JOIN hostel_rooms r ON a.room_id = r.id
            LEFT JOIN hostel_attendance ha ON ha.student_id = s.id 
                AND EXTRACT(MONTH FROM ha.date) = 6 
                AND EXTRACT(YEAR FROM ha.date) = 2026
            WHERE a.status = 'Active' AND r.hostel_id = 1 AND s.school_id = 1
        `);
        console.log(JSON.stringify(res.rows));
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
