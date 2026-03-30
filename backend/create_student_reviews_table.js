const { pool } = require('./src/config/db');

async function createTable() {
    const client = await pool.connect();
    try {
        console.log('🚀 Creating student_reviews table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_reviews (
                id SERIAL PRIMARY KEY,
                school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                sender_role VARCHAR(20) NOT NULL,
                sender_name VARCHAR(255),
                message TEXT NOT NULL,
                review_type VARCHAR(50) DEFAULT 'GENERAL',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Add indexes for faster lookups
            CREATE INDEX IF NOT EXISTS idx_student_reviews_student ON student_reviews(student_id);
            CREATE INDEX IF NOT EXISTS idx_student_reviews_school ON student_reviews(school_id);
        `);
        console.log('✅ Table created successfully!');
    } catch (err) {
        console.error('❌ Error creating table:', err);
    } finally {
        client.release();
        process.exit();
    }
}

createTable();
