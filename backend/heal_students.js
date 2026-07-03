const { pool } = require('./src/config/db');

async function healStudents() {
    try {
        console.log("Healing Unassigned students who have valid classes...");
        const result = await pool.query(`
            UPDATE students s
            SET status = 'Active'
            FROM classes c
            WHERE s.status = 'Unassigned' 
            AND s.class_id = c.id
            RETURNING s.id, s.name, c.name as class_name;
        `);
        console.log(`Healed ${result.rows.length} students. They are now Active and will appear in the Dashboard.`);
    } catch (e) {
        console.error("Error healing students:", e);
    } finally {
        pool.end();
    }
}

healStudents();
