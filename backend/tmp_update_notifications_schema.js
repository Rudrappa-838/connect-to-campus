const { pool } = require('./src/config/db');

const updateSchema = async () => {
    const client = await pool.connect();
    try {
        console.log('Updating notifications table schema...');
        await client.query(`
            ALTER TABLE notifications 
            ADD COLUMN IF NOT EXISTS attachment_url TEXT,
            ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(100);
        `);
        console.log('✅ Notifications table updated successfully.');
    } catch (err) {
        console.error('❌ Failed to update notifications table:', err.message);
    } finally {
        client.release();
        process.exit();
    }
};

updateSchema();
