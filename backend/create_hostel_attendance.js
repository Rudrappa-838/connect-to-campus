const { pool } = require('./src/config/db');

const createTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS hostel_attendance (
                id SERIAL PRIMARY KEY,
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                hostel_id INTEGER REFERENCES hostels(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                status VARCHAR(50) NOT NULL,
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, date)
            )
        `);
        console.log("Table hostel_attendance created successfully.");
    } catch (err) {
        console.error("Error creating table:", err);
    } finally {
        process.exit();
    }
};

createTable();
