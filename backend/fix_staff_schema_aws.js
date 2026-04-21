const { pool } = require('./src/config/db');

async function fixStaffSchema() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Staff Schema Fix for AWS...');

        // Check columns first for safety
        const checkResult = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'staff'
        `);
        const existingCols = checkResult.rows.map(r => r.column_name);
        
        const updates = [
            { name: 'salary_per_day', query: 'ALTER TABLE staff ADD COLUMN salary_per_day DECIMAL(10, 2) DEFAULT 0' },
            { name: 'library_access', query: 'ALTER TABLE staff ADD COLUMN library_access BOOLEAN DEFAULT FALSE' },
            { name: 'hostel_access', query: 'ALTER TABLE staff ADD COLUMN hostel_access BOOLEAN DEFAULT FALSE' },
            { name: 'can_enroll_face', query: 'ALTER TABLE staff ADD COLUMN can_enroll_face BOOLEAN DEFAULT FALSE' },
            { name: 'can_take_face_attendance', query: 'ALTER TABLE staff ADD COLUMN can_take_face_attendance BOOLEAN DEFAULT FALSE' }
        ];

        for (const update of updates) {
            if (!existingCols.includes(update.name)) {
                console.log(`➕ Adding column: ${update.name}`);
                await client.query(update.query);
            } else {
                console.log(`✅ Column ${update.name} already exists.`);
            }
        }

        console.log('✔️ Staff schema fix completed successfully.');

    } catch (error) {
        console.error('❌ Error fixing staff schema:', error.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

fixStaffSchema();
