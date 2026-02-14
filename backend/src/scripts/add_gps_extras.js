const { pool } = require('../config/db');

async function updateSchema() {
    try {
        console.log('Running GPS schema update...');

        // 1. Add Speed Column
        await pool.query(`
            ALTER TABLE transport_vehicles 
            ADD COLUMN IF NOT EXISTS speed FLOAT DEFAULT 0;
        `);

        // 2. Add Last Updated Column
        await pool.query(`
            ALTER TABLE transport_vehicles 
            ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        `);

        // 3. Add Status Column (if missing)
        await pool.query(`
            ALTER TABLE transport_vehicles 
            ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Inactive';
        `);

        // 4. Add Current Lat/Lng (if missing)
        await pool.query(`
            ALTER TABLE transport_vehicles 
            ADD COLUMN IF NOT EXISTS current_lat FLOAT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS current_lng FLOAT DEFAULT 0;
        `);

        console.log('✅ Successfully added speed, last_updated, and status columns to transport_vehicles table');
    } catch (error) {
        console.error('❌ Error updating schema:', error);
    } finally {
        pool.end();
    }
}

updateSchema();
