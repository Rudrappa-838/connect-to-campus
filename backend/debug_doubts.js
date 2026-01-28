const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

async function debugDoubts() {
    try {
        console.log('--- Testing Doubts Query ---');
        // Get a sample teacher to test with
        const teacherRes = await pool.query('SELECT id, email, school_id FROM teachers LIMIT 1');
        if (teacherRes.rows.length === 0) {
            console.log('No teachers found');
            return;
        }
        const teacher = teacherRes.rows[0];
        console.log('Testing with teacher:', teacher);

        const query = `
            SELECT d.*, st.name as student_name, st.roll_number, c.name as class_name, sub.name as subject_name
            FROM doubts d
            JOIN students st ON d.student_id = st.id
            LEFT JOIN classes c ON st.class_id = c.id
            LEFT JOIN subjects sub ON d.subject_id = sub.id
            WHERE d.teacher_id = $1
            ORDER BY d.created_at DESC
        `;

        try {
            const result = await pool.query(query, [teacher.id]);
            console.log('Query successful. Rows found:', result.rows.length);
        } catch (qErr) {
            console.error('Query FAILED:', qErr.message);
            console.error('Stack trace:', qErr.stack);
        }

        // Check if tables exist
        const checkTables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name IN ('doubts', 'students', 'classes', 'subjects')
        `);
        console.log('Existing tables:', checkTables.rows.map(r => r.table_name));

        pool.end();
    } catch (err) {
        console.error('Connection FAILED:', err.message);
        process.exit(1);
    }
}

debugDoubts();
